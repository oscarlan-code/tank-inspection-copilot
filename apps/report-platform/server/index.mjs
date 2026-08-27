import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, open, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { ApiError, createReportStore, validateAndroidV3ProductExport } from "./store.mjs";
import { materializeCaptureScenario } from "./capture-round-trip.mjs";
import {
  assertAppUploadAttachmentBoundary,
  createObjectUploadService,
} from "./object-upload-service.mjs";
import { createS3ObjectStorage, ObjectStorageError } from "./object-storage.mjs";
import {
  buildAccountScopedDemoFixturePackage,
  buildApiStandardFixturePackage,
} from "./api-standard-fixture.mjs";
import { buildFinalReportDocx } from "./docx-export.mjs";
import {
  createFloorCorrosionArtifactService,
  FloorCorrosionError,
} from "./floor-corrosion-artifacts.mjs";
import { createDurableFloorCorrosionArtifactService } from "./durable-floor-corrosion-artifacts.mjs";
import { createFloorCorrosionWorkerService } from "./floor-corrosion-worker-service.mjs";
import { getEffectiveLayoutMap } from "./layout-map-figure.mjs";
import { API_STANDARD_REPORT_TOC } from "./report-toc.mjs";
import { createAuthService } from "./auth/auth-service.mjs";
import { hashPassword, validateUsername } from "./auth/password-auth.mjs";
import {
  REPORT_PERMISSIONS,
  authorizeImportPackage,
  authorizePlatformPermission,
  authorizeReportOwnership,
  authorizeWorkspacePermission,
} from "./auth/permissions.mjs";
import {
  buildPrecedentAudit,
  getPrecedentKbStatus,
  rebuildPrecedentKbIndex,
  searchPrecedentPack,
} from "./precedent-kb.mjs";
import {
  buildFactRecommendationAudit,
  getFactRecommendationKbStatus,
  rebuildFactRecommendationKbIndex,
  searchFactRecommendationPairs,
} from "./fact-recommendation-kb.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const appRoot = join(__dirname, "..");
const fixturePath = join(appRoot, "src", "fixtures", "v3-product-export-shell-internal.json");
const port = Number(process.env.REPORT_PLATFORM_API_PORT || 8788);
const host = process.env.REPORT_PLATFORM_API_HOST || "0.0.0.0";
const bootstrapKey = "api-standard-v10";
const bootstrapPaths = new Set([
  "/api/v1/report-jobs/bootstrap/v10-api-standard",
  // Backward-compatible alias for any running UI opened before the V10 fixture was promoted.
  "/api/v1/report-jobs/bootstrap/shell-internal",
]);

const reportStore = await createReportStore({ databaseUrl: process.env.DATABASE_URL });
const objectStorage = createS3ObjectStorage();
const objectUploads = createObjectUploadService({ objectStorage, reportStore });
const floorCorrosionArtifactRoot = process.env.REPORT_PLATFORM_ARTIFACT_ROOT
  || join(appRoot, ".data", "artifacts", "floor-corrosion");
const localFloorCorrosionArtifacts = createFloorCorrosionArtifactService({
  artifactRoot: floorCorrosionArtifactRoot,
});
const workerFloorCorrosionArtifacts = createFloorCorrosionWorkerService({
  artifactRoot: floorCorrosionArtifactRoot,
  localArtifacts: localFloorCorrosionArtifacts,
});
const floorCorrosionArtifacts = createDurableFloorCorrosionArtifactService({
  localArtifacts: workerFloorCorrosionArtifacts,
  objectStorage,
  reportStore,
});
const fixtureExportPackage = buildApiStandardFixturePackage(JSON.parse(readFileSync(fixturePath, "utf8")));
const demoDataEnabled = String(
  process.env.REPORT_PLATFORM_ENABLE_DEMO_DATA ?? ((process.env.NODE_ENV ?? "development") === "production" ? "false" : "true"),
).toLowerCase() === "true";
const seededState = demoDataEnabled
  ? await reportStore.ensureSeedReport({
      bootstrapKey,
      exportPackage: fixtureExportPackage,
    })
  : null;
const authService = await createAuthService({ reportStore });

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    const { pathname } = requestUrl;
    applyCorsHeaders(request, response);

    if (request.method === "OPTIONS") {
      writeJson(response, 204, {});
      return;
    }

    if (request.method === "GET" && pathname === "/api/health") {
      writeJson(response, 200, {
        ok: true,
        service: "laiq-report-platform-api",
        floorCorrosionWorkers: floorCorrosionArtifacts.getWorkerStatus?.(),
        objectStorage: await objectStorage.getHealth(),
        storage: await reportStore.getHealth(),
      });
      return;
    }

    if (request.method === "GET" && pathname === "/api/ready") {
      const [objectStorageHealth, storageHealth] = await Promise.all([
        objectStorage.getHealth(),
        reportStore.getHealth(),
      ]);
      const ready = objectStorageHealth.healthy === true;
      writeJson(response, ready ? 200 : 503, {
        ok: ready,
        service: "laiq-report-platform-api",
        objectStorage: objectStorageHealth,
        storage: storageHealth,
      });
      return;
    }

    if (request.method === "GET" && pathname === "/api/v1/auth/config") {
      writeJson(response, 200, authService.getPublicConfig());
      return;
    }

    if (request.method === "POST" && pathname === "/api/v1/auth/login") {
      const body = await readJsonBody(request);
      const session = await authService.createPasswordSession({
        password: body.password,
        request,
        username: body.username,
      });
      response.setHeader("Set-Cookie", session.cookie);
      writeJson(response, 200, { principal: session.principal });
      return;
    }

    if (request.method === "POST" && pathname === "/api/v1/app/auth/login") {
      const body = await readJsonBody(request);
      const session = await authService.createPasswordSession({
        clientType: "inspection_app",
        deviceId: body.deviceId,
        password: body.password,
        request,
        username: body.username,
      });
      writeJson(response, 200, {
        expiresAtIso: session.expiresAtIso,
        principal: session.principal,
        sessionToken: session.sessionToken,
      });
      return;
    }

    if (request.method === "POST" && pathname === "/api/v1/auth/logout") {
      response.setHeader("Set-Cookie", await authService.revokeSession(request));
      writeJson(response, 204, {});
      return;
    }

    if (request.method === "GET" && pathname === "/api/v1/auth/session") {
      try {
        const principal = await authService.authenticate(request);
        writeJson(response, 200, { principal });
      } catch (error) {
        if (error instanceof ApiError && error.statusCode === 401) {
          writeJson(response, 200, { principal: null });
          return;
        }
        throw error;
      }
      return;
    }

    const principal = await authService.authenticate(request);

    if (request.method === "POST" && pathname === "/api/v1/app/auth/logout") {
      await authService.revokeSession(request);
      writeJson(response, 204, {});
      return;
    }

    if (request.method === "GET" && pathname === "/api/v1/admin/tenants") {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.ACCOUNT_MANAGE);
      writeJson(response, 200, { tenants: await reportStore.listManagedTenants() });
      return;
    }

    if (request.method === "POST" && pathname === "/api/v1/admin/tenants") {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.ACCOUNT_MANAGE);
      const body = await readJsonBody(request);
      const tenant = await reportStore.createManagedTenant({
        actorUserId: principal.userId,
        tenantId: body.tenantId,
        tenantName: body.tenantName,
      });
      writeJson(response, 201, { tenant });
      return;
    }

    if (request.method === "POST" && pathname === "/api/v1/admin/workspaces") {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.ACCOUNT_MANAGE);
      const body = await readJsonBody(request);
      const workspace = await reportStore.createManagedWorkspace({
        actorUserId: principal.userId,
        tenantId: body.tenantId,
        workspaceId: body.workspaceId,
        workspaceName: body.workspaceName,
      });
      writeJson(response, 201, { workspace });
      return;
    }

    if (request.method === "GET" && pathname === "/api/v1/admin/accounts") {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.ACCOUNT_MANAGE);
      writeJson(response, 200, { accounts: await reportStore.listManagedAccounts() });
      return;
    }

    if (request.method === "POST" && pathname === "/api/v1/admin/accounts") {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.ACCOUNT_MANAGE);
      const body = await readJsonBody(request);
      const usernameNormalized = validateManagedUsername(body.username);
      const passwordHash = await hashManagedPassword(body.password);
      const account = await reportStore.createManagedAccount({
        actorUserId: principal.userId,
        displayName: body.displayName,
        passwordHash,
        roleLabel: body.roleLabel,
        tenantId: body.tenantId,
        userId: body.userId,
        usernameNormalized,
        workspaceId: body.workspaceId,
      });
      writeJson(response, 201, { account });
      return;
    }

    if (request.method === "GET" && pathname === "/api/v1/admin/system-rl/status") {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.SYSTEM_RL_MANAGE);
      writeJson(response, 200, await reportStore.getSystemRlStatus());
      return;
    }

    if (request.method === "GET" && pathname === "/api/v1/admin/system-rl/held-out-review") {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.SYSTEM_RL_MANAGE);
      writeJson(response, 200, await reportStore.getSystemRlHeldOutReview({
        evaluationCaseId: requestUrl.searchParams.get("evaluationCaseId"),
        sectionId: requestUrl.searchParams.get("sectionId"),
      }));
      return;
    }

    if (request.method === "POST" && pathname === "/api/v1/admin/system-rl/held-out-section") {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.SYSTEM_RL_MANAGE);
      const body = await readJsonBody(request);
      const sectionId = String(body.sectionId ?? "").trim();
      const existing = await reportStore.getSystemRlHeldOutReview({ evaluationCaseId: body.evaluationCaseId, sectionId });
      if (existing.available) {
        writeJson(response, 200, existing);
        return;
      }
      const lab = await reportStore.getEvaluationLabState();
      const evaluationCase = lab.evaluationCases.find((item) => item.evaluationCaseId === body.evaluationCaseId);
      if (!evaluationCase?.reportJobId) throw new ApiError(404, "Hidden-test evaluation case was not found.", "held_out_case_missing");
      await reportStore.runSystemRlEvaluation({
        actorUserId: principal.userId,
        reportJobId: evaluationCase.reportJobId,
        sectionId,
        evaluationCaseId: evaluationCase.evaluationCaseId,
        frozenCandidate: true,
        userInstruction: "Generate this held-out section using the frozen candidate policy. Do not use golden-standard content.",
      });
      writeJson(response, 200, await reportStore.getSystemRlHeldOutReview({ evaluationCaseId: evaluationCase.evaluationCaseId, sectionId }));
      return;
    }

    if (request.method === "POST" && pathname === "/api/v1/admin/system-rl/held-out-test") {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.SYSTEM_RL_MANAGE);
      const body = await readJsonBody(request);
      const documentId = String(body.documentId ?? "").trim();
      if (!documentId) throw new ApiError(400, "Select a new approved report.", "held_out_document_required");
      writeJson(response, 201, await runAutomaticHeldOutTest({ documentId, objectStorage, principal, reportStore }));
      return;
    }

    if (request.method === "GET" && pathname === "/api/v1/admin/evaluation-lab") {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.SYSTEM_RL_MANAGE);
      writeJson(response, 200, await reportStore.getEvaluationLabState());
      return;
    }

    if (request.method === "POST" && pathname === "/api/v1/admin/evaluation-lab/cases") {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.SYSTEM_RL_MANAGE);
      const body = await readJsonBody(request);
      writeJson(
        response,
        201,
        await reportStore.linkEvaluationLabCase({
          actorUserId: principal.userId,
          goldDocumentId: body.goldDocumentId,
          reportJobId: body.reportJobId,
        }),
      );
      return;
    }

    if (request.method === "GET" && pathname === "/api/v1/admin/truth-cases") {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.SYSTEM_RL_MANAGE);
      writeJson(response, 200, await reportStore.getTruthCaseBuilderState());
      return;
    }

    if (request.method === "POST" && pathname === "/api/v1/admin/truth-cases") {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.SYSTEM_RL_MANAGE);
      const body = await readJsonBody(request);
      const truthCase = await reportStore.createTruthCaseFromApprovedSource({
        actorUserId: principal.userId,
        documentId: body.documentId,
        benchmarkTrack: body.benchmarkTrack,
        evidenceAsOf: body.evidenceAsOf,
        assetLineageKey: body.assetLineageKey,
      });
      writeJson(response, 201, truthCase);
      return;
    }

    if (request.method === "GET" && pathname === "/api/v1/admin/capture-variants") {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.SYSTEM_RL_MANAGE);
      writeJson(response, 200, await reportStore.getCaptureVariantBuilderState());
      return;
    }

    const truthCaseVariantPath = pathname.match(
      /^\/api\/v1\/admin\/truth-cases\/([^/]+)\/capture-variants$/,
    );
    if (request.method === "POST" && truthCaseVariantPath) {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.SYSTEM_RL_MANAGE);
      const body = await readJsonBody(request);
      const trainingCaseId = decodeURIComponent(truthCaseVariantPath[1]);
      const generated = await reportStore.createCaptureVariants({
        actorUserId: principal.userId,
        trainingCaseId,
        profileCodes: Array.isArray(body.profileCodes) ? body.profileCodes : [],
        seeds: Array.isArray(body.seeds) ? body.seeds : [1, 2],
      });
      const faithfulCandidates = generated.variants.filter((variant) => (
        variant.truthCaseId === trainingCaseId
        && variant.lane === "faithful_capture"
        && ["review_required", "approved", "materialized"].includes(variant.status)
      ));
      await completeAutomaticCaptureRoundTrips({ candidates: faithfulCandidates, objectStorage, principal, reportStore });
      writeJson(
        response,
        201,
        await reportStore.getCaptureVariantBuilderState(),
      );
      return;
    }

    if (request.method === "POST" && pathname === "/api/v1/admin/capture-variants/round-trip") {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.SYSTEM_RL_MANAGE);
      const body = await readJsonBody(request);
      const truthCaseId = String(body.truthCaseId ?? "").trim();
      if (!truthCaseId) throw new ApiError(400, "Truth Case is required for automatic app round trip.", "capture_variant_truth_case_required");
      const state = await reportStore.getCaptureVariantBuilderState();
      const candidates = state.variants.filter((variant) => (
        variant.truthCaseId === truthCaseId
        && variant.lane === "faithful_capture"
        && variant.expectedMissingInputs.length === 0
        && ["review_required", "approved", "materialized"].includes(variant.status)
      ));
      await completeAutomaticCaptureRoundTrips({ candidates, objectStorage, principal, reportStore });
      writeJson(response, 200, await reportStore.getCaptureVariantBuilderState());
      return;
    }

    const captureVariantPath = pathname.match(/^\/api\/v1\/admin\/capture-variants\/([^/]+)$/);
    if (request.method === "GET" && captureVariantPath) {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.SYSTEM_RL_MANAGE);
      const variant = await reportStore.getCaptureVariant(decodeURIComponent(captureVariantPath[1]));
      if (!variant) throw new ApiError(404, "Capture Variant was not found.", "capture_variant_not_found");
      writeJson(response, 200, variant);
      return;
    }

    const captureVariantApprovalPath = pathname.match(
      /^\/api\/v1\/admin\/capture-variants\/([^/]+)\/approve$/,
    );
    if (request.method === "POST" && captureVariantApprovalPath) {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.SYSTEM_RL_MANAGE);
      const variantId = decodeURIComponent(captureVariantApprovalPath[1]);
      const manifest = await reportStore.buildCaptureVariantManifest(variantId);
      const bytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
      const objectKey = [
        "training-harness",
        "capture-variants",
        encodeURIComponent(manifest.identity.truthCaseId),
        encodeURIComponent(variantId),
        "capture-scenario-v1.json",
      ].join("/");
      const stored = await objectStorage.putBuffer({
        bytes,
        mediaType: "application/json",
        objectId: `capture-variant:${variantId}:v1`,
        objectKey,
      });
      writeJson(
        response,
        200,
        await reportStore.approveCaptureVariant({
          actorUserId: principal.userId,
          variantId,
          scenarioObjectKey: objectKey,
          scenarioSha256: stored.sha256,
        }),
      );
      return;
    }

    const truthCasePath = pathname.match(/^\/api\/v1\/admin\/truth-cases\/([^/]+)$/);
    if (request.method === "GET" && truthCasePath) {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.SYSTEM_RL_MANAGE);
      const truthCase = await reportStore.getTruthCase(decodeURIComponent(truthCasePath[1]));
      if (!truthCase) throw new ApiError(404, "Truth Case was not found.", "training_case_not_found");
      writeJson(response, 200, truthCase);
      return;
    }

    const truthCaseProposalPath = pathname.match(
      /^\/api\/v1\/admin\/truth-cases\/([^/]+)\/proposals$/,
    );
    if (request.method === "POST" && truthCaseProposalPath) {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.SYSTEM_RL_MANAGE);
      writeJson(
        response,
        200,
        await reportStore.proposeTruthFacts({
          actorUserId: principal.userId,
          trainingCaseId: decodeURIComponent(truthCaseProposalPath[1]),
        }),
      );
      return;
    }

    const truthFactPath = pathname.match(
      /^\/api\/v1\/admin\/truth-cases\/([^/]+)\/facts\/([^/]+)$/,
    );
    if (request.method === "PUT" && truthFactPath) {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.SYSTEM_RL_MANAGE);
      const body = await readJsonBody(request);
      writeJson(
        response,
        200,
        await reportStore.reviewTruthFact({
          actorUserId: principal.userId,
          trainingCaseId: decodeURIComponent(truthFactPath[1]),
          factId: decodeURIComponent(truthFactPath[2]),
          values: body,
        }),
      );
      return;
    }

    const truthCaseApprovalPath = pathname.match(
      /^\/api\/v1\/admin\/truth-cases\/([^/]+)\/approve$/,
    );
    if (request.method === "POST" && truthCaseApprovalPath) {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.SYSTEM_RL_MANAGE);
      const trainingCaseId = decodeURIComponent(truthCaseApprovalPath[1]);
      await reportStore.acceptAutomatedTruthDraft({
        actorUserId: principal.userId,
        trainingCaseId,
      });
      const manifest = await reportStore.buildTruthGraphManifest(trainingCaseId);
      const bytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
      const objectKey = [
        "training-harness",
        "truth-cases",
        encodeURIComponent(trainingCaseId),
        `truth-graph-v${manifest.truthGraphVersion}.json`,
      ].join("/");
      const stored = await objectStorage.putBuffer({
        bytes,
        mediaType: "application/json",
        objectId: `truth-graph:${trainingCaseId}:v${manifest.truthGraphVersion}`,
        objectKey,
      });
      writeJson(
        response,
        200,
        await reportStore.approveTruthCase({
          actorUserId: principal.userId,
          trainingCaseId,
          truthGraphObjectKey: objectKey,
          truthGraphSha256: stored.sha256,
        }),
      );
      return;
    }

    if (request.method === "POST" && pathname === "/api/v1/admin/system-rl/episodes") {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.SYSTEM_RL_MANAGE);
      const body = await readJsonBody(request);
      const reportJobId = String(body.reportJobId ?? "").trim();
      const sectionId = String(body.sectionId ?? "").trim();
      if (!reportJobId || !sectionId) {
        throw new ApiError(
          400,
          "reportJobId and sectionId are required for an offline system RL episode.",
          "system_rl_episode_input_required",
        );
      }
      await authorizeReportJob(principal, reportJobId, REPORT_PERMISSIONS.GENERATE);
      const result = await reportStore.runSystemRlEvaluation({
        actorUserId: principal.userId,
        reportJobId,
        sectionId,
        userInstruction: body.userInstruction ?? "",
        evaluationCaseId: String(body.evaluationCaseId ?? "").trim() || null,
      });
      writeJson(response, 201, result);
      return;
    }

    if (request.method === "GET" && pathname === "/api/v1/admin/kb-review/cases") {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.KB_MANAGE);
      writeJson(response, 200, await reportStore.listKbReviewCases());
      return;
    }

    if (request.method === "GET" && pathname === "/api/v1/admin/kb-review/canonical-reports") {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.KB_MANAGE);
      writeJson(response, 200, await reportStore.getCanonicalReportReviewQueue());
      return;
    }

    if (request.method === "GET" && pathname === "/api/v1/admin/kb-review/canonical-reports/ingestion-status") {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.KB_MANAGE);
      writeJson(response, 200, await reportStore.getCanonicalReportIngestionStatus());
      return;
    }

    const canonicalReportPath = pathname.match(
      /^\/api\/v1\/admin\/kb-review\/canonical-reports\/([^/]+)$/,
    );
    if (request.method === "PUT" && canonicalReportPath) {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.KB_MANAGE);
      const body = await readJsonBody(request);
      writeJson(response, 200, await reportStore.reviewCanonicalReportGroup({
        actorUserId: principal.userId,
        groupKey: decodeURIComponent(canonicalReportPath[1]),
        values: body,
      }));
      return;
    }

    const kbReviewCasePath = pathname.match(/^\/api\/v1\/admin\/kb-review\/cases\/([^/]+)$/);
    if (request.method === "GET" && kbReviewCasePath) {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.KB_MANAGE);
      writeJson(
        response,
        200,
        await reportStore.loadKbReviewCase(decodeURIComponent(kbReviewCasePath[1])),
      );
      return;
    }

    const kbReviewDocumentPath = pathname.match(
      /^\/api\/v1\/admin\/kb-review\/documents\/([^/]+)$/,
    );
    if (request.method === "PATCH" && kbReviewDocumentPath) {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.KB_MANAGE);
      const body = await readJsonBody(request);
      writeJson(
        response,
        200,
        await reportStore.updateKbReviewDocument({
          actorUserId: principal.userId,
          documentId: decodeURIComponent(kbReviewDocumentPath[1]),
          values: body,
        }),
      );
      return;
    }

    const kbReviewSectionPath = pathname.match(
      /^\/api\/v1\/admin\/kb-review\/sections\/([^/]+)$/,
    );
    if (request.method === "PATCH" && kbReviewSectionPath) {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.KB_MANAGE);
      const body = await readJsonBody(request);
      writeJson(
        response,
        200,
        await reportStore.updateKbReviewSection({
          actorUserId: principal.userId,
          sectionId: decodeURIComponent(kbReviewSectionPath[1]),
          values: body,
        }),
      );
      return;
    }

    const kbWarningReviewPath = pathname.match(
      /^\/api\/v1\/admin\/kb-review\/documents\/([^/]+)\/warnings\/([^/]+)\/review$/,
    );
    if (request.method === "POST" && kbWarningReviewPath) {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.KB_MANAGE);
      const body = await readJsonBody(request);
      writeJson(
        response,
        200,
        await reportStore.reviewKbWarning({
          actorUserId: principal.userId,
          documentId: decodeURIComponent(kbWarningReviewPath[1]),
          issueKey: decodeURIComponent(kbWarningReviewPath[2]),
          resolution: body.resolution,
          notes: body.notes,
        }),
      );
      return;
    }

    const kbReviewDecisionPath = pathname.match(
      /^\/api\/v1\/admin\/kb-review\/documents\/([^/]+)\/decision$/,
    );
    if (request.method === "POST" && kbReviewDecisionPath) {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.KB_MANAGE);
      const body = await readJsonBody(request);
      writeJson(
        response,
        200,
        await reportStore.decideKbReviewDocument({
          action: body.action,
          actorUserId: principal.userId,
          documentId: decodeURIComponent(kbReviewDecisionPath[1]),
          notes: body.notes,
        }),
      );
      return;
    }

    const kbReviewSourcePath = pathname.match(
      /^\/api\/v1\/admin\/kb-review\/documents\/([^/]+)\/source-url$/,
    );
    if (request.method === "GET" && kbReviewSourcePath) {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.KB_MANAGE);
      const source = await reportStore.getKbReviewDocumentSource(
        decodeURIComponent(kbReviewSourcePath[1]),
      );
      writeJson(response, 200, {
        documentId: source.documentId,
        fileName: source.fileName,
        mediaType: source.mediaType,
        readUrl: `/api/v1/admin/kb-review/documents/${encodeURIComponent(source.documentId)}/source`,
      });
      return;
    }

    const kbReviewSourceStreamPath = pathname.match(
      /^\/api\/v1\/admin\/kb-review\/documents\/([^/]+)\/source$/,
    );
    if (request.method === "GET" && kbReviewSourceStreamPath) {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.KB_MANAGE);
      const source = await reportStore.getKbReviewDocumentSource(
        decodeURIComponent(kbReviewSourceStreamPath[1]),
      );
      const range = readByteRange(request.headers.range);
      const object = await objectStorage.openObjectRead({
        objectKey: source.objectKey,
        range,
      });
      response.statusCode = object.contentRange ? 206 : 200;
      response.setHeader("Accept-Ranges", object.acceptRanges);
      response.setHeader("Cache-Control", "private, no-store");
      response.setHeader("Content-Disposition", inlineDisposition(source.fileName));
      response.setHeader("Content-Length", String(object.contentLength));
      response.setHeader("Content-Type", source.mediaType || object.contentType);
      response.setHeader("X-Content-Type-Options", "nosniff");
      if (object.contentRange) response.setHeader("Content-Range", object.contentRange);
      if (object.etag) response.setHeader("ETag", object.etag);
      if (object.lastModified) response.setHeader("Last-Modified", object.lastModified.toUTCString());
      await pipeObjectBody(object.body, response);
      return;
    }

    const promoteSystemRlPath = pathname.match(
      /^\/api\/v1\/admin\/system-rl\/policies\/([^/]+)\/promote$/,
    );
    if (request.method === "POST" && promoteSystemRlPath) {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.SYSTEM_RL_MANAGE);
      const body = await readJsonBody(request);
      const result = await reportStore.promoteSystemRlPolicy({
        actorUserId: principal.userId,
        policyVersionId: decodeURIComponent(promoteSystemRlPath[1]),
        reason: body.reason,
      });
      writeJson(response, 200, result);
      return;
    }

    const rollbackSystemRlPath = pathname.match(
      /^\/api\/v1\/admin\/system-rl\/policies\/([^/]+)\/rollback$/,
    );
    if (request.method === "POST" && rollbackSystemRlPath) {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.SYSTEM_RL_MANAGE);
      const body = await readJsonBody(request);
      const result = await reportStore.rollbackSystemRlPolicy({
        actorUserId: principal.userId,
        policyVersionId: decodeURIComponent(rollbackSystemRlPath[1]),
        reason: body.reason,
      });
      writeJson(response, 200, result);
      return;
    }

    const adminAccountStatusPath = pathname.match(/^\/api\/v1\/admin\/accounts\/([^/]+)\/status$/);
    if (request.method === "PATCH" && adminAccountStatusPath) {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.ACCOUNT_MANAGE);
      const body = await readJsonBody(request);
      const account = await reportStore.setManagedAccountStatus({
        actorUserId: principal.userId,
        accountStatus: body.accountStatus,
        targetUserId: decodeURIComponent(adminAccountStatusPath[1]),
      });
      writeJson(response, 200, { account });
      return;
    }

    const adminAccountPasswordPath = pathname.match(/^\/api\/v1\/admin\/accounts\/([^/]+)\/password$/);
    if (request.method === "POST" && adminAccountPasswordPath) {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.ACCOUNT_MANAGE);
      const body = await readJsonBody(request);
      const account = await reportStore.resetManagedAccountPassword({
        actorUserId: principal.userId,
        passwordHash: await hashManagedPassword(body.password),
        targetUserId: decodeURIComponent(adminAccountPasswordPath[1]),
      });
      writeJson(response, 200, { account });
      return;
    }

    const adminAccountDeletePath = pathname.match(/^\/api\/v1\/admin\/accounts\/([^/]+)$/);
    if (request.method === "DELETE" && adminAccountDeletePath) {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.ACCOUNT_MANAGE);
      const body = await readJsonBody(request);
      const result = await reportStore.deleteManagedAccount({
        actorUserId: principal.userId,
        confirmation: body.confirmation,
        targetUserId: decodeURIComponent(adminAccountDeletePath[1]),
      });
      const artifactCleanupWarnings = [];
      let objectCleanupWarning = null;
      if (result.deletedObjectKeys.length > 0) {
        try {
          await objectStorage.deleteObjects(result.deletedObjectKeys);
        } catch (error) {
          console.error("Unable to remove account evidence objects", error);
          objectCleanupWarning = "Account data was deleted, but object-storage lifecycle cleanup is still required.";
        }
      }
      for (const reportJobId of result.deletedReportJobIds) {
        try {
          floorCorrosionArtifacts.deleteReportArtifacts(reportJobId);
        } catch (error) {
          console.error(`Unable to remove floor-corrosion artifacts for ${reportJobId}`, error);
          artifactCleanupWarnings.push(reportJobId);
        }
      }
      writeJson(response, 200, {
        deletedImportCount: result.deletedImportCount,
        deletedObjectCount: result.deletedObjectKeys.length,
        deletedReportJobIds: result.deletedReportJobIds,
        deletedUserId: result.deletedUserId,
        artifactCleanupWarnings,
        objectCleanupWarning,
      });
      return;
    }

    if (request.method === "GET" && pathname === "/api/v1/report-jobs") {
      writeJson(response, 200, { reportJobs: await reportStore.listAccessibleReportJobs(principal) });
      return;
    }

    if (request.method === "POST" && pathname === "/api/v1/app/imports/v3-product") {
      const body = await readJsonBody(request);
      const sourceExportPackage = body.exportPackage ?? body.package ?? body;
      const exportPackage = bindAppExportToPrincipal({
        exportPackage: sourceExportPackage,
        principal,
        workspaceId: body.workspaceId,
      });
      authorizeImportPackage(principal, exportPackage);
      assertAppUploadAttachmentBoundary(exportPackage);
      if ((exportPackage.attachments ?? []).some((attachment) => attachment.fileExists === true)) {
        throw new ApiError(
          409,
          "This export includes evidence files. Create an object upload session and finalize it after uploading every file.",
          "object_upload_session_required",
        );
      }
      const state = await objectUploads.importPackage({
        actorUserId: principal.userId,
        exportPackage,
        sourceExportPackage,
      });
      writeJson(response, 201, {
        reportJob: state.reportJob,
        status: "imported",
      });
      return;
    }

    if (request.method === "POST" && pathname === "/api/v1/app/imports/v3-product/upload-sessions") {
      const body = await readJsonBody(request);
      const sourceExportPackage = body.exportPackage ?? body.package;
      const exportPackage = bindAppExportToPrincipal({
        exportPackage: sourceExportPackage,
        principal,
        workspaceId: body.workspaceId,
      });
      authorizeImportPackage(principal, exportPackage);
      const uploadPlan = await objectUploads.createUploadSession({
        actorUserId: principal.userId,
        exportPackage,
        sourceExportPackage,
        idempotencyKey: request.headers["idempotency-key"],
        manifest: body.objects,
      });
      writeJson(response, 201, uploadPlan);
      return;
    }

    const appUploadSessionPath = pathname.match(
      /^\/api\/v1\/app\/imports\/v3-product\/upload-sessions\/([^/]+)$/,
    );
    if (request.method === "GET" && appUploadSessionPath) {
      const uploadPlan = await objectUploads.refreshUploadSession({
        actorUserId: principal.userId,
        uploadSessionId: decodeURIComponent(appUploadSessionPath[1]),
      });
      writeJson(response, 200, uploadPlan);
      return;
    }

    const appUploadFinalizePath = pathname.match(
      /^\/api\/v1\/app\/imports\/v3-product\/upload-sessions\/([^/]+)\/finalize$/,
    );
    if (request.method === "POST" && appUploadFinalizePath) {
      const result = await objectUploads.finalizeUploadSession({
        actorUserId: principal.userId,
        uploadSessionId: decodeURIComponent(appUploadFinalizePath[1]),
      });
      writeJson(response, 201, result);
      return;
    }

    if (request.method === "GET" && pathname === "/api/v1/knowledge-base/precedent/status") {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.KB_MANAGE);
      writeJson(response, 200, getPrecedentKbStatus());
      return;
    }

    if (request.method === "POST" && pathname === "/api/v1/knowledge-base/precedent/rebuild") {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.KB_MANAGE);
      const index = rebuildPrecedentKbIndex();
      writeJson(response, 200, {
        builtAtIso: index.builtAtIso,
        sampleReportsDir: index.sampleReportsDir,
        documentCount: index.documents.length,
        pageCount: index.pageCount,
        chunkCount: index.chunks.length,
        errorCount: index.errors.length,
        errors: index.errors,
      });
      return;
    }

    if (request.method === "GET" && pathname === "/api/v1/knowledge-base/precedent/search") {
      const sectionId = requestUrl.searchParams.get("sectionId") ?? "inspection-report";
      const reportJobId = requestUrl.searchParams.get("reportJobId") ?? seededState?.reportJob?.reportJobId;
      if (!reportJobId) {
        throw new ApiError(
          400,
          "Knowledge-base search requires an authorized report job context.",
          "kb_report_context_required",
        );
      }
      const state = await loadAuthorizedReportState(principal, reportJobId, REPORT_PERMISSIONS.KB_SEARCH);

      writeJson(response, 200, searchPrecedentPack({
        sectionId,
        reportState: state,
      }));
      return;
    }

    if (request.method === "GET" && pathname === "/api/v1/knowledge-base/precedent/audit") {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.KB_MANAGE);
      const reportJobId = requestUrl.searchParams.get("reportJobId") ?? seededState?.reportJob?.reportJobId;
      const state = reportJobId
        ? await loadAuthorizedReportState(principal, reportJobId, REPORT_PERMISSIONS.READ)
        : null;

      writeJson(response, 200, buildPrecedentAudit({
        reportState: state,
      }));
      return;
    }

    if (request.method === "GET" && pathname === "/api/v1/knowledge-base/recommendations/status") {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.KB_MANAGE);
      writeJson(response, 200, getFactRecommendationKbStatus());
      return;
    }

    if (request.method === "POST" && pathname === "/api/v1/knowledge-base/recommendations/rebuild") {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.KB_MANAGE);
      const index = rebuildFactRecommendationKbIndex();
      writeJson(response, 200, {
        builtAtIso: index.builtAtIso,
        sourceChunkCount: index.sourceChunkCount,
        sourceDocumentCount: index.sourceDocumentCount,
        pairCount: index.pairCount,
        actionTagCounts: index.actionTagCounts,
        componentTagCounts: index.componentTagCounts,
        errorCount: index.errors.length,
        errors: index.errors,
      });
      return;
    }

    if (request.method === "GET" && pathname === "/api/v1/knowledge-base/recommendations/search") {
      const sectionId = requestUrl.searchParams.get("sectionId") ?? "repair-recommendations";
      const reportJobId = requestUrl.searchParams.get("reportJobId") ?? seededState?.reportJob?.reportJobId;
      if (!reportJobId) {
        throw new ApiError(
          400,
          "Recommendation search requires an authorized report job context.",
          "kb_report_context_required",
        );
      }
      const state = await loadAuthorizedReportState(principal, reportJobId, REPORT_PERMISSIONS.KB_SEARCH);
      writeJson(response, 200, searchFactRecommendationPairs({
        reportState: state,
        sectionId,
        limit: Number(requestUrl.searchParams.get("limit") ?? 24),
      }));
      return;
    }

    if (request.method === "GET" && pathname === "/api/v1/knowledge-base/recommendations/audit") {
      authorizePlatformPermission(principal, REPORT_PERMISSIONS.KB_MANAGE);
      const reportJobId = requestUrl.searchParams.get("reportJobId") ?? seededState?.reportJob?.reportJobId;
      const state = reportJobId
        ? await loadAuthorizedReportState(principal, reportJobId, REPORT_PERMISSIONS.READ)
        : null;
      writeJson(response, 200, buildFactRecommendationAudit({
        reportState: state,
      }));
      return;
    }

    if (
      request.method === "GET" &&
      (
        pathname === "/api/v1/exports/android-v2-product/v10-api-standard.json" ||
        pathname === "/api/v1/exports/android-v3-product/v10-api-standard.json"
      )
    ) {
      const state = await loadAccountDemoReport(principal);
      await authorizeReportJob(principal, state.reportJob.reportJobId, REPORT_PERMISSIONS.READ);
      writeJson(response, 200, state.exportPackage);
      return;
    }

    if (request.method === "GET" && bootstrapPaths.has(pathname)) {
      const state = await loadAccountDemoReport(principal);
      await authorizeReportJob(principal, state.reportJob.reportJobId, REPORT_PERMISSIONS.READ);
      writeJson(response, 200, withPrincipalContext(state, principal));
      return;
    }

    if (
      request.method === "POST" &&
      (
        pathname === "/api/v1/imports/android-v2-product" ||
        pathname === "/api/v1/imports/android-v3-product"
      )
    ) {
      if (!demoDataEnabled) {
        throw new ApiError(404, "Demo import route is not enabled.", "demo_data_disabled");
      }
      const body = await readJsonBody(request);
      const exportPackage = body.exportPackage ?? body.package ?? body;
      const manualSupplementOverrides = body.manualSupplement ?? {};
      if (!exportPackage?.tenantId || !exportPackage?.workspaceId) {
        throw new ApiError(
          400,
          "Invalid LAIQ inspection app export package. tenantId and workspaceId are required.",
          "invalid_export_package",
        );
      }
      authorizeImportPackage(principal, exportPackage);
      const state = await reportStore.importAndroidV2ProductExport({
        exportPackage,
        manualSupplementOverrides,
        actorUserId: principal.userId,
      });

      writeJson(response, 201, withPrincipalContext(state, principal));
      return;
    }

    const reportJobPath = pathname.match(/^\/api\/v1\/report-jobs\/([^/]+)$/);
    if (request.method === "GET" && reportJobPath) {
      const reportJobId = decodeURIComponent(reportJobPath[1]);
      const state = await loadAuthorizedReportState(principal, reportJobId, REPORT_PERMISSIONS.READ);
      writeJson(response, 200, state);
      return;
    }

    const reportEvidencePath = pathname.match(
      /^\/api\/v1\/report-jobs\/([^/]+)\/attachments\/([^/]+)\/read-url$/,
    );
    if (request.method === "GET" && reportEvidencePath) {
      const reportJobId = decodeURIComponent(reportEvidencePath[1]);
      const attachmentId = decodeURIComponent(reportEvidencePath[2]);
      await authorizeReportJob(principal, reportJobId, REPORT_PERMISSIONS.READ);
      writeJson(response, 200, await objectUploads.getEvidenceReadUrl({
        attachmentId,
        reportJobId,
      }));
      return;
    }

    const evalRunsPath = pathname.match(/^\/api\/v1\/report-jobs\/([^/]+)\/evals$/);
    if (request.method === "GET" && evalRunsPath) {
      const reportJobId = decodeURIComponent(evalRunsPath[1]);
      await authorizeReportJob(principal, reportJobId, REPORT_PERMISSIONS.READ);
      writeJson(response, 200, {
        reportJobId,
        evalRuns: await reportStore.loadEvalRuns(reportJobId),
      });
      return;
    }

    const sectionEvalPath = pathname.match(/^\/api\/v1\/report-jobs\/([^/]+)\/sections\/([^/]+)\/evals\/latest$/);
    if (request.method === "GET" && sectionEvalPath) {
      const reportJobId = decodeURIComponent(sectionEvalPath[1]);
      const sectionId = decodeURIComponent(sectionEvalPath[2]);
      await authorizeReportJob(principal, reportJobId, REPORT_PERMISSIONS.READ);
      const evalRun = await reportStore.loadLatestEvalRun(reportJobId, sectionId);
      if (!evalRun) {
        writeJson(response, 404, { error: `No eval run found for ${sectionId}.` });
        return;
      }

      writeJson(response, 200, evalRun);
      return;
    }

    const manualInputsPath = pathname.match(/^\/api\/v1\/report-jobs\/([^/]+)\/manual-inputs$/);
    if (request.method === "PATCH" && manualInputsPath) {
      const reportJobId = decodeURIComponent(manualInputsPath[1]);
      await authorizeReportJob(principal, reportJobId, REPORT_PERMISSIONS.EDIT);
      const body = await readJsonBody(request);
      const state = await reportStore.saveManualInputs(reportJobId, body.values ?? {}, {
        expectedRevision: body.expectedRevision,
      });
      writeJson(response, 200, withPrincipalContext(state, principal));
      return;
    }

    const resetDraftsPath = pathname.match(/^\/api\/v1\/report-jobs\/([^/]+)\/reset-drafts$/);
    if (request.method === "POST" && resetDraftsPath) {
      const reportJobId = decodeURIComponent(resetDraftsPath[1]);
      await authorizeReportJob(principal, reportJobId, REPORT_PERMISSIONS.EDIT);
      const state = await reportStore.resetReportDrafts(reportJobId);
      writeJson(response, 200, withPrincipalContext(state, principal));
      return;
    }

    const sectionPath = pathname.match(/^\/api\/v1\/report-jobs\/([^/]+)\/sections\/([^/]+)$/);
    if (request.method === "PATCH" && sectionPath) {
      const reportJobId = decodeURIComponent(sectionPath[1]);
      const sectionId = decodeURIComponent(sectionPath[2]);
      await authorizeReportJob(principal, reportJobId, REPORT_PERMISSIONS.EDIT);
      const body = await readJsonBody(request);
      const state = await reportStore.saveSectionDraft(reportJobId, sectionId, body);
      writeJson(response, 200, withPrincipalContext(state, principal));
      return;
    }

    const generatePath = pathname.match(/^\/api\/v1\/report-jobs\/([^/]+)\/sections\/([^/]+)\/generate$/);
    if (request.method === "POST" && generatePath) {
      const reportJobId = decodeURIComponent(generatePath[1]);
      const sectionId = decodeURIComponent(generatePath[2]);
      await authorizeReportJob(principal, reportJobId, REPORT_PERMISSIONS.GENERATE);
      const body = await readJsonBody(request);
      const state = await reportStore.generateSection(reportJobId, sectionId, {
        actorUserId: principal.userId,
        userInstruction: body.userInstruction ?? body.instruction ?? "",
        expectedVersion: body.expectedVersion,
      });
      writeJson(response, 200, withPrincipalContext(state, principal));
      return;
    }

    const chatPath = pathname.match(/^\/api\/v1\/report-jobs\/([^/]+)\/sections\/([^/]+)\/chat$/);
    if (request.method === "POST" && chatPath) {
      const reportJobId = decodeURIComponent(chatPath[1]);
      const sectionId = decodeURIComponent(chatPath[2]);
      await authorizeReportJob(principal, reportJobId, REPORT_PERMISSIONS.GENERATE);
      const body = await readJsonBody(request);
      const reply = await reportStore.replyToSectionChat(reportJobId, sectionId, {
        userPrompt: body.userPrompt ?? body.prompt ?? "",
        conversationHistory: body.conversationHistory ?? body.history ?? [],
      });
      writeJson(response, 200, reply);
      return;
    }

    const targetedEditPath = pathname.match(
      /^\/api\/v1\/report-jobs\/([^/]+)\/sections\/([^/]+)\/targeted-edit$/,
    );
    if (request.method === "POST" && targetedEditPath) {
      const reportJobId = decodeURIComponent(targetedEditPath[1]);
      const sectionId = decodeURIComponent(targetedEditPath[2]);
      await authorizeReportJob(principal, reportJobId, REPORT_PERMISSIONS.GENERATE);
      const body = await readJsonBody(request);
      const proposal = await reportStore.previewTargetedSectionEdit(reportJobId, sectionId, body);
      writeJson(response, 200, proposal);
      return;
    }

    const restoreSectionPath = pathname.match(/^\/api\/v1\/report-jobs\/([^/]+)\/sections\/([^/]+)\/restore-previous$/);
    if (request.method === "POST" && restoreSectionPath) {
      const reportJobId = decodeURIComponent(restoreSectionPath[1]);
      const sectionId = decodeURIComponent(restoreSectionPath[2]);
      await authorizeReportJob(principal, reportJobId, REPORT_PERMISSIONS.EDIT);
      const body = await readJsonBody(request);
      const state = await reportStore.restorePreviousSectionDraft(reportJobId, sectionId, {
        ...body,
        actorUserId: principal.userId,
      });
      writeJson(response, 200, withPrincipalContext(state, principal));
      return;
    }

    const layoutOverridePath = pathname.match(/^\/api\/v1\/report-jobs\/([^/]+)\/layout-overrides\/([^/]+)$/);
    if (request.method === "PATCH" && layoutOverridePath) {
      const reportJobId = decodeURIComponent(layoutOverridePath[1]);
      const sectionId = decodeURIComponent(layoutOverridePath[2]);
      await authorizeReportJob(principal, reportJobId, REPORT_PERMISSIONS.EDIT);
      const body = await readJsonBody(request);
      const state = await reportStore.saveLayoutOverride(reportJobId, sectionId, body.layoutMap, {
        expectedVersion: body.expectedVersion,
      });
      writeJson(response, 200, withPrincipalContext(state, principal));
      return;
    }

    const floorCorrosionImportPath = pathname.match(/^\/api\/v1\/report-jobs\/([^/]+)\/floor-corrosion\/mfl-import$/);
    if (request.method === "POST" && floorCorrosionImportPath) {
      const reportJobId = decodeURIComponent(floorCorrosionImportPath[1]);
      const state = await loadAuthorizedReportState(principal, reportJobId, REPORT_PERMISSIONS.EDIT);
      const sectionId = requestUrl.searchParams.get("sectionId") ?? "floor-plate-corrosion-plan";
      const tocSection = API_STANDARD_REPORT_TOC.find((section) => section.id === sectionId);
      if (!tocSection || tocSection.layoutSurface !== "floor") {
        throw new ApiError(400, "Floor corrosion import requires a floor layout section.", "floor_corrosion_section_invalid");
      }
      if (!/^application\/pdf(?:;|$)/i.test(String(request.headers["content-type"] ?? ""))) {
        throw new ApiError(415, "MFL import requires application/pdf content.", "mfl_content_type_invalid");
      }
      const previousLayoutMap = getEffectiveLayoutMap(state, tocSection);
      const appBaselineState = {
        ...state,
        layoutOverrides: (state.layoutOverrides ?? []).filter((override) => override.sectionId !== sectionId),
      };
      const layoutMap = getEffectiveLayoutMap(appBaselineState, tocSection);
      if (!layoutMap) {
        throw new ApiError(422, "No imported floor layout is available for MFL placement.", "floor_layout_missing");
      }
      if (!layoutMap.appFigure?.svg) {
        throw new ApiError(
          422,
          "MFL placement requires the immutable floor layout exported by the LAIQ inspection app.",
          "app_floor_layout_required",
        );
      }
      const uploadedPdf = await streamBinaryBodyToTemporaryFile(request, 100 * 1024 * 1024);
      let importResult;
      try {
        importResult = await floorCorrosionArtifacts.importMflPdf({
          actorUserId: principal.userId,
          reportJobId,
          layoutMap,
          pdfPath: uploadedPdf.path,
          sourceDocumentName: requestUrl.searchParams.get("fileName") ?? "MFL plate maps.pdf",
        });
      } finally {
        await uploadedPdf.cleanup();
      }
      let updatedState;
      try {
        updatedState = await reportStore.saveLayoutOverride(reportJobId, sectionId, importResult.layoutMap, {
          expectedVersion: Number(requestUrl.searchParams.get("expectedVersion")),
        });
      } catch (error) {
        await floorCorrosionArtifacts.deleteArtifactRun({
          reportJobId,
          runId: importResult.summary.artifactRunId,
        }).catch(() => {});
        throw error;
      }
      await cleanupSupersededFloorArtifactRun({
        currentRunId: importResult.summary.artifactRunId,
        layoutMap: previousLayoutMap,
        reportJobId,
      });
      writeJson(response, 201, {
        ...withPrincipalContext(updatedState, principal),
        floorCorrosionImportSummary: importResult.summary,
      });
      return;
    }

    const floorLayoutImportPath = pathname.match(/^\/api\/v1\/report-jobs\/([^/]+)\/floor-corrosion\/layout-import$/);
    if (request.method === "POST" && floorLayoutImportPath) {
      const reportJobId = decodeURIComponent(floorLayoutImportPath[1]);
      const state = await loadAuthorizedReportState(principal, reportJobId, REPORT_PERMISSIONS.EDIT);
      const sectionId = requestUrl.searchParams.get("sectionId") ?? "floor-plate-corrosion-plan";
      const tocSection = API_STANDARD_REPORT_TOC.find((section) => section.id === sectionId);
      if (!tocSection || tocSection.layoutSurface !== "floor") {
        throw new ApiError(400, "Floor layout import requires a floor layout section.", "floor_layout_section_invalid");
      }
      if (!/^application\/pdf(?:;|$)/i.test(String(request.headers["content-type"] ?? ""))) {
        throw new ApiError(415, "Floor layout import requires application/pdf content.", "floor_layout_content_type_invalid");
      }
      const previousLayoutMap = getEffectiveLayoutMap(state, tocSection);
      const appBaselineState = {
        ...state,
        layoutOverrides: (state.layoutOverrides ?? []).filter((override) => override.sectionId !== sectionId),
      };
      const appLayoutMap = getEffectiveLayoutMap(appBaselineState, tocSection);
      if (appLayoutMap?.appFigure?.svg) {
        throw new ApiError(
          409,
          "This report already has an app-owned floor layout. Import MFL plate maps directly; replacing app geometry is not allowed.",
          "app_floor_layout_locked",
        );
      }
      const uploadedPdf = await streamBinaryBodyToTemporaryFile(request, 100 * 1024 * 1024);
      let importResult;
      try {
        importResult = await floorCorrosionArtifacts.importLayoutPdf({
          actorUserId: principal.userId,
          reportJobId,
          pdfPath: uploadedPdf.path,
          sourceDocumentName: requestUrl.searchParams.get("fileName") ?? "Floor layout.pdf",
          sourcePage: Number(requestUrl.searchParams.get("page") ?? 1),
          client: state.exportPackage?.task?.client ?? "Pending confirmation",
          tank: state.exportPackage?.task?.tankNumber ?? "Pending confirmation",
          reference: state.reportJob?.reportReference ?? "Pending confirmation",
        });
      } finally {
        await uploadedPdf.cleanup();
      }
      let updatedState;
      try {
        updatedState = await reportStore.saveLayoutOverride(reportJobId, sectionId, importResult.layoutMap, {
          expectedVersion: Number(requestUrl.searchParams.get("expectedVersion")),
        });
      } catch (error) {
        await floorCorrosionArtifacts.deleteArtifactRun({
          reportJobId,
          runId: importResult.summary.artifactRunId,
        }).catch(() => {});
        throw error;
      }
      await cleanupSupersededFloorArtifactRun({
        currentRunId: importResult.summary.artifactRunId,
        layoutMap: previousLayoutMap,
        reportJobId,
      });
      writeJson(response, 201, {
        ...withPrincipalContext(updatedState, principal),
        floorLayoutImportSummary: importResult.summary,
      });
      return;
    }

    const floorCorrosionPlacementPath = pathname.match(/^\/api\/v1\/report-jobs\/([^/]+)\/floor-corrosion\/placements$/);
    if (request.method === "PATCH" && floorCorrosionPlacementPath) {
      const reportJobId = decodeURIComponent(floorCorrosionPlacementPath[1]);
      const state = await loadAuthorizedReportState(principal, reportJobId, REPORT_PERMISSIONS.EDIT);
      const sectionId = requestUrl.searchParams.get("sectionId") ?? "floor-plate-corrosion-plan";
      const tocSection = API_STANDARD_REPORT_TOC.find((section) => section.id === sectionId);
      const layoutMap = tocSection ? getEffectiveLayoutMap(state, tocSection) : null;
      if (!layoutMap) {
        throw new ApiError(404, "Floor corrosion map was not found.", "floor_corrosion_not_found");
      }
      const body = await readJsonBody(request);
      const updatedLayoutMap = floorCorrosionArtifacts.updatePlacement({
        reportJobId,
        layoutMap,
        ...body,
        actorUserId: principal.userId,
      });
      const updatedState = await reportStore.saveLayoutOverride(reportJobId, sectionId, updatedLayoutMap, {
        expectedVersion: body.expectedVersion,
      });
      writeJson(response, 200, withPrincipalContext(updatedState, principal));
      return;
    }

    const floorCorrosionArtifactPath = pathname.match(/^\/api\/v1\/report-jobs\/([^/]+)\/floor-corrosion\/artifacts\/([^/]+)\/([^/]+)$/);
    if (request.method === "GET" && floorCorrosionArtifactPath) {
      const reportJobId = decodeURIComponent(floorCorrosionArtifactPath[1]);
      await authorizeReportJob(principal, reportJobId, REPORT_PERMISSIONS.READ);
      const buffer = await floorCorrosionArtifacts.readArtifact({
        reportJobId,
        runId: decodeURIComponent(floorCorrosionArtifactPath[2]),
        artifactFileName: decodeURIComponent(floorCorrosionArtifactPath[3]),
      });
      writeBinary(response, 200, buffer, {
        "Cache-Control": "private, max-age=300",
        "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'",
        "Content-Type": floorCorrosionArtifacts.getArtifactContentType(floorCorrosionArtifactPath[3]),
        "X-Content-Type-Options": "nosniff",
      });
      return;
    }

    const approvePath = pathname.match(/^\/api\/v1\/report-jobs\/([^/]+)\/sections\/([^/]+)\/approve$/);
    if (request.method === "POST" && approvePath) {
      const reportJobId = decodeURIComponent(approvePath[1]);
      const sectionId = decodeURIComponent(approvePath[2]);
      await authorizeReportJob(principal, reportJobId, REPORT_PERMISSIONS.APPROVE);
      const body = await readJsonBody(request);
      const state = await reportStore.approveSection(reportJobId, sectionId, {
        ...body,
        actorUserId: principal.userId,
      });
      writeJson(response, 200, withPrincipalContext(state, principal));
      return;
    }

    const docxExportPath = pathname.match(/^\/api\/v1\/report-jobs\/([^/]+)\/exports\/final-report\.docx$/);
    if ((request.method === "GET" || request.method === "POST") && docxExportPath) {
      const reportJobId = decodeURIComponent(docxExportPath[1]);
      const state = await loadAuthorizedReportState(principal, reportJobId, REPORT_PERMISSIONS.EXPORT);

      const body = request.method === "POST" ? await readJsonBody(request) : {};
      let exportResult;
      try {
        exportResult = await buildFinalReportDocx(await hydrateFloorCorrosionReportState(state), {
          sectionIds: Array.isArray(body.sectionIds) ? body.sectionIds : [],
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to export DOCX.";
        const statusCode = /select at least one approved section/i.test(message) ? 400 : 500;
        writeJson(response, statusCode, {
          error: statusCode === 400 ? message : "Unable to export DOCX.",
          code: statusCode === 400 ? "no_approved_sections_selected" : "docx_export_failed",
        });
        return;
      }
      writeBinary(response, 200, exportResult.buffer, {
        "Content-Disposition": `attachment; filename="${exportResult.filename}"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "X-LAIQ-Approved-Sections": String(exportResult.approvalSummary.approvedCount),
        "X-LAIQ-Exported-Sections": String(exportResult.approvalSummary.exportedCount),
        "X-LAIQ-Pending-Sections": String(exportResult.approvalSummary.pendingCount),
      });
      return;
    }

    writeJson(response, 404, { error: `Route not found: ${request.method} ${pathname}` });
  } catch (error) {
    if (error instanceof ObjectStorageError) {
      writeJson(response, error.statusCode, {
        error: error.message,
        code: error.code,
      });
      return;
    }
    if (error instanceof FloorCorrosionError) {
      writeJson(response, error.statusCode, {
        error: error.message,
        code: error.code,
        ...(error.details ? { details: error.details } : {}),
      });
      return;
    }
    if (error instanceof ApiError) {
      writeJson(response, error.statusCode, {
        error: error.message,
        code: error.code,
      });
      return;
    }

    if (isDatabaseUnavailable(error)) {
      console.error("PostgreSQL is unavailable", error);
      writeJson(response, 503, {
        error: "The report service is temporarily unavailable because PostgreSQL cannot be reached.",
        code: "database_unavailable",
      });
      return;
    }

    console.error(error);
    writeJson(response, 500, {
      error: "Unexpected API failure.",
      code: "unexpected_api_failure",
    });
  }
});

function isDatabaseUnavailable(error) {
  const code = typeof error?.code === "string" ? error.code : "";
  const message = error instanceof Error ? error.message : "";
  return new Set([
    "57P01",
    "57P02",
    "57P03",
    "08000",
    "08001",
    "08003",
    "08004",
    "08006",
    "08007",
    "08P01",
    "ECONNREFUSED",
    "ECONNRESET",
  ]).has(code) || /connection terminated|connection timeout|database system is starting up/i.test(message);
}

server.listen(port, host, () => {
  console.log(`Report platform API listening on http://${host}:${port}`);
  console.log(`Seeded report job: ${seededState?.reportJob?.reportJobId ?? "unknown"}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    server.close(async () => {
      await reportStore.close();
      process.exit(0);
    });
  });
}

async function readJsonBody(
  request,
  maximumBytes = Number(process.env.REPORT_PLATFORM_MAX_JSON_BODY_BYTES || 25 * 1024 * 1024),
) {
  const chunks = [];
  let totalBytes = 0;

  const declaredLength = Number(request.headers["content-length"] || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new ApiError(413, "Request body is too large.", "request_body_too_large");
  }

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > maximumBytes) {
      throw new ApiError(413, "Request body is too large.", "request_body_too_large");
    }
    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError(400, "Request body must contain valid JSON.", "invalid_json");
  }
}

async function streamBinaryBodyToTemporaryFile(request, maximumBytes) {
  const declaredLength = Number(request.headers["content-length"] || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new ApiError(413, "Uploaded file is too large.", "upload_too_large");
  }

  const directory = await mkdtemp(join(tmpdir(), "laiq-report-upload-"));
  const path = join(directory, "upload.pdf");
  const handle = await open(path, "wx", 0o600);
  let totalBytes = 0;

  try {
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.length;
      if (totalBytes > maximumBytes) {
        throw new ApiError(413, "Uploaded file is too large.", "upload_too_large");
      }
      let offset = 0;
      while (offset < buffer.length) {
        const { bytesWritten } = await handle.write(buffer, offset, buffer.length - offset);
        if (bytesWritten <= 0) {
          throw new ApiError(500, "Uploaded file could not be written.", "upload_write_failed");
        }
        offset += bytesWritten;
      }
    }
    await handle.close();
    return {
      path,
      cleanup: () => rm(directory, { recursive: true, force: true }),
    };
  } catch (error) {
    await handle.close().catch(() => {});
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

async function hydrateFloorCorrosionReportState(state) {
  return {
    ...state,
    layoutOverrides: await Promise.all((state.layoutOverrides ?? []).map(async (override) => ({
      ...override,
      layoutMap: await floorCorrosionArtifacts.hydrateInlineArtifacts(
        state.reportJob.reportJobId,
        override.layoutMap,
      ),
    }))),
  };
}

async function cleanupSupersededFloorArtifactRun({ currentRunId, layoutMap, reportJobId }) {
  const previousRunId = layoutMap?.floorCorrosion?.artifactRunId
    ?? runIdFromFloorArtifactUri(layoutMap?.sourceDrawing?.artifactUri);
  if (!previousRunId || previousRunId === currentRunId) return;
  try {
    await floorCorrosionArtifacts.deleteArtifactRun({ reportJobId, runId: previousRunId });
  } catch (error) {
    console.error(`Unable to clean superseded floor artifact run ${previousRunId}`, error);
  }
}

function runIdFromFloorArtifactUri(value) {
  const match = /\/floor-corrosion\/artifacts\/([a-f0-9-]{36})\//i.exec(String(value ?? ""));
  return match?.[1] ?? null;
}

function writeJson(response, statusCode, payload) {
  const body = statusCode === 204 ? "" : JSON.stringify(payload);

  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(body);
}

function writeBinary(response, statusCode, payload, headers = {}) {
  response.writeHead(statusCode, {
    ...headers,
  });
  response.end(payload);
}

function readByteRange(value) {
  if (value == null || value === "") return undefined;
  const normalized = String(value).trim();
  if (!/^bytes=(?:\d+-\d*|-\d+)$/.test(normalized)) {
    throw new ApiError(416, "Only one valid PDF byte range may be requested.", "invalid_byte_range");
  }
  return normalized;
}

function inlineDisposition(fileName) {
  const safeName = String(fileName ?? "source-document")
    .replace(/[\r\n]/g, " ")
    .trim() || "source-document";
  return `inline; filename*=UTF-8''${encodeURIComponent(safeName)}`;
}

async function pipeObjectBody(body, response) {
  if (!body || typeof body.pipe !== "function") {
    throw new ApiError(502, "Object storage returned an unreadable source.", "object_stream_invalid");
  }
  try {
    await pipeline(body, response);
  } catch (error) {
    if (response.destroyed || response.writableEnded) return;
    throw error;
  }
}

async function authorizeReportJob(principal, reportJobId, permission) {
  const scope = await reportStore.getReportScope(reportJobId);
  if (!scope) {
    throw new ApiError(404, "Report job was not found.", "report_job_not_found");
  }
  authorizeWorkspacePermission(principal, scope, permission);
  authorizeReportOwnership(principal, scope);
  return scope;
}

async function loadAccountDemoReport(principal) {
  if (!demoDataEnabled) {
    throw new ApiError(404, "Demo report data is not enabled.", "demo_data_disabled");
  }

  const scopedFixture = buildAccountScopedDemoFixturePackage({
    bootstrapKey,
    exportPackage: fixtureExportPackage,
    principal,
  });
  if (!scopedFixture) {
    throw new ApiError(
      403,
      "This account is not assigned to a report workspace.",
      "workspace_membership_required",
    );
  }

  authorizeImportPackage(principal, scopedFixture.exportPackage);
  return reportStore.importAndroidV2ProductExport({
    actorUserId: principal.userId,
    bootstrapKey: scopedFixture.bootstrapKey,
    exportPackage: scopedFixture.exportPackage,
  });
}

async function loadAuthorizedReportState(principal, reportJobId, permission) {
  await authorizeReportJob(principal, reportJobId, permission);
  const state = await reportStore.loadReportJobState(reportJobId);
  if (!state) {
    throw new ApiError(404, "Report job was not found.", "report_job_not_found");
  }
  return withPrincipalContext(state, principal);
}

function withPrincipalContext(state, principal) {
  if (!state) return state;
  const activeMembership = principal.workspaceMemberships.find(
    (membership) => membership.workspaceId === state.reportJob?.workspaceId,
  );
  return {
    ...state,
    authorizationContext: {
      actorUserId: principal.userId,
      actorDisplayName: principal.displayName,
      roleLabel: activeMembership?.roles.join(", ") ?? principal.platformRoles.join(", "),
      tenantId: principal.tenantId,
      workspaceId: activeMembership?.workspaceId ?? principal.primaryWorkspaceId,
    },
  };
}

function bindAppExportToPrincipal({ exportPackage, principal, workspaceId }) {
  if (!exportPackage || typeof exportPackage !== "object" || Array.isArray(exportPackage)) {
    throw new ApiError(400, "A V3 export package is required.", "invalid_export_package");
  }
  const selectedWorkspaceId = String(workspaceId ?? principal.primaryWorkspaceId ?? "").trim();
  const membership = principal.workspaceMemberships.find(
    (candidate) => candidate.workspaceId === selectedWorkspaceId,
  );
  if (!membership) {
    throw new ApiError(
      403,
      "The signed-in app account is not assigned to the selected report workspace.",
      "app_workspace_denied",
    );
  }

  const originalIdentity = {
    exportedByUserId: exportPackage.exportedByUserId ?? null,
    tenantId: exportPackage.tenantId ?? null,
    workspaceId: exportPackage.workspaceId ?? null,
  };
  const normalized = structuredClone(exportPackage);
  normalized.tenantId = principal.tenantId;
  normalized.workspaceId = selectedWorkspaceId;
  normalized.exportedByUserId = principal.userId;
  normalized.profile = {
    ...(normalized.profile ?? {}),
    tenantId: principal.tenantId,
    tenantName: principal.tenantName,
    workspaceId: selectedWorkspaceId,
    workspaceName: membership.workspaceName,
    userId: principal.userId,
    displayName: principal.displayName,
    roleLabel: membership.roles[0] ?? "Inspector",
  };
  normalized.task = {
    ...(normalized.task ?? {}),
    tenantId: principal.tenantId,
    workspaceId: selectedWorkspaceId,
    createdByUserId: principal.userId,
    lastEditedByUserId: principal.userId,
  };
  normalized.reportPlatformIngestion = {
    boundAtIso: new Date().toISOString(),
    boundByUserId: principal.userId,
    originalIdentity,
  };
  return normalized;
}

function validateManagedUsername(value) {
  try {
    return validateUsername(value);
  } catch (error) {
    throw new ApiError(400, error.message, "username_invalid");
  }
}

async function completeAutomaticCaptureRoundTrips({ candidates, objectStorage, principal, reportStore }) {
  for (const variant of candidates) {
    const detail = await reportStore.getCaptureVariant(variant.variantId);
    if (!detail) continue;
    if (detail.variant.status === "materialized") {
      await reportStore.ensureCaptureVariantEvaluationCase({
        actorUserId: principal.userId,
        truthCaseId: variant.truthCaseId,
        variantId: variant.variantId,
        reportJobId: detail.variant.appReportJobId,
      });
      continue;
    }
    const manifest = detail.manifest;
    if (detail.variant.status === "review_required") {
      const scenarioBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
      const scenarioObjectKey = ["training-harness", "capture-variants", encodeURIComponent(variant.truthCaseId), encodeURIComponent(variant.variantId), "capture-scenario-v1.json"].join("/");
      const storedScenario = await objectStorage.putBuffer({ bytes: scenarioBytes, mediaType: "application/json", objectId: `capture-variant:${variant.variantId}:v1`, objectKey: scenarioObjectKey });
      await reportStore.approveCaptureVariant({ actorUserId: principal.userId, variantId: variant.variantId, scenarioObjectKey, scenarioSha256: storedScenario.sha256 });
    }
    let exportPackage;
    try {
      exportPackage = await materializeCaptureScenario({ scenario: manifest, principal });
    } catch (error) {
      throw new ApiError(500, `Automatic app round trip failed: ${error instanceof Error ? error.message : String(error)}`, "capture_variant_round_trip_failed");
    }
    const validationIssues = validateAndroidV3ProductExport(exportPackage);
    if (validationIssues.length > 0) {
      throw new ApiError(500, `App round trip returned an invalid V3 export. ${validationIssues.join(" ")}`, "capture_variant_round_trip_invalid");
    }
    const preservation = validateCaptureRoundTripPreservation(manifest, exportPackage);
    if (!preservation.passed) {
      throw new ApiError(
        500,
        `App round trip lost included mock evidence. ${preservation.issues.join(" ")}`,
        "capture_variant_preservation_failed",
      );
    }
    const exportBytes = Buffer.from(`${JSON.stringify(exportPackage, null, 2)}\n`, "utf8");
    const exportObjectKey = ["training-harness", "capture-variants", encodeURIComponent(variant.truthCaseId), encodeURIComponent(variant.variantId), "v3-product-export.json"].join("/");
    const storedExport = await objectStorage.putBuffer({ bytes: exportBytes, mediaType: "application/json", objectId: `capture-variant:${variant.variantId}:v3-product-export`, objectKey: exportObjectKey });
    const imported = await reportStore.importAndroidV2ProductExport({
      exportPackage,
      actorUserId: principal.userId,
      sourcePackageRef: { objectKey: exportObjectKey, byteSize: exportBytes.byteLength, sha256: storedExport.sha256, mediaType: "application/json" },
    });
    await reportStore.completeCaptureVariantRoundTrip({
      variantId: variant.variantId,
      appReportJobId: imported.reportJob.reportJobId,
      appSourceObjectKey: exportObjectKey,
      appSourceSha256: storedExport.sha256,
      appPackageSha256: storedExport.sha256,
      validation: { appOwnedAdapter: "android_v3_headless_v1", v3ContractValidated: true, preservation },
    });
    await reportStore.ensureCaptureVariantEvaluationCase({
      actorUserId: principal.userId,
      truthCaseId: variant.truthCaseId,
      variantId: variant.variantId,
      reportJobId: imported.reportJob.reportJobId,
    });
  }
}

function validateCaptureRoundTripPreservation(scenario, exportPackage) {
  const captures = Array.isArray(scenario?.captures) ? scenario.captures : [];
  const exportedFacts = new Map((exportPackage?.captureFacts ?? []).map((fact) => [fact.factId, fact]));
  const issues = [];
  for (const capture of captures) {
    const exported = exportedFacts.get(capture.factId);
    if (!exported) {
      issues.push(`${capture.factId}: included fact is absent from the V3 export.`);
      continue;
    }
    if (JSON.stringify(exported.value) !== JSON.stringify(capture.value)) issues.push(`${capture.factId}: value changed during app round trip.`);
    if (String(exported.unitCode ?? "") !== String(capture.unitCode ?? "")) issues.push(`${capture.factId}: unit changed during app round trip.`);
  }
  const exportedIds = new Set(exportedFacts.keys());
  const withheldLeakCount = (scenario?.withheldFacts ?? []).filter((fact) => exportedIds.has(fact.factId)).length;
  if (withheldLeakCount > 0) issues.push(`${withheldLeakCount} withheld fact(s) leaked into the V3 export.`);
  return {
    passed: issues.length === 0,
    includedFactCount: captures.length,
    preservedFactCount: captures.length - issues.filter((issue) => issue.includes(":" )).length,
    withheldLeakCount,
    issues: issues.slice(0, 20),
  };
}

async function runAutomaticHeldOutTest({ documentId, objectStorage, principal, reportStore }) {
  const initialLab = await reportStore.getEvaluationLabState();
  const selectedDocument = initialLab.documents.find((item) => item.documentId === documentId);
  if (!selectedDocument) throw new ApiError(404, "The selected hidden-test report was not found.", "held_out_document_missing");
  const trainingFamilyCounts = initialLab.evaluationCases
    .filter((item) => item.datasetSplit !== "hidden_test")
    .reduce((counts, item) => counts.set(item.reportFamily, (counts.get(item.reportFamily) ?? 0) + 1), new Map());
  const learnedReportFamily = [...trainingFamilyCounts].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
  if (learnedReportFamily && !heldOutReportFamiliesCompatible(learnedReportFamily, selectedDocument.reportFamily)) {
    throw new ApiError(
      409,
      `This policy learned ${learnedReportFamily} reports and cannot be tested as ${selectedDocument.reportFamily}. Use a matching report family or train a separate policy.`,
      "held_out_report_family_mismatch",
    );
  }
  const truth = await reportStore.createTruthCaseFromApprovedSource({
    actorUserId: principal.userId,
    documentId,
  });
  const truthCaseId = truth.truthCase.truthCaseId;
  if (truth.truthCase.datasetSplit !== "hidden_test") {
    throw new ApiError(409, "The selected new report must use the hidden_test dataset split.", "held_out_split_required");
  }
  if (truth.truthCase.status === "source_approved") {
    await reportStore.proposeTruthFacts({ actorUserId: principal.userId, trainingCaseId: truthCaseId });
  }
  if (truth.truthCase.status !== "case_approved") {
    await reportStore.acceptAutomatedTruthDraft({ actorUserId: principal.userId, trainingCaseId: truthCaseId });
    const truthManifest = await reportStore.buildTruthGraphManifest(truthCaseId);
    const truthBytes = Buffer.from(`${JSON.stringify(truthManifest, null, 2)}\n`, "utf8");
    const truthObjectKey = ["training-harness", "truth-cases", encodeURIComponent(truthCaseId), `truth-graph-v${truthManifest.truthGraphVersion}.json`].join("/");
    const storedTruth = await objectStorage.putBuffer({
      bytes: truthBytes,
      mediaType: "application/json",
      objectId: `truth-case:${truthCaseId}:v${truthManifest.truthGraphVersion}`,
      objectKey: truthObjectKey,
    });
    await reportStore.approveTruthCase({
      actorUserId: principal.userId,
      trainingCaseId: truthCaseId,
      truthGraphObjectKey: truthObjectKey,
      truthGraphSha256: storedTruth.sha256,
    });
  }
  const builder = await reportStore.getCaptureVariantBuilderState();
  const profiles = builder.profiles.filter((profile) => profile.lane === "faithful_capture");
  if (profiles.length === 0) throw new ApiError(409, "No faithful capture variation is available.", "held_out_profile_unavailable");
  let lab = await reportStore.getEvaluationLabState();
  const documentCases = lab.evaluationCases.filter((item) => item.goldDocumentId === documentId && item.reportJobId);
  let evaluationCase = documentCases.find((item) => item.nextSectionId)
    ?? [...documentCases].sort((left, right) => String(right.latestEvalAtIso ?? right.updatedAtIso).localeCompare(String(left.latestEvalAtIso ?? left.updatedAtIso)))[0];
  let variant = evaluationCase ? builder.variants.find((item) => item.variantId === evaluationCase.configuration?.captureVariantId) : null;
  if (!evaluationCase || !variant) {
    const entropy = Number.parseInt(randomUUID().replaceAll("-", "").slice(0, 8), 16);
    const profile = profiles[entropy % profiles.length];
    const seed = (entropy % 1_000_000) + 1;
    const generated = await reportStore.createCaptureVariants({ actorUserId: principal.userId, trainingCaseId: truthCaseId, profileCodes: [profile.profileCode], seeds: [seed] });
    variant = generated.variants.find((item) => item.truthCaseId === truthCaseId && item.profileCode === profile.profileCode && item.deterministicSeed === seed);
    if (!variant) throw new ApiError(500, "Automatic hidden-test mock data was not created.", "held_out_variant_missing");
    await completeAutomaticCaptureRoundTrips({ candidates: [variant], objectStorage, principal, reportStore });
    lab = await reportStore.getEvaluationLabState();
    evaluationCase = lab.evaluationCases.find((item) => item.configuration?.captureVariantId === variant.variantId);
  }
  if (!evaluationCase?.reportJobId) throw new ApiError(500, "Automatic hidden-test app round trip did not create an evaluation case.", "held_out_case_missing");
  let nextCase = evaluationCase;
  let lastResult = null;
  let completedSectionCount = 0;
  while (nextCase?.nextSectionId && completedSectionCount < 64) {
    lastResult = await reportStore.runSystemRlEvaluation({
      actorUserId: principal.userId,
      reportJobId: nextCase.reportJobId,
      sectionId: nextCase.nextSectionId,
      evaluationCaseId: nextCase.evaluationCaseId,
      frozenCandidate: true,
      userInstruction: "Generate this held-out section using the frozen candidate policy. Do not use golden-standard content.",
    });
    completedSectionCount += 1;
    const refreshed = await reportStore.getEvaluationLabState();
    nextCase = refreshed.evaluationCases.find((item) => item.evaluationCaseId === evaluationCase.evaluationCaseId);
  }
  return {
    ok: true,
    truthCaseId,
    variantId: variant.variantId,
    captureStyle: variant.profileDisplayName,
    variation: variant.deterministicSeed,
    evaluationCaseId: evaluationCase.evaluationCaseId,
    completedSectionCount,
    reward: lastResult?.reward ?? null,
  };
}

function heldOutReportFamiliesCompatible(learnedFamily, heldOutFamily) {
  const apiStandardFamilies = new Set(["profile_3d_scan", "api653_internal_external"]);
  return learnedFamily === heldOutFamily
    || (apiStandardFamilies.has(learnedFamily) && apiStandardFamilies.has(heldOutFamily));
}

async function hashManagedPassword(value) {
  try {
    return await hashPassword(value);
  } catch (error) {
    throw new ApiError(400, error.message, "password_invalid");
  }
}

function applyCorsHeaders(request, response) {
  const origin = request.headers.origin;
  if (!origin) return;

  const configuredOrigins = new Set(
    String(process.env.REPORT_PLATFORM_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const developmentMode = (process.env.NODE_ENV ?? "development") !== "production";
  if (!developmentMode && configuredOrigins.size === 0) {
    throw new ApiError(
      500,
      "Production CORS allowlist is not configured.",
      "cors_allowlist_not_configured",
    );
  }
  if (!developmentMode && !configuredOrigins.has(origin)) {
    throw new ApiError(403, "Request origin is not allowed.", "origin_not_allowed");
  }
  if (configuredOrigins.size > 0 && !configuredOrigins.has(origin)) {
    throw new ApiError(403, "Request origin is not allowed.", "origin_not_allowed");
  }

  response.setHeader("Access-Control-Allow-Credentials", "true");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Idempotency-Key");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
}
