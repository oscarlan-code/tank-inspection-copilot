import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ApiError, createReportStore } from "./store.mjs";
import { buildApiStandardFixturePackage } from "./api-standard-fixture.mjs";
import { buildFinalReportDocx } from "./docx-export.mjs";
import {
  createFloorCorrosionArtifactService,
  FloorCorrosionError,
} from "./floor-corrosion-artifacts.mjs";
import { getEffectiveLayoutMap } from "./layout-map-figure.mjs";
import { API_STANDARD_REPORT_TOC } from "./report-toc.mjs";
import { createAuthService } from "./auth/auth-service.mjs";
import {
  REPORT_PERMISSIONS,
  authorizeImportPackage,
  authorizePlatformPermission,
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
const databasePath = process.env.REPORT_PLATFORM_DB_PATH || join(appRoot, ".data", "report-platform.sqlite");
const port = Number(process.env.REPORT_PLATFORM_API_PORT || 8788);
const host = process.env.REPORT_PLATFORM_API_HOST || "0.0.0.0";
const bootstrapKey = "api-standard-v10";
const bootstrapPaths = new Set([
  "/api/v1/report-jobs/bootstrap/v10-api-standard",
  // Backward-compatible alias for any running UI opened before the V10 fixture was promoted.
  "/api/v1/report-jobs/bootstrap/shell-internal",
]);

const reportStore = createReportStore({ dbFilePath: databasePath });
const floorCorrosionArtifacts = createFloorCorrosionArtifactService({
  artifactRoot: process.env.REPORT_PLATFORM_ARTIFACT_ROOT || join(appRoot, ".data", "artifacts", "floor-corrosion"),
});
const fixtureExportPackage = buildApiStandardFixturePackage(JSON.parse(readFileSync(fixturePath, "utf8")));
const seededState = reportStore.ensureSeedReport({
  bootstrapKey,
  exportPackage: fixtureExportPackage,
});
const authService = createAuthService({ reportStore });

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
      });
      return;
    }

    if (request.method === "GET" && pathname === "/api/v1/auth/config") {
      writeJson(response, 200, authService.getPublicConfig());
      return;
    }

    if (request.method === "POST" && pathname === "/api/v1/auth/development-login") {
      const body = await readJsonBody(request);
      const session = authService.createDevelopmentSession(body.userId);
      response.setHeader("Set-Cookie", session.cookie);
      writeJson(response, 200, { principal: session.principal });
      return;
    }

    if (request.method === "POST" && pathname === "/api/v1/auth/logout") {
      response.setHeader("Set-Cookie", authService.revokeSession(request));
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
      const state = reportJobId
        ? loadAuthorizedReportState(principal, reportJobId, REPORT_PERMISSIONS.KB_SEARCH)
        : null;

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
        ? loadAuthorizedReportState(principal, reportJobId, REPORT_PERMISSIONS.READ)
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
      const state = reportJobId
        ? loadAuthorizedReportState(principal, reportJobId, REPORT_PERMISSIONS.KB_SEARCH)
        : null;
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
        ? loadAuthorizedReportState(principal, reportJobId, REPORT_PERMISSIONS.READ)
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
      const state = reportStore.loadBootstrapReport(bootstrapKey);
      if (!state?.reportJob?.reportJobId) {
        writeJson(response, 404, { error: "Bootstrap report job not found." });
        return;
      }
      authorizeReportJob(principal, state.reportJob.reportJobId, REPORT_PERMISSIONS.READ);
      writeJson(response, 200, state.exportPackage);
      return;
    }

    if (request.method === "GET" && bootstrapPaths.has(pathname)) {
      const state = reportStore.loadBootstrapReport(bootstrapKey);
      if (!state) {
        writeJson(response, 404, { error: "Bootstrap report job not found." });
        return;
      }

      authorizeReportJob(principal, state.reportJob.reportJobId, REPORT_PERMISSIONS.READ);
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
      const state = reportStore.importAndroidV2ProductExport({
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
      const state = loadAuthorizedReportState(principal, reportJobId, REPORT_PERMISSIONS.READ);
      writeJson(response, 200, state);
      return;
    }

    const evalRunsPath = pathname.match(/^\/api\/v1\/report-jobs\/([^/]+)\/evals$/);
    if (request.method === "GET" && evalRunsPath) {
      const reportJobId = decodeURIComponent(evalRunsPath[1]);
      authorizeReportJob(principal, reportJobId, REPORT_PERMISSIONS.READ);
      writeJson(response, 200, {
        reportJobId,
        evalRuns: reportStore.loadEvalRuns(reportJobId),
      });
      return;
    }

    const sectionEvalPath = pathname.match(/^\/api\/v1\/report-jobs\/([^/]+)\/sections\/([^/]+)\/evals\/latest$/);
    if (request.method === "GET" && sectionEvalPath) {
      const reportJobId = decodeURIComponent(sectionEvalPath[1]);
      const sectionId = decodeURIComponent(sectionEvalPath[2]);
      authorizeReportJob(principal, reportJobId, REPORT_PERMISSIONS.READ);
      const evalRun = reportStore.loadLatestEvalRun(reportJobId, sectionId);
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
      authorizeReportJob(principal, reportJobId, REPORT_PERMISSIONS.EDIT);
      const body = await readJsonBody(request);
      const state = reportStore.saveManualInputs(reportJobId, body.values ?? {});
      writeJson(response, 200, withPrincipalContext(state, principal));
      return;
    }

    const resetDraftsPath = pathname.match(/^\/api\/v1\/report-jobs\/([^/]+)\/reset-drafts$/);
    if (request.method === "POST" && resetDraftsPath) {
      const reportJobId = decodeURIComponent(resetDraftsPath[1]);
      authorizeReportJob(principal, reportJobId, REPORT_PERMISSIONS.EDIT);
      const state = reportStore.resetReportDrafts(reportJobId);
      writeJson(response, 200, withPrincipalContext(state, principal));
      return;
    }

    const sectionPath = pathname.match(/^\/api\/v1\/report-jobs\/([^/]+)\/sections\/([^/]+)$/);
    if (request.method === "PATCH" && sectionPath) {
      const reportJobId = decodeURIComponent(sectionPath[1]);
      const sectionId = decodeURIComponent(sectionPath[2]);
      authorizeReportJob(principal, reportJobId, REPORT_PERMISSIONS.EDIT);
      const body = await readJsonBody(request);
      const state = reportStore.saveSectionDraft(reportJobId, sectionId, body);
      writeJson(response, 200, withPrincipalContext(state, principal));
      return;
    }

    const generatePath = pathname.match(/^\/api\/v1\/report-jobs\/([^/]+)\/sections\/([^/]+)\/generate$/);
    if (request.method === "POST" && generatePath) {
      const reportJobId = decodeURIComponent(generatePath[1]);
      const sectionId = decodeURIComponent(generatePath[2]);
      authorizeReportJob(principal, reportJobId, REPORT_PERMISSIONS.GENERATE);
      const body = await readJsonBody(request);
      const state = await reportStore.generateSection(reportJobId, sectionId, {
        actorUserId: principal.userId,
        userInstruction: body.userInstruction ?? body.instruction ?? "",
      });
      writeJson(response, 200, withPrincipalContext(state, principal));
      return;
    }

    const chatPath = pathname.match(/^\/api\/v1\/report-jobs\/([^/]+)\/sections\/([^/]+)\/chat$/);
    if (request.method === "POST" && chatPath) {
      const reportJobId = decodeURIComponent(chatPath[1]);
      const sectionId = decodeURIComponent(chatPath[2]);
      authorizeReportJob(principal, reportJobId, REPORT_PERMISSIONS.GENERATE);
      const body = await readJsonBody(request);
      const reply = await reportStore.replyToSectionChat(reportJobId, sectionId, {
        userPrompt: body.userPrompt ?? body.prompt ?? "",
        conversationHistory: body.conversationHistory ?? body.history ?? [],
      });
      writeJson(response, 200, reply);
      return;
    }

    const restoreSectionPath = pathname.match(/^\/api\/v1\/report-jobs\/([^/]+)\/sections\/([^/]+)\/restore-previous$/);
    if (request.method === "POST" && restoreSectionPath) {
      const reportJobId = decodeURIComponent(restoreSectionPath[1]);
      const sectionId = decodeURIComponent(restoreSectionPath[2]);
      authorizeReportJob(principal, reportJobId, REPORT_PERMISSIONS.EDIT);
      const body = await readJsonBody(request);
      const state = reportStore.restorePreviousSectionDraft(reportJobId, sectionId, {
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
      authorizeReportJob(principal, reportJobId, REPORT_PERMISSIONS.EDIT);
      const body = await readJsonBody(request);
      const state = reportStore.saveLayoutOverride(reportJobId, sectionId, body.layoutMap);
      writeJson(response, 200, withPrincipalContext(state, principal));
      return;
    }

    const floorCorrosionImportPath = pathname.match(/^\/api\/v1\/report-jobs\/([^/]+)\/floor-corrosion\/mfl-import$/);
    if (request.method === "POST" && floorCorrosionImportPath) {
      const reportJobId = decodeURIComponent(floorCorrosionImportPath[1]);
      const state = loadAuthorizedReportState(principal, reportJobId, REPORT_PERMISSIONS.EDIT);
      const sectionId = requestUrl.searchParams.get("sectionId") ?? "floor-plate-corrosion-plan";
      const tocSection = API_STANDARD_REPORT_TOC.find((section) => section.id === sectionId);
      if (!tocSection || tocSection.layoutSurface !== "floor") {
        throw new ApiError(400, "Floor corrosion import requires a floor layout section.", "floor_corrosion_section_invalid");
      }
      if (!/^application\/pdf(?:;|$)/i.test(String(request.headers["content-type"] ?? ""))) {
        throw new ApiError(415, "MFL import requires application/pdf content.", "mfl_content_type_invalid");
      }
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
      const pdfBuffer = await readBinaryBody(request, 100 * 1024 * 1024);
      const importResult = floorCorrosionArtifacts.importMflPdf({
        reportJobId,
        layoutMap,
        pdfBuffer,
        sourceDocumentName: requestUrl.searchParams.get("fileName") ?? "MFL plate maps.pdf",
      });
      const updatedState = reportStore.saveLayoutOverride(reportJobId, sectionId, importResult.layoutMap);
      writeJson(response, 201, {
        ...withPrincipalContext(updatedState, principal),
        floorCorrosionImportSummary: importResult.summary,
      });
      return;
    }

    const floorLayoutImportPath = pathname.match(/^\/api\/v1\/report-jobs\/([^/]+)\/floor-corrosion\/layout-import$/);
    if (request.method === "POST" && floorLayoutImportPath) {
      const reportJobId = decodeURIComponent(floorLayoutImportPath[1]);
      const state = loadAuthorizedReportState(principal, reportJobId, REPORT_PERMISSIONS.EDIT);
      const sectionId = requestUrl.searchParams.get("sectionId") ?? "floor-plate-corrosion-plan";
      const tocSection = API_STANDARD_REPORT_TOC.find((section) => section.id === sectionId);
      if (!tocSection || tocSection.layoutSurface !== "floor") {
        throw new ApiError(400, "Floor layout import requires a floor layout section.", "floor_layout_section_invalid");
      }
      if (!/^application\/pdf(?:;|$)/i.test(String(request.headers["content-type"] ?? ""))) {
        throw new ApiError(415, "Floor layout import requires application/pdf content.", "floor_layout_content_type_invalid");
      }
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
      const pdfBuffer = await readBinaryBody(request, 100 * 1024 * 1024);
      const importResult = floorCorrosionArtifacts.importLayoutPdf({
        reportJobId,
        pdfBuffer,
        sourceDocumentName: requestUrl.searchParams.get("fileName") ?? "Floor layout.pdf",
        sourcePage: Number(requestUrl.searchParams.get("page") ?? 1),
        client: state.exportPackage?.task?.client ?? "Pending confirmation",
        tank: state.exportPackage?.task?.tankNumber ?? "Pending confirmation",
        reference: state.reportJob?.reportReference ?? "Pending confirmation",
      });
      const updatedState = reportStore.saveLayoutOverride(reportJobId, sectionId, importResult.layoutMap);
      writeJson(response, 201, {
        ...withPrincipalContext(updatedState, principal),
        floorLayoutImportSummary: importResult.summary,
      });
      return;
    }

    const floorCorrosionPlacementPath = pathname.match(/^\/api\/v1\/report-jobs\/([^/]+)\/floor-corrosion\/placements$/);
    if (request.method === "PATCH" && floorCorrosionPlacementPath) {
      const reportJobId = decodeURIComponent(floorCorrosionPlacementPath[1]);
      const state = loadAuthorizedReportState(principal, reportJobId, REPORT_PERMISSIONS.EDIT);
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
      const updatedState = reportStore.saveLayoutOverride(reportJobId, sectionId, updatedLayoutMap);
      writeJson(response, 200, withPrincipalContext(updatedState, principal));
      return;
    }

    const floorCorrosionArtifactPath = pathname.match(/^\/api\/v1\/report-jobs\/([^/]+)\/floor-corrosion\/artifacts\/([^/]+)\/([^/]+)$/);
    if (request.method === "GET" && floorCorrosionArtifactPath) {
      const reportJobId = decodeURIComponent(floorCorrosionArtifactPath[1]);
      authorizeReportJob(principal, reportJobId, REPORT_PERMISSIONS.READ);
      const buffer = floorCorrosionArtifacts.readArtifact({
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
      authorizeReportJob(principal, reportJobId, REPORT_PERMISSIONS.APPROVE);
      const body = await readJsonBody(request);
      const state = reportStore.approveSection(reportJobId, sectionId, {
        ...body,
        actorUserId: principal.userId,
      });
      writeJson(response, 200, withPrincipalContext(state, principal));
      return;
    }

    const docxExportPath = pathname.match(/^\/api\/v1\/report-jobs\/([^/]+)\/exports\/final-report\.docx$/);
    if ((request.method === "GET" || request.method === "POST") && docxExportPath) {
      const reportJobId = decodeURIComponent(docxExportPath[1]);
      const state = loadAuthorizedReportState(principal, reportJobId, REPORT_PERMISSIONS.EXPORT);

      const body = request.method === "POST" ? await readJsonBody(request) : {};
      let exportResult;
      try {
        exportResult = await buildFinalReportDocx(hydrateFloorCorrosionReportState(state), {
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

    console.error(error);
    writeJson(response, 500, {
      error: "Unexpected API failure.",
      code: "unexpected_api_failure",
    });
  }
});

server.listen(port, host, () => {
  console.log(`Report platform API listening on http://${host}:${port}`);
  console.log(`Seeded report job: ${seededState?.reportJob?.reportJobId ?? "unknown"}`);
});

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function readBinaryBody(request, maximumBytes) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > maximumBytes) {
      throw new ApiError(413, "Uploaded file is too large.", "upload_too_large");
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function hydrateFloorCorrosionReportState(state) {
  return {
    ...state,
    layoutOverrides: (state.layoutOverrides ?? []).map((override) => ({
      ...override,
      layoutMap: floorCorrosionArtifacts.hydrateInlineArtifacts(
        state.reportJob.reportJobId,
        override.layoutMap,
      ),
    })),
  };
}

function writeJson(response, statusCode, payload) {
  const body = statusCode === 204 ? "" : JSON.stringify(payload);

  response.writeHead(statusCode, {
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

function authorizeReportJob(principal, reportJobId, permission) {
  const scope = reportStore.getReportScope(reportJobId);
  if (!scope) {
    throw new ApiError(404, "Report job was not found.", "report_job_not_found");
  }
  authorizeWorkspacePermission(principal, scope, permission);
  return scope;
}

function loadAuthorizedReportState(principal, reportJobId, permission) {
  authorizeReportJob(principal, reportJobId, permission);
  const state = reportStore.loadReportJobState(reportJobId);
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
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
}
