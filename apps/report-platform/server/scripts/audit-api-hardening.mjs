import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { hashPassword } from "../auth/password-auth.mjs";
import { createReportStore } from "../store.mjs";

const { Client } = pg;

const appRoot = new URL("../..", import.meta.url).pathname;
const tempDir = mkdtempSync(join(tmpdir(), "laiq-report-platform-api-"));
const port = 19000 + Math.floor(Math.random() * 1000);
const baseUrl = `http://127.0.0.1:${port}`;
const auditPassword = "Audit-only-Password-653!";
const auditAccounts = {
  clientViewer: { userId: "demo-client-viewer", username: "client-viewer.audit" },
  inspector: { userId: "user-demo-inspector", username: "inspector.audit" },
  isolatedInspector: { userId: "demo-isolated-inspector", username: "isolated-inspector.audit" },
  reviewer: { userId: "demo-reviewer", username: "reviewer.audit" },
  superAdmin: { userId: "demo-super-admin", username: "super-admin.audit" },
};
const sourceDatabaseUrl = process.env.REPORT_PLATFORM_TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!sourceDatabaseUrl) {
  throw new Error(
    "DATABASE_URL or REPORT_PLATFORM_TEST_DATABASE_URL is required for the PostgreSQL API audit.",
  );
}
const testSchema = await createAuditSchema(sourceDatabaseUrl);
let serverOutput = "";
let activeCookie = "";
let server = startAuditServer();

try {
  await waitForHealth();
  const bootstrapStore = await createReportStore({ databaseUrl: testSchema.url });
  try {
    const initialAdmin = await bootstrapStore.bootstrapInitialSuperAdmin({
      displayName: "Initial Audit Administrator",
      passwordHash: await hashPassword("Initial-Audit-Administrator-653!"),
      tenantId: "tenant-initial-audit",
      tenantName: "Initial Audit Tenant",
      userId: "initial-audit-super-admin",
      usernameNormalized: "initial.admin.audit",
      workspaceId: "workspace-initial-audit",
      workspaceName: "Initial Audit Workspace",
    });
    if (initialAdmin.roleLabel !== "Super Admin") {
      throw new Error("Initial account bootstrap did not create a Super Admin.");
    }
    try {
      await bootstrapStore.bootstrapInitialSuperAdmin({
        displayName: "Second Administrator",
        passwordHash: await hashPassword("Second-Audit-Administrator-653!"),
        tenantId: "tenant-second-audit",
        tenantName: "Second Audit Tenant",
        usernameNormalized: "second.admin.audit",
        workspaceId: "workspace-second-audit",
        workspaceName: "Second Audit Workspace",
      });
      throw new Error("Initial Super Admin bootstrap ran more than once.");
    } catch (error) {
      if (error?.code !== "initial_admin_already_exists") throw error;
    }
  } finally {
    await bootstrapStore.close();
  }
  await provisionAuditAccounts(testSchema.url);

  const unauthenticatedBootstrap = await requestJson("/api/v1/report-jobs/bootstrap/v10-api-standard", {
    cookie: null,
  });
  assertStatus(unauthenticatedBootstrap, 401, "bootstrap requires authentication");

  const authConfig = await requestJson("/api/v1/auth/config", { cookie: null });
  assertStatus(authConfig, 200, "load authentication configuration");
  if (authConfig.body.mode !== "password" || "developmentUsers" in authConfig.body) {
    throw new Error("Authentication configuration must expose only the password login mode.");
  }
  const malformedLogin = await requestRaw("/api/v1/auth/login", {
    body: "{not-valid-json",
    contentType: "application/json",
    method: "POST",
  });
  assertStatus(malformedLogin, 400, "malformed JSON returns a controlled client error");
  if (JSON.parse(malformedLogin.body).code !== "invalid_json") {
    throw new Error("Malformed JSON did not return the invalid_json error code.");
  }
  const invalidLogin = await loginAs(
    { userId: "invalid", username: "unknown.audit" },
    "incorrect-password",
    401,
  );
  if (invalidLogin !== null) {
    throw new Error("Invalid password login unexpectedly returned a session cookie.");
  }
  const inspector = auditAccounts.inspector;
  const reviewer = auditAccounts.reviewer;
  const clientViewer = auditAccounts.clientViewer;
  const superAdmin = auditAccounts.superAdmin;
  const isolatedInspector = auditAccounts.isolatedInspector;
  activeCookie = await loginAs(inspector);

  const genericCaseId = "eval-generic-syn025-v3-tk5452";
  const genericReviewPath = `/api/v1/admin/system-rl/held-out-review?evaluationCaseId=${genericCaseId}&sectionId=identity`;
  const genericSourcePath = `/api/v1/admin/generic-outline-reviews/${genericCaseId}/source`;
  assertStatus(await requestJson(genericReviewPath, { cookie: null }), 401, "generic saved review requires authentication");
  assertStatus(await requestJson(genericReviewPath), 403, "inspector cannot access admin-only generic review");
  assertStatus(await requestJson(genericSourcePath, { cookie: null }), 401, "generic original PDF requires authentication");
  assertStatus(await requestJson(genericSourcePath), 403, "inspector cannot read generic original PDF");
  const kbComparisonCases = ['eval-tk5452-kb-ablation-v1-without-kb', 'eval-tk5452-kb-ablation-v1-with-kb'];
  const observationComparisonCases = ['eval-tk5452-kb-observations-v1-without-kb', 'eval-tk5452-kb-observations-v1-with-kb'];
  const generalInformationCases = ['eval-general-info-v1-gti-01', 'eval-general-info-v1-gti-11'];
  for (const id of generalInformationCases) {
    const path = `/api/v1/admin/system-rl/held-out-review?evaluationCaseId=${id}&sectionId=general-tank-information`;
    assertStatus(await requestJson(path, { cookie: null }), 401, 'Section-agent review requires authentication');
    assertStatus(await requestJson(path), 403, 'Section-agent review requires super-admin role');
    assertStatus(await requestJson(`/api/v1/admin/generic-outline-reviews/${id}/source`), 403, 'Section-agent source requires super-admin role');
  }
  for (const id of observationComparisonCases) {
    const path = `/api/v1/admin/system-rl/held-out-review?evaluationCaseId=${id}&sectionId=02-floor-projection`;
    assertStatus(await requestJson(path, { cookie: null }), 401, 'Observation comparison requires authentication');
    assertStatus(await requestJson(path), 403, 'Observation comparison requires super-admin role');
  }
  for (const id of kbComparisonCases) {
    const path = `/api/v1/admin/system-rl/held-out-review?evaluationCaseId=${id}&sectionId=01-scope`;
    assertStatus(await requestJson(path, { cookie: null }), 401, 'KB comparison requires authentication');
    assertStatus(await requestJson(path), 403, 'Inspector cannot access admin KB comparison');
  }

  const bootstrap = await requestJson("/api/v1/report-jobs/bootstrap/v10-api-standard");
  assertStatus(bootstrap, 200, "bootstrap report job");

  let reportJobId = bootstrap.body.reportJob.reportJobId;
  const actorUserId = bootstrap.body.authorizationContext.actorUserId;
  if (actorUserId !== inspector.userId) {
    throw new Error(`Expected authenticated actor ${inspector.userId}, received ${actorUserId}.`);
  }

  const planningPath = `/api/v1/report-jobs/${reportJobId}/section-plans`;
  const decisionsPath = `/api/v1/report-jobs/${reportJobId}/classification-decisions`;
  assertStatus(await requestJson(planningPath, { cookie: null }), 401, "section plans require authentication");
  assert.ok(!bootstrap.body.sectionPlanning, "Ordinary report loading does not activate candidate outline planning");
  for (const [path, method] of [[planningPath, "GET"], [decisionsPath, "POST"], [`/api/v1/report-jobs/${reportJobId}/classification-runs`, "POST"]]) {
    const unlinked = await requestJson(path, { method, ...(method === "POST" ? { body: { evaluationMode: true, sourceReportJobId: reportJobId } } : {}) });
    assertStatus(unlinked, 409, "candidate outline review requires a trusted evaluation case");
    assert.equal(unlinked.body.code, "outline_evaluation_only", "Request flags cannot opt an ordinary report into candidate planning");
  }
  await linkIsolatedOutlineEvaluation(testSchema.url, reportJobId, inspector.userId);
  const initialPlanning = await requestJson(planningPath);
  assertStatus(initialPlanning, 200, "inspector can read canonical section plans");
  if (!initialPlanning.body.snapshotId || !Array.isArray(initialPlanning.body.evidenceRecords) || !Array.isArray(initialPlanning.body.sectionPlans)) {
    throw new Error("Section-planning response omitted its immutable snapshot, canonical evidence, or section plans.");
  }
  assert.equal(initialPlanning.body.sectionPlans.length, 32, "Section review exposes the complete 32-section report outline");
  for (const plan of initialPlanning.body.sectionPlans) {
    assert.ok(plan.catalog.templateKey && plan.catalog.templateSource, `${plan.sectionId}: outline identifies its report template`);
    assert.ok(plan.catalog.slots.length > 0, `${plan.sectionId}: outline contains reviewable content blocks`);
    for (const slot of plan.catalog.slots) {
      assert.ok(slot.title && slot.purpose && slot.presentation && Array.isArray(slot.evidenceRules), `${plan.sectionId}/${slot.slotKey}: outline exposes content, presentation and evidence-matching rules`);
    }
  }
  const sourcePackageHash = sha256(JSON.stringify(bootstrap.body.exportPackage));
  const identityRecord = initialPlanning.body.evidenceRecords.find((record) => record.kind === "identity" && record.payload.fieldKey === "client");
  if (!identityRecord) throw new Error("Section-planning audit requires the native client identity record.");
  const identityUse = initialPlanning.body.sectionPlans.find((plan) => plan.sectionId === "general-tank-information")?.evidenceUses.find((use) => use.evidenceIds.includes(identityRecord.evidenceId) && use.slotKey === "identity" && use.role === "required_structured");
  assert.ok(identityUse, "Client identity must have an existing assignment to confirm independently");
  const classificationDecision = {
    operation: "update", useId: identityUse.useId,
    evidenceId: identityRecord.evidenceId,
    sectionId: "general-tank-information", slotKey: "identity", role: "required_structured",
    reason: "Verify native client identity placement in the isolated API audit.",
    actorId: "forged-reviewer",
  };
  const decisionBody = { expectedSnapshotId: initialPlanning.body.snapshotId, decision: classificationDecision };
  assertStatus(await requestJson(decisionsPath, { method: "POST", cookie: null, body: decisionBody }), 401, "classification decisions require authentication");
  const planningViewerCookie = await loginAs(clientViewer);
  assertStatus(await requestJson(decisionsPath, { method: "POST", cookie: planningViewerCookie, body: decisionBody }), 403, "client viewer cannot change classification");
  const planningIsolatedCookie = await loginAs(isolatedInspector);
  assertStatus(await requestJson(planningPath, { cookie: planningIsolatedCookie }), 403, "section plans enforce tenant scope");
  assertStatus(await requestJson(decisionsPath, { method: "POST", cookie: planningIsolatedCookie, body: decisionBody }), 403, "classification decisions enforce tenant scope");
  assertStatus(await requestJson(decisionsPath, { method: "POST", body: { ...decisionBody, decision: { ...classificationDecision, value: "Forbidden source rewrite" } } }), 400, "classification cannot mutate source values");
  assertStatus(await requestJson(decisionsPath, { method: "POST", body: { ...decisionBody, decision: { ...classificationDecision, evidenceId: "foreign-evidence-id" } } }), 400, "classification rejects evidence outside the snapshot");
  const { operation: _operation, useId: _useId, ...legacyDecision } = classificationDecision;
  const missingOperation = await requestJson(decisionsPath, { method: "POST", body: { ...decisionBody, decision: legacyDecision } });
  assertStatus(missingOperation, 400, "new classification requests cannot enter legacy replay behavior");
  assert.equal(missingOperation.body.code, "section_decision_invalid", "New use edits require an explicit operation");
  const acceptedClassification = await requestJson(decisionsPath, { method: "POST", body: decisionBody });
  assertStatus(acceptedClassification, 200, "inspector can confirm a valid section classification");
  if (acceptedClassification.body.snapshotId === initialPlanning.body.snapshotId) throw new Error("Classification confirmation did not create a new immutable snapshot.");
  const reviewedIdentity = acceptedClassification.body.evidenceRecords.find((record) => record.evidenceId === identityRecord.evidenceId);
  if (reviewedIdentity?.reviewDecision?.actorId !== inspector.userId) throw new Error("Classification actor was not derived from the authenticated inspector.");
  assertStatus(await requestJson(decisionsPath, { method: "POST", body: decisionBody }), 409, "classification rejects a stale snapshot");
  const afterClassification = await requestJson(`/api/v1/report-jobs/${reportJobId}`);
  assertStatus(afterClassification, 200, "reload report after classification");
  if (sha256(JSON.stringify(afterClassification.body.exportPackage)) !== sourcePackageHash) throw new Error("Classification changed immutable imported app evidence.");
  assert.ok(!afterClassification.body.sectionPlanning, "Candidate classification does not change ordinary report loading");
  const savedClassification = await requestJson(planningPath);
  assertStatus(savedClassification, 200, "reload persisted evaluation classification");
  assert.equal(savedClassification.body.snapshotId, acceptedClassification.body.snapshotId, "Saved evaluation classification survives reload");
  await auditEvidenceUseEditing({
    reportJobId, planning: acceptedClassification.body, evidenceId: identityRecord.evidenceId,
    sourcePackageHash, actorUserId: inspector.userId,
    viewerCookie: planningViewerCookie, isolatedCookie: planningIsolatedCookie,
  });
  await auditOutlineEvaluationIsolation(reportJobId, await loginAs(superAdmin));
  await unlinkIsolatedOutlineEvaluation(testSchema.url, reportJobId);

  const inspectorAdminDenied = await requestJson("/api/v1/admin/accounts");
  assertStatus(inspectorAdminDenied, 403, "inspector cannot manage accounts");
  const inspectorSystemRlDenied = await requestJson("/api/v1/admin/system-rl/status");
  assertStatus(inspectorSystemRlDenied, 403, "inspector cannot access system RL controls");
  const inspectorCaptureVariantsDenied = await requestJson("/api/v1/admin/capture-variants");
  assertStatus(inspectorCaptureVariantsDenied, 403, "inspector cannot access Capture Variant controls");
  const inspectorKbReviewDenied = await requestJson("/api/v1/admin/kb-review/cases");
  assertStatus(inspectorKbReviewDenied, 403, "inspector cannot access KB ingestion review");

  activeCookie = await loginAs(superAdmin);
  const kbReviewQueue = await requestJson("/api/v1/admin/kb-review/cases");
  assertStatus(kbReviewQueue, 200, "super admin can access KB ingestion review");
  const initialSystemRlStatus = await requestJson("/api/v1/admin/system-rl/status");
  assertStatus(initialSystemRlStatus, 200, "super admin can inspect system RL policies");
  const genericReview = await requestJson(genericReviewPath);
  assertStatus(genericReview, 200, "existing comparison endpoint serves generic backend results");
  assert.equal(genericReview.body.evaluationOnly, true);
  assert.equal(genericReview.body.sections.length, 12);
  assert.equal(genericReview.body.sectionId, "identity");
  assert.equal(genericReview.body.promotionGate.eligible, false);
  assert.equal(genericReview.body.metrics, undefined, "unmatched historical reference cannot produce recovery scores");
  assert.ok(genericReview.body.generatedContent.includes("SYN-025"));
  const genericNext = await requestJson("/api/v1/admin/system-rl/held-out-section", {
    method: "POST", body: { evaluationCaseId: genericCaseId, sectionId: "regime" },
  });
  assertStatus(genericNext, 200, "existing navigation returns the evaluated no-AI regime");
  assert.equal(genericNext.body.sectionId, "regime");
  assert.ok(genericNext.body.diagnosticNotes.some(note => /template/i.test(note)));
  assertStatus(await requestJson(`${genericReviewPath}&evalRunId=unrelated-run`), 404, "generic review cannot silently substitute another run");
  assertStatus(await requestJson(`/api/v1/admin/system-rl/held-out-review?evaluationCaseId=${genericCaseId}&sectionId=unknown`), 404, "unknown generic section is rejected");
  const genericSource = await requestRaw(genericSourcePath);
  assertStatus(genericSource, 200, "super admin can preview the mapped original PDF");
  assert.ok(genericSource.body.startsWith("%PDF-"));
  for (const id of generalInformationCases) {
    const path = `/api/v1/admin/system-rl/held-out-review?evaluationCaseId=${id}&sectionId=general-tank-information`;
    const saved = await requestJson(path);
    assertStatus(saved, 200, 'Section agent uses existing saved comparison endpoint');
    assert.equal(saved.body.sections.length, 11);
    assert.equal(saved.body.appEvidence.length, 31);
    assert.equal(saved.body.promotionGate.eligible, false);
    assert.equal(saved.body.metrics.protectedFactAccuracy, 1);
    assert.equal(saved.body.datasetSplit, id.endsWith('11') ? 'hidden_test' : 'development');
    assertStatus(await requestJson(`${path}&evalRunId=wrong-run`), 404, 'Section agent rejects mismatched saved run');
    assertStatus(await requestJson(`/api/v1/admin/system-rl/held-out-review?evaluationCaseId=${id}&sectionId=inspection-report`), 404, 'Section agent rejects an unrelated section');
    const next = await requestJson('/api/v1/admin/system-rl/held-out-section', { method: 'POST', body: { evaluationCaseId: id, sectionId: 'general-tank-information' } });
    assertStatus(next, 200, 'Section agent navigation only reads saved results');
    assert.equal(next.body.evalRunId, saved.body.evalRunId);
    assertStatus(await requestRaw(`/api/v1/admin/generic-outline-reviews/${id}/source`), 200, 'Admin can preview section-agent original PDF');
  }
  for (const id of kbComparisonCases) {
    const saved = await requestJson(`/api/v1/admin/system-rl/held-out-review?evaluationCaseId=${id}&sectionId=01-scope`);
    assertStatus(saved, 200, 'Admin can load saved KB comparison');
    assert.equal(saved.body.sections.length, 2);
    assert.equal(saved.body.promotionGate.eligible, false);
    assert.ok(saved.body.aiCandidateContent);
    const next = await requestJson('/api/v1/admin/system-rl/held-out-section', { method: 'POST', body: { evaluationCaseId: id, sectionId: '05-recommendations' } });
    assertStatus(next, 200, 'KB comparison section navigation reads saved results');
    assert.equal(next.body.comparisonExperiment.arm, id.endsWith('without-kb') ? 'without_kb' : 'with_kb');
    assertStatus(await requestJson(`/api/v1/admin/system-rl/held-out-review?evaluationCaseId=${id}&sectionId=unknown`), 404, 'Unknown comparison section rejected');
  }
  const genericPolicyAfter = await requestJson("/api/v1/admin/system-rl/status");
  for (const id of observationComparisonCases) {
    const saved = await requestJson(`/api/v1/admin/system-rl/held-out-review?evaluationCaseId=${id}&sectionId=02-floor-projection`);
    assertStatus(saved, 200, 'Admin can load saved observation comparison');
    assert.equal(saved.body.sections.length, 12);
    assert.equal(saved.body.promotionGate.eligible, false);
    assert.equal(saved.body.rawAiResponse.accepted, false);
    assert.ok(saved.body.aiCandidateContent.includes('Floor projection'));
    const next = await requestJson('/api/v1/admin/system-rl/held-out-section', { method: 'POST', body: { evaluationCaseId: id, sectionId: '10-tell-tales' } });
    assertStatus(next, 200, 'Observation navigation loads saved proposals');
    assert.equal(next.body.comparisonExperiment.reviewOnlyProposals, true);
    assertStatus(await requestJson(`/api/v1/admin/system-rl/held-out-review?evaluationCaseId=${id}&sectionId=unknown`), 404, 'Unknown observation rejected');
    assertStatus(await requestJson(`/api/v1/admin/system-rl/held-out-review?evaluationCaseId=${id}&sectionId=02-floor-projection&evalRunId=wrong`), 404, 'Wrong observation run rejected');
  }
  assert.deepEqual((await requestJson('/api/v1/admin/system-rl/status')).body.policies, genericPolicyAfter.body.policies, 'Observation navigation does not mutate policies');
  assert.deepEqual(genericPolicyAfter.body.policies, initialSystemRlStatus.body.policies, "generic comparison navigation does not update policy state");
  const captureVariantBuilder = await requestJson("/api/v1/admin/capture-variants");
  assertStatus(captureVariantBuilder, 200, "super admin can inspect Capture Variant state");
  if (!Array.isArray(captureVariantBuilder.body.profiles) || captureVariantBuilder.body.profiles.length !== 8) {
    throw new Error("Capture Variant API did not expose the eight active faithful profile presets.");
  }
  if (captureVariantBuilder.body.profiles.some((profile) => profile.lane !== "faithful_capture")) {
    throw new Error("Default Capture Variant profiles must remain in the faithful-capture lane.");
  }
  const trainingPolicy = initialSystemRlStatus.body.policies.find(
    (policy) => policy.statusCode === "training",
  );
  const productionPolicy = initialSystemRlStatus.body.policies.find(
    (policy) => policy.statusCode === "production",
  );
  if (!trainingPolicy || !productionPolicy || trainingPolicy.arms.length < 2) {
    throw new Error("System RL policy registry did not seed production and multi-arm training policies.");
  }
  const systemRlEpisode = await requestJson("/api/v1/admin/system-rl/episodes", {
    method: "POST",
    body: {
      reportJobId,
      sectionId: "scope-of-inspection",
      userInstruction: "API hardening offline system RL episode.",
    },
  });
  assertStatus(systemRlEpisode, 201, "super admin runs an offline system RL episode");
  if (
    systemRlEpisode.body.persistedAsReportDraft !== false
    || systemRlEpisode.body.policyDecision?.mode !== "offline_evaluation"
    || systemRlEpisode.body.reward?.learningEligible !== false
    || systemRlEpisode.body.reward?.value !== null
    || systemRlEpisode.body.reward?.metrics?.runPurpose !== "frozen_diagnostic"
    || systemRlEpisode.body.reward?.metrics?.promotionEvidenceEligible !== false
    || systemRlEpisode.body.reward?.metrics?.retrievalLabelsAvailable !== true
    || !Number.isFinite(systemRlEpisode.body.reward?.metrics?.retrievalPrecisionAtK)
    || !Number.isFinite(systemRlEpisode.body.reward?.metrics?.retrievalRecallAtK)
  ) {
    throw new Error(
      `Offline system RL episode did not preserve the draft/learning boundary: ${JSON.stringify({
        persistedAsReportDraft: systemRlEpisode.body.persistedAsReportDraft,
        mode: systemRlEpisode.body.policyDecision?.mode,
        learningEligible: systemRlEpisode.body.reward?.learningEligible,
        learningIneligibilityReasons: systemRlEpisode.body.reward?.learningIneligibilityReasons,
        retrievalLabelsAvailable: systemRlEpisode.body.reward?.metrics?.retrievalLabelsAvailable,
        retrievalPrecisionAtK: systemRlEpisode.body.reward?.metrics?.retrievalPrecisionAtK,
        retrievalRecallAtK: systemRlEpisode.body.reward?.metrics?.retrievalRecallAtK,
        evaluationCase: systemRlEpisode.body.evalRun?.evaluationCase,
        retrievalEvaluation: systemRlEpisode.body.evalRun?.retrievalEvaluation,
      })}`,
    );
  }
  const afterDiagnosticPolicyStatus = await requestJson("/api/v1/admin/system-rl/status");
  assertStatus(afterDiagnosticPolicyStatus, 200, "inspect policies after frozen diagnostic");
  const diagnosticTrainingPolicy = afterDiagnosticPolicyStatus.body.policies.find((policy) => policy.policyVersionId === trainingPolicy.policyVersionId);
  if (diagnosticTrainingPolicy?.aggregate?.eligibleEpisodeCount !== trainingPolicy.aggregate?.eligibleEpisodeCount) {
    throw new Error("Frozen diagnostic updated learning episode aggregates.");
  }
  const prematurePromotion = await requestJson(
    `/api/v1/admin/system-rl/policies/${encodeURIComponent(trainingPolicy.policyVersionId)}/promote`,
    {
      method: "POST",
      body: { reason: "Negative promotion-gate audit." },
    },
  );
  assertStatus(prematurePromotion, 409, "system RL promotion is blocked before reward gates pass");
  const managedTenants = await requestJson("/api/v1/admin/tenants");
  assertStatus(managedTenants, 200, "super admin can list tenants");
  const managedTenant = managedTenants.body.tenants.find(
    (tenant) => tenant.tenantId === bootstrap.body.reportJob.tenantId,
  );
  const managedWorkspace = managedTenant?.workspaces.find(
    (workspace) => workspace.workspaceId === bootstrap.body.reportJob.workspaceId,
  );
  if (!managedTenant || !managedWorkspace) {
    throw new Error("Super Admin tenant/workspace listing did not include the seeded report scope.");
  }
  const createdAccount = await requestJson("/api/v1/admin/accounts", {
    method: "POST",
    body: {
      displayName: "Connected App Inspector",
      password: "Connected-App-Inspector-653!",
      roleLabel: "Inspector",
      tenantId: managedTenant.tenantId,
      username: "connected.app.inspector",
      workspaceId: managedWorkspace.workspaceId,
    },
  });
  assertStatus(createdAccount, 201, "super admin creates an app/report account");
  if (createdAccount.body.account.username !== "connected.app.inspector") {
    throw new Error("Created account did not preserve its normalized username.");
  }

  const mobileLogin = await requestJson("/api/v1/app/auth/login", {
    method: "POST",
    body: {
      deviceId: "audit-android-device",
      password: "Connected-App-Inspector-653!",
      username: "connected.app.inspector",
    },
    cookie: null,
  });
  assertStatus(mobileLogin, 200, "inspection app password login");
  if (!mobileLogin.body.sessionToken || mobileLogin.setCookie) {
    throw new Error("Inspection app login must return a mobile token without setting a browser cookie.");
  }

  const accountDemoBootstrap = await requestJson(
    "/api/v1/report-jobs/bootstrap/v10-api-standard",
    {
      authorization: `Bearer ${mobileLogin.body.sessionToken}`,
      cookie: null,
    },
  );
  assertStatus(accountDemoBootstrap, 200, "new inspector receives an account-scoped demo report");
  const accountDemoReportId = accountDemoBootstrap.body.reportJob.reportJobId;
  if (
    accountDemoBootstrap.body.reportJob.createdByUserId !== createdAccount.body.account.userId ||
    accountDemoBootstrap.body.reportJob.tenantId !== managedTenant.tenantId ||
    accountDemoBootstrap.body.reportJob.workspaceId !== managedWorkspace.workspaceId ||
    accountDemoReportId === reportJobId ||
    accountDemoBootstrap.body.exportPackage.inspectionId === bootstrap.body.exportPackage.inspectionId
  ) {
    throw new Error("New inspector demo data was not isolated to the authenticated account scope.");
  }
  const repeatedAccountDemoBootstrap = await requestJson(
    "/api/v1/report-jobs/bootstrap/v10-api-standard",
    {
      authorization: `Bearer ${mobileLogin.body.sessionToken}`,
      cookie: null,
    },
  );
  assertStatus(repeatedAccountDemoBootstrap, 200, "account-scoped demo report reload");
  if (repeatedAccountDemoBootstrap.body.reportJob.reportJobId !== accountDemoReportId) {
    throw new Error("Repeated demo loading created duplicate report jobs for the same account.");
  }

  const mobilePackage = structuredClone(bootstrap.body.exportPackage);
  const mobileInspectionId = `inspection-mobile-audit-${Date.now()}`;
  const mobileInspectionReference = `LAIQ-MOBILE-${Date.now()}`;
  mobilePackage.inspectionId = mobileInspectionId;
  mobilePackage.inspectionReference = mobileInspectionReference;
  mobilePackage.tenantId = "forged-local-tenant";
  mobilePackage.workspaceId = "forged-local-workspace";
  mobilePackage.exportedByUserId = "forged-local-user";
  mobilePackage.profile.tenantId = "forged-local-tenant";
  mobilePackage.profile.workspaceId = "forged-local-workspace";
  mobilePackage.profile.userId = "forged-local-user";
  mobilePackage.task.inspectionId = mobileInspectionId;
  mobilePackage.task.inspectionReference = mobileInspectionReference;
  mobilePackage.task.tenantId = "forged-local-tenant";
  mobilePackage.task.workspaceId = "forged-local-workspace";
  const attachmentBearingPackage = structuredClone(mobilePackage);
  const directAttachmentImport = await requestJson("/api/v1/app/imports/v3-product", {
    method: "POST",
    authorization: `Bearer ${mobileLogin.body.sessionToken}`,
    body: { exportPackage: attachmentBearingPackage },
    cookie: null,
  });
  assertStatus(directAttachmentImport, 409, "attachment-bearing app import requires object upload");
  if (directAttachmentImport.body.code !== "object_upload_session_required") {
    throw new Error("Attachment-bearing direct import did not return object_upload_session_required.");
  }
  const traversalAttachment = attachmentBearingPackage.attachments[0];
  const invalidUploadManifest = await requestJson(
    "/api/v1/app/imports/v3-product/upload-sessions",
    {
      method: "POST",
      authorization: `Bearer ${mobileLogin.body.sessionToken}`,
      body: {
        exportPackage: attachmentBearingPackage,
        objects: [{
          attachmentId: traversalAttachment.attachmentId,
          byteSize: traversalAttachment.fileByteSize,
          mediaType: traversalAttachment.mediaType,
          relativePath: "../outside.png",
          sha256: "a".repeat(64),
        }],
      },
      cookie: null,
      headers: { "Idempotency-Key": `audit-invalid-${mobileInspectionId}` },
    },
  );
  assertStatus(invalidUploadManifest, 400, "upload manifest rejects path traversal");
  if (invalidUploadManifest.body.code !== "attachment_path_invalid") {
    throw new Error("Path traversal did not return attachment_path_invalid.");
  }
  mobilePackage.attachments = [];
  mobilePackage.evaluationMode = true;
  mobilePackage.evaluationCaseId = `outline-audit-${reportJobId}`;
  mobilePackage.sectionPlanning = { contractVersion: "section_planning_v1", mode: "evaluation" };
  rewriteVolatileExportTimestamps(mobilePackage, new Date().toISOString());
  const mobileImport = await requestJson("/api/v1/app/imports/v3-product", {
    method: "POST",
    authorization: `Bearer ${mobileLogin.body.sessionToken}`,
    body: { exportPackage: mobilePackage },
    cookie: null,
  });
  assertStatus(mobileImport, 201, "authenticated inspection app import");
  const mobileReportId = mobileImport.body.reportJob.reportJobId;

  const uploadPackage = structuredClone(mobilePackage);
  const uploadInspectionId = `inspection-mobile-upload-audit-${Date.now()}`;
  uploadPackage.inspectionId = uploadInspectionId;
  uploadPackage.inspectionReference = `LAIQ-UPLOAD-${Date.now()}`;
  uploadPackage.task.inspectionId = uploadInspectionId;
  uploadPackage.task.inspectionReference = uploadPackage.inspectionReference;
  const uploadSession = await requestJson(
    "/api/v1/app/imports/v3-product/upload-sessions",
    {
      method: "POST",
      authorization: `Bearer ${mobileLogin.body.sessionToken}`,
      body: { exportPackage: uploadPackage, objects: [] },
      cookie: null,
      headers: { "Idempotency-Key": `audit-empty-${uploadInspectionId}` },
    },
  );
  assertStatus(uploadSession, 201, "create attachment-free app upload session");
  const repeatedUploadSession = await requestJson(
    "/api/v1/app/imports/v3-product/upload-sessions",
    {
      method: "POST",
      authorization: `Bearer ${mobileLogin.body.sessionToken}`,
      body: { exportPackage: uploadPackage, objects: [] },
      cookie: null,
      headers: { "Idempotency-Key": `audit-empty-${uploadInspectionId}` },
    },
  );
  assertStatus(repeatedUploadSession, 201, "upload-session creation is idempotent");
  if (repeatedUploadSession.body.uploadSessionId !== uploadSession.body.uploadSessionId) {
    throw new Error("Upload-session retry created a duplicate session.");
  }
  const finalizedUpload = await requestJson(
    `/api/v1/app/imports/v3-product/upload-sessions/${uploadSession.body.uploadSessionId}/finalize`,
    {
      method: "POST",
      authorization: `Bearer ${mobileLogin.body.sessionToken}`,
      body: {},
      cookie: null,
    },
  );
  assertStatus(finalizedUpload, 201, "finalize attachment-free app upload session");
  const repeatedFinalization = await requestJson(
    `/api/v1/app/imports/v3-product/upload-sessions/${uploadSession.body.uploadSessionId}/finalize`,
    {
      method: "POST",
      authorization: `Bearer ${mobileLogin.body.sessionToken}`,
      body: {},
      cookie: null,
    },
  );
  assertStatus(repeatedFinalization, 201, "upload finalization is idempotent");
  if (repeatedFinalization.body.reportJob.reportJobId !== finalizedUpload.body.reportJob.reportJobId) {
    throw new Error("Upload-session finalization created a duplicate report job.");
  }

  const mobileReport = await requestJson(`/api/v1/report-jobs/${mobileReportId}`, {
    authorization: `Bearer ${mobileLogin.body.sessionToken}`,
    cookie: null,
  });
  assertStatus(mobileReport, 200, "mobile account can open its imported report");
  assert.ok(!mobileReport.body.sectionPlanning, "App payload cannot activate candidate outline generation");
  const mobilePlanning = await requestJson(`/api/v1/report-jobs/${mobileReportId}/section-plans`, {
    authorization: `Bearer ${mobileLogin.body.sessionToken}`, cookie: null,
  });
  assertStatus(mobilePlanning, 409, "ordinary imported report cannot access evaluation-only outline planning");
  assert.equal(mobilePlanning.body.code, "outline_evaluation_only");
  if (
    mobileReport.body.reportJob.tenantId !== managedTenant.tenantId ||
    mobileReport.body.reportJob.workspaceId !== managedWorkspace.workspaceId ||
    mobileReport.body.reportJob.createdByUserId !== createdAccount.body.account.userId
  ) {
    throw new Error("Mobile import was not bound to the authenticated account scope.");
  }
  const mobileInbox = await requestJson("/api/v1/report-jobs", {
    authorization: `Bearer ${mobileLogin.body.sessionToken}`,
    cookie: null,
  });
  assertStatus(mobileInbox, 200, "mobile account report inbox");
  if (!mobileInbox.body.reportJobs.some((item) => item.reportJobId === mobileReportId)) {
    throw new Error("Authenticated mobile import did not appear in the same account report inbox.");
  }
  const mobileLogout = await requestJson("/api/v1/app/auth/logout", {
    method: "POST",
    authorization: `Bearer ${mobileLogin.body.sessionToken}`,
    cookie: null,
    body: {},
  });
  assertStatus(mobileLogout, 204, "inspection app logout revokes mobile session");
  const revokedMobileSession = await requestJson("/api/v1/auth/session", {
    authorization: `Bearer ${mobileLogin.body.sessionToken}`,
    cookie: null,
  });
  assertStatus(revokedMobileSession, 200, "revoked mobile session is handled safely");
  if (revokedMobileSession.body.principal !== null) {
    throw new Error("Revoked mobile session still authenticated.");
  }

  activeCookie = await loginAs(inspector);
  const crossAccountUploadSession = await requestJson(
    `/api/v1/app/imports/v3-product/upload-sessions/${uploadSession.body.uploadSessionId}`,
  );
  assertStatus(crossAccountUploadSession, 404, "inspector cannot inspect another account upload session");
  const otherInspectorReport = await requestJson(`/api/v1/report-jobs/${mobileReportId}`);
  assertStatus(otherInspectorReport, 403, "inspector cannot open another inspector's report");
  if (otherInspectorReport.body.code !== "report_owner_denied") {
    throw new Error("Cross-account report access did not return report_owner_denied.");
  }
  const inspectorInbox = await requestJson("/api/v1/report-jobs");
  assertStatus(inspectorInbox, 200, "inspector report inbox");
  if (inspectorInbox.body.reportJobs.some((item) => item.reportJobId === mobileReportId)) {
    throw new Error("Another inspector's report leaked into the signed-in inspector inbox.");
  }

  activeCookie = await loginAs(superAdmin);
  const selfDelete = await requestJson(`/api/v1/admin/accounts/${superAdmin.userId}`, {
    method: "DELETE",
    body: { confirmation: superAdmin.username },
  });
  assertStatus(selfDelete, 409, "Super Admin cannot delete their own account");
  const invalidAccountDelete = await requestJson(
    `/api/v1/admin/accounts/${createdAccount.body.account.userId}`,
    {
      method: "DELETE",
      body: { confirmation: "wrong-confirmation" },
    },
  );
  assertStatus(invalidAccountDelete, 400, "account deletion requires exact confirmation");
  const deletedAccount = await requestJson(
    `/api/v1/admin/accounts/${createdAccount.body.account.userId}`,
    {
      method: "DELETE",
      body: { confirmation: createdAccount.body.account.username },
    },
  );
  assertStatus(deletedAccount, 200, "Super Admin permanently deletes account data");
  if (
    deletedAccount.body.deletedReportJobIds.length !== 3 ||
    !deletedAccount.body.deletedReportJobIds.includes(accountDemoReportId) ||
    !deletedAccount.body.deletedReportJobIds.includes(mobileReportId) ||
    !deletedAccount.body.deletedReportJobIds.includes(finalizedUpload.body.reportJob.reportJobId) ||
    deletedAccount.body.deletedImportCount !== 3
  ) {
    throw new Error("Account deletion did not report the expected report/import purge.");
  }
  const deletedReport = await requestJson(`/api/v1/report-jobs/${mobileReportId}`);
  assertStatus(deletedReport, 404, "deleted account report data is removed");
  const deletedAccountLogin = await requestJson("/api/v1/app/auth/login", {
    method: "POST",
    body: {
      deviceId: "deleted-account-audit",
      password: "Connected-App-Inspector-653!",
      username: "connected.app.inspector",
    },
    cookie: null,
  });
  assertStatus(deletedAccountLogin, 401, "deleted account credentials are removed");

  activeCookie = await loginAs(inspector);
  const missingApprovalVersion = await requestJson(
    `/api/v1/report-jobs/${reportJobId}/sections/scope-of-inspection/approve`,
    {
      method: "POST",
      body: {},
    },
  );
  assertStatus(missingApprovalVersion, 400, "section approval requires a current version");
  if (missingApprovalVersion.body.code !== "section_version_required") {
    throw new Error("Expected controlled section_version_required API error.");
  }

  const emptySectionApproval = await requestJson(
    `/api/v1/report-jobs/${reportJobId}/sections/scope-of-inspection/approve`,
    {
      method: "POST",
      body: { expectedVersion: 0 },
    },
  );
  assertStatus(emptySectionApproval, 409, "empty section cannot be approved");
  if (emptySectionApproval.body.code !== "section_content_empty") {
    throw new Error("Expected controlled section_content_empty API error.");
  }

  const forgedDraftApproval = await requestJson(
    `/api/v1/report-jobs/${reportJobId}/sections/general-tank-information`,
    {
      method: "PATCH",
      body: {
        content: "<p>Inspector draft awaiting completion.</p>",
        generated: true,
        edited: true,
        approved: true,
        reviewRequired: false,
      },
    },
  );
  assertStatus(forgedDraftApproval, 200, "draft save cannot impersonate approval");
  const forgedDraft = forgedDraftApproval.body.sectionDrafts.find(
    (section) => section.sectionId === "general-tank-information",
  );
  if (forgedDraft?.approved !== false) {
    throw new Error("Draft save was able to set the server-owned approval flag.");
  }
  if (forgedDraft?.version !== 1) {
    throw new Error("First section draft did not receive PostgreSQL optimistic-concurrency version 1.");
  }

  const staleSectionApproval = await requestJson(
    `/api/v1/report-jobs/${reportJobId}/sections/general-tank-information/approve`,
    {
      method: "POST",
      body: { expectedVersion: 0 },
    },
  );
  assertStatus(staleSectionApproval, 409, "stale section approval is rejected");
  if (staleSectionApproval.body.code !== "section_version_conflict") {
    throw new Error("Expected controlled section_version_conflict approval error.");
  }

  const staleDraftSave = await requestJson(
    `/api/v1/report-jobs/${reportJobId}/sections/general-tank-information`,
    {
      method: "PATCH",
      body: {
        content: "<p>Stale browser edit that must not overwrite the latest draft.</p>",
        generated: true,
        edited: true,
        expectedVersion: 0,
      },
    },
  );
  assertStatus(staleDraftSave, 409, "stale section draft is rejected");
  if (staleDraftSave.body.code !== "section_version_conflict") {
    throw new Error("Expected controlled section_version_conflict API error.");
  }

  const staleTargetedEdit = await requestJson(
    `/api/v1/report-jobs/${reportJobId}/sections/general-tank-information/targeted-edit`,
    {
      method: "POST",
      body: {
        action: "rephrase",
        instruction: "",
        expectedVersion: 0,
        selection: {
          from: 1,
          to: 10,
          selectedText: "Inspector",
          selectedHtml: "Inspector",
          documentHash: "stale",
          selectionHash: "stale",
          selectionKind: "inline",
          contextBefore: "",
          contextAfter: "",
        },
      },
    },
  );
  assertStatus(staleTargetedEdit, 409, "stale targeted edit is rejected");
  if (staleTargetedEdit.body.code !== "targeted_edit_version_conflict") {
    throw new Error("Expected controlled targeted_edit_version_conflict API error.");
  }

  const forgedDraftContent = "<p>Inspector draft awaiting completion.</p>";
  const tableSelectedText = "Inspector";
  const tableSelectedHtml = "<table><tr><td>Inspector</td></tr></table>";
  const invalidTableTargetedEdit = await requestJson(
    `/api/v1/report-jobs/${reportJobId}/sections/general-tank-information/targeted-edit`,
    {
      method: "POST",
      body: {
        action: "rephrase",
        instruction: "",
        expectedVersion: forgedDraft.version,
        selection: {
          from: 1,
          to: 10,
          selectedText: tableSelectedText,
          selectedHtml: tableSelectedHtml,
          documentHash: sha256(forgedDraftContent),
          selectionHash: sha256([
            1,
            10,
            tableSelectedText,
            tableSelectedHtml,
          ].join("\n")),
          selectionKind: "inline",
          contextBefore: "",
          contextAfter: "",
        },
      },
    },
  );
  assertStatus(invalidTableTargetedEdit, 422, "table targeted edit is rejected");
  if (invalidTableTargetedEdit.body.code !== "targeted_edit_table_not_supported") {
    throw new Error("Expected controlled targeted_edit_table_not_supported API error.");
  }

  const missingInputApproval = await requestJson(
    `/api/v1/report-jobs/${reportJobId}/sections/general-tank-information/approve`,
    {
      method: "POST",
      body: { expectedVersion: forgedDraft.version },
    },
  );
  assertStatus(missingInputApproval, 409, "required information is named before approval");
  if (
    missingInputApproval.body.code !== "section_required_inputs_missing" ||
    !/Client representative/i.test(missingInputApproval.body.error ?? "") ||
    !/Year built/i.test(missingInputApproval.body.error ?? "")
  ) {
    throw new Error("Missing-input approval response did not name the required fields.");
  }

  const missingCorrosionSourceApproval = await requestJson(
    `/api/v1/report-jobs/${reportJobId}/sections/floor-plate-corrosion-plan/approve`,
    {
      method: "POST",
      body: { expectedVersion: 0 },
    },
  );
  assertStatus(missingCorrosionSourceApproval, 409, "missing MFL source blocks floor corrosion section approval");
  if (missingCorrosionSourceApproval.body.code !== "floor_corrosion_source_required") {
    throw new Error("Expected controlled floor_corrosion_source_required API error.");
  }

  const pendingCorrosionLayout = {
    id: "api-audit-floor-corrosion",
    title: "Floor Plate Corrosion Map",
    subtitle: "API audit",
    surfaceLabel: "Floor",
    legend: [],
    markers: [{
      id: "legacy-finding-marker",
      label: "Legacy finding marker",
      type: "finding",
      x: 0.5,
      y: 0.5,
    }],
    plates: [],
    gridRows: 1,
    gridColumns: 1,
    drawingBlock: {},
    overrideCount: 0,
    floorCorrosion: {
      schemaVersion: 1,
      artifactRunId: "00000000-0000-4000-8000-000000000001",
      sourceLayoutName: "API audit layout",
      sourceMflDocumentName: "API audit MFL.pdf",
      generatedAtIso: "2026-01-01T00:00:00.000Z",
      overlays: [{ scanPlateId: "1.1", status: "orientation_review_required" }],
      unmatchedScanPlateIds: [],
      platesWithoutScans: [],
      validationIssues: [{
        code: "mfl_orientation_review_required",
        severity: "warning",
        plateId: "1.1",
        message: "Review required.",
      }],
    },
  };
  const pendingCorrosionSave = await requestJson(
    `/api/v1/report-jobs/${reportJobId}/layout-overrides/floor-plate-corrosion-plan`,
    {
      method: "PATCH",
      body: { layoutMap: pendingCorrosionLayout, expectedVersion: 0 },
    },
  );
  assertStatus(pendingCorrosionSave, 200, "save pending floor corrosion layout");
  const normalizedLegacyMarker = pendingCorrosionSave.body.layoutOverrides
    ?.find((item) => item.sectionId === "floor-plate-corrosion-plan")
    ?.layoutMap?.markers?.find((marker) => marker.id === "legacy-finding-marker");
  if (normalizedLegacyMarker?.source !== "report-platform:legacy-layout-override") {
    throw new Error("Persisted legacy layout markers must receive explicit source provenance.");
  }
  const prematureCorrosionApproval = await requestJson(
    `/api/v1/report-jobs/${reportJobId}/sections/floor-plate-corrosion-plan/approve`,
    {
      method: "POST",
      body: { expectedVersion: 0 },
    },
  );
  assertStatus(prematureCorrosionApproval, 409, "unreviewed floor corrosion placement blocks section approval");
  if (prematureCorrosionApproval.body.code !== "floor_corrosion_review_required") {
    throw new Error("Expected controlled floor_corrosion_review_required API error.");
  }

  const approvedCorrosionLayout = {
    ...pendingCorrosionLayout,
    floorCorrosion: {
      ...pendingCorrosionLayout.floorCorrosion,
      overlays: [{ scanPlateId: "1.1", status: "approved" }],
      validationIssues: [],
    },
  };
  const approvedCorrosionSave = await requestJson(
    `/api/v1/report-jobs/${reportJobId}/layout-overrides/floor-plate-corrosion-plan`,
    {
      method: "PATCH",
      body: {
        layoutMap: approvedCorrosionLayout,
        expectedVersion: getLayoutVersion(pendingCorrosionSave.body, "floor-plate-corrosion-plan"),
      },
    },
  );
  assertStatus(approvedCorrosionSave, 200, "save approved floor corrosion layout");
  const corrosionDraft = await requestJson(
    `/api/v1/report-jobs/${reportJobId}/sections/floor-plate-corrosion-plan`,
    {
      method: "PATCH",
      body: {
        content: "<p>Floor corrosion plan compiled from matched MFL plate scans.</p>",
        generated: true,
        edited: false,
      },
    },
  );
  assertStatus(corrosionDraft, 200, "save floor corrosion section content");
  const corrosionSource = await requestJson(
    `/api/v1/report-jobs/${reportJobId}/manual-inputs`,
    {
      method: "PATCH",
      body: {
        expectedRevision: getManualInputsRevision(corrosionDraft.body),
        values: {
          "floor-plate-corrosion-plan-layout-source": "Imported MFL individual plate maps",
        },
      },
    },
  );
  assertStatus(corrosionSource, 200, "save floor corrosion source confirmation");
  const approvedCorrosionSection = await requestJson(
    `/api/v1/report-jobs/${reportJobId}/sections/floor-plate-corrosion-plan/approve`,
    {
      method: "POST",
      body: {
        expectedVersion: getSectionVersion(
          corrosionDraft.body,
          "floor-plate-corrosion-plan",
        ),
      },
    },
  );
  assertStatus(approvedCorrosionSection, 200, "approved floor corrosion placements allow section approval");
  const changedCorrosionSave = await requestJson(
    `/api/v1/report-jobs/${reportJobId}/layout-overrides/floor-plate-corrosion-plan`,
    {
      method: "PATCH",
      body: {
        layoutMap: pendingCorrosionLayout,
        expectedVersion: getLayoutVersion(approvedCorrosionSave.body, "floor-plate-corrosion-plan"),
      },
    },
  );
  assertStatus(changedCorrosionSave, 200, "changing floor corrosion layout invalidates approval");
  const changedCorrosionSection = changedCorrosionSave.body.sectionDrafts.find(
    (section) => section.sectionId === "floor-plate-corrosion-plan",
  );
  if (changedCorrosionSection?.approved !== false || changedCorrosionSection?.reviewRequired !== true) {
    throw new Error("Changing a layout override did not invalidate section approval.");
  }
  const staleCorrosionSave = await requestJson(
    `/api/v1/report-jobs/${reportJobId}/layout-overrides/floor-plate-corrosion-plan`,
    {
      method: "PATCH",
      body: {
        layoutMap: approvedCorrosionLayout,
        expectedVersion: getLayoutVersion(approvedCorrosionSave.body, "floor-plate-corrosion-plan"),
      },
    },
  );
  assertStatus(staleCorrosionSave, 409, "stale layout update is rejected");
  if (staleCorrosionSave.body.code !== "layout_version_conflict") {
    throw new Error("Expected controlled layout_version_conflict API error.");
  }

  const staleManualInputs = await requestJson(
    `/api/v1/report-jobs/${reportJobId}/manual-inputs`,
    {
      method: "PATCH",
      body: {
        expectedRevision: getManualInputsRevision(corrosionDraft.body),
        values: { "floor-plate-corrosion-plan-layout-source": "Stale source" },
      },
    },
  );
  assertStatus(staleManualInputs, 409, "stale manual input update is rejected");
  if (staleManualInputs.body.code !== "manual_inputs_revision_conflict") {
    throw new Error("Expected controlled manual_inputs_revision_conflict API error.");
  }

  const unauthenticatedMflImport = await requestRaw(
    `/api/v1/report-jobs/${reportJobId}/floor-corrosion/mfl-import`,
    {
      method: "POST",
      contentType: "application/pdf",
      body: Buffer.from("%PDF-invalid"),
      cookie: null,
    },
  );
  assertStatus(unauthenticatedMflImport, 401, "MFL import requires authentication");

  const wrongMflContentType = await requestRaw(
    `/api/v1/report-jobs/${reportJobId}/floor-corrosion/mfl-import`,
    {
      method: "POST",
      contentType: "application/json",
      body: Buffer.from("{}"),
    },
  );
  assertStatus(wrongMflContentType, 415, "MFL import rejects non-PDF content");

  const lockedAppFloorLayoutImport = await requestRaw(
    `/api/v1/report-jobs/${reportJobId}/floor-corrosion/layout-import?sectionId=floor-plate-corrosion-plan&page=44`,
    {
      method: "POST",
      contentType: "application/pdf",
      body: Buffer.from("%PDF-app-floor-lock-audit"),
    },
  );
  assertStatus(lockedAppFloorLayoutImport, 409, "app-owned floor geometry rejects replacement layout imports");
  const lockedAppFloorLayoutError = JSON.parse(lockedAppFloorLayoutImport.body);
  if (lockedAppFloorLayoutError.code !== "app_floor_layout_locked") {
    throw new Error("Expected app_floor_layout_locked when replacing V3 app-owned floor geometry.");
  }

  const missingCorrosionArtifact = await requestRaw(
    `/api/v1/report-jobs/${reportJobId}/floor-corrosion/artifacts/00000000-0000-0000-0000-000000000000/missing.png`,
  );
  assertStatus(missingCorrosionArtifact, 404, "missing floor corrosion artifact returns 404");
  const fixtureExport = await requestJson("/api/v1/exports/android-v3-product/v10-api-standard.json");
  assertStatus(fixtureExport, 200, "load V3 fixture");

  const unknownJob = await requestJson("/api/v1/report-jobs/not-a-report-job");
  assertStatus(unknownJob, 404, "unknown report job returns 404");

  const unknownSection = await requestJson(
    `/api/v1/report-jobs/${reportJobId}/sections/not-a-section/generate`,
    {
      method: "POST",
      body: {
        actorUserId: "forged-user",
        expectedVersion: 0,
      },
    },
  );
  assertStatus(unknownSection, 404, "unknown section returns 404");

  const isolatedCookie = await loginAs(isolatedInspector);
  const crossTenantRead = await requestJson(`/api/v1/report-jobs/${reportJobId}`, {
    cookie: isolatedCookie,
  });
  assertStatus(crossTenantRead, 403, "cross-tenant report read is denied");

  const invalidToken = await requestJson(`/api/v1/report-jobs/${reportJobId}`, {
    cookie: `${"laiq_report_session"}=not-a-valid-session`,
  });
  assertStatus(invalidToken, 401, "invalid session is rejected");

  const reviewerCookie = await loginAs(reviewer);
  const reviewerRead = await requestJson(`/api/v1/report-jobs/${reportJobId}`, {
    cookie: reviewerCookie,
  });
  assertStatus(reviewerRead, 200, "reviewer can access assigned workspace report");

  const clientCookie = await loginAs(clientViewer);
  const clientDraftRead = await requestJson(`/api/v1/report-jobs/${reportJobId}`, {
    cookie: clientCookie,
  });
  assertStatus(clientDraftRead, 403, "client viewer cannot read unapproved report workspace state");
  const clientMflImport = await requestRaw(
    `/api/v1/report-jobs/${reportJobId}/floor-corrosion/mfl-import`,
    {
      method: "POST",
      contentType: "application/pdf",
      body: Buffer.from("%PDF-invalid"),
      cookie: clientCookie,
    },
  );
  assertStatus(clientMflImport, 403, "client viewer cannot import MFL artifacts");
  const clientPrecedentSearch = await requestJson(
    `/api/v1/knowledge-base/precedent/search?reportJobId=${encodeURIComponent(reportJobId)}&sectionId=inspection-report`,
    { cookie: clientCookie },
  );
  assertStatus(clientPrecedentSearch, 403, "client viewer cannot search report precedent KB");
  const crossTenantRecommendationSearch = await requestJson(
    `/api/v1/knowledge-base/recommendations/search?reportJobId=${encodeURIComponent(reportJobId)}`,
    { cookie: isolatedCookie },
  );
  assertStatus(crossTenantRecommendationSearch, 403, "cross-tenant account cannot search recommendation KB");

  const superAdminCookie = await loginAs(superAdmin);
  const kbStatus = await requestJson("/api/v1/knowledge-base/precedent/status", {
    cookie: superAdminCookie,
  });
  assertStatus(kbStatus, 200, "super admin can inspect KB administration status");

  const invalidPackage = await requestJson("/api/v1/imports/android-v3-product", {
    method: "POST",
    body: { packageType: "not-valid", schemaVersion: 999 },
  });
  assertStatus(invalidPackage, 400, "invalid export package returns 400");

  const missingResolvedFloorGeometry = structuredClone(fixtureExport.body);
  const invalidFloorConfig = missingResolvedFloorGeometry.layoutConfigs.find(
    (config) => config.targetKey === "floor",
  );
  delete invalidFloorConfig.customCircularLayout.resolvedMainPlateGeometry;
  delete invalidFloorConfig.customCircularLayout.resolvedAnnularPlateGeometry;
  const invalidFloorImport = await requestJson("/api/v1/imports/android-v3-product", {
    method: "POST",
    body: missingResolvedFloorGeometry,
  });
  assertStatus(invalidFloorImport, 400, "V3 floor import without resolved app geometry returns 400");

  const missingAppFloorFigure = structuredClone(fixtureExport.body);
  delete missingAppFloorFigure.layoutFigures;
  const missingAppFloorFigureImport = await requestJson("/api/v1/imports/android-v3-product", {
    method: "POST",
    body: missingAppFloorFigure,
  });
  assertStatus(missingAppFloorFigureImport, 400, "V3 floor import without app-owned figure returns 400");

  const tamperedAppFloorFigure = structuredClone(fixtureExport.body);
  tamperedAppFloorFigure.layoutFigures[0].svg += "<!--tampered-->";
  const tamperedAppFloorFigureImport = await requestJson("/api/v1/imports/android-v3-product", {
    method: "POST",
    body: tamperedAppFloorFigure,
  });
  assertStatus(tamperedAppFloorFigureImport, 400, "tampered app-owned figure returns 400");

  const firstImport = await requestJson("/api/v1/imports/android-v3-product", {
    method: "POST",
    body: fixtureExport.body,
  });
  assertStatus(firstImport, 201, "first duplicate import-compatible request");

  const secondImport = await requestJson("/api/v1/imports/android-v3-product", {
    method: "POST",
    body: fixtureExport.body,
  });
  assertStatus(secondImport, 201, "second duplicate import-compatible request");

  const forgedScopePackage = structuredClone(fixtureExport.body);
  forgedScopePackage.tenantId = "tenant-forged";
  forgedScopePackage.workspaceId = "workspace-forged";
  forgedScopePackage.profile.tenantId = "tenant-forged";
  forgedScopePackage.profile.workspaceId = "workspace-forged";
  const forgedScopeImport = await requestJson("/api/v1/imports/android-v3-product", {
    method: "POST",
    body: forgedScopePackage,
  });
  assertStatus(forgedScopeImport, 403, "import cannot select another tenant or workspace");

  const inspectorKbRebuild = await requestJson("/api/v1/knowledge-base/precedent/rebuild", {
    method: "POST",
    body: {},
  });
  assertStatus(inspectorKbRebuild, 403, "inspector cannot administer global KB");

  const missingApprovedExport = await requestJson(
    `/api/v1/report-jobs/${reportJobId}/exports/final-report.docx`,
    {
      method: "POST",
      body: { sectionIds: ["shell-plate-thickness-measurements"] },
    },
  );
  assertStatus(missingApprovedExport, 400, "missing approved section export returns 400");

  const declaredUnitPackage = structuredClone(fixtureExport.body);
  // This is an explicit controlled test input, not a repair of production data.
  declaredUnitPackage.unitProfile = { thicknessUnit: "mm" };
  const declaredUnitImport = await requestJson("/api/v1/imports/android-v3-product", { method: "POST", body: declaredUnitPackage });
  assertStatus(declaredUnitImport, 201, "import controlled source with explicit thickness units");
  reportJobId = declaredUnitImport.body.reportJob.reportJobId;
  if (declaredUnitImport.body.exportPackage.unitProfile?.thicknessUnit !== "mm") {
    throw new Error("Import did not preserve the explicit thickness unit profile in the controlled test package.");
  }
  assert.ok(!declaredUnitImport.body.sectionPlanning, "Normal imports retain the baseline generation workflow");

  const generated = await requestJson(
    `/api/v1/report-jobs/${reportJobId}/sections/shell-plate-thickness-measurements/generate`,
    {
      method: "POST",
      body: {
        actorUserId: "forged-user",
        expectedVersion: getSectionVersion(declaredUnitImport.body, "shell-plate-thickness-measurements"),
      },
    },
  );
  assertStatus(generated, 200, "generate shell plate thickness section");
  if (generated.body.authorizationContext.actorUserId !== inspector.userId) {
    throw new Error("Request body actorUserId overrode the authenticated principal.");
  }
  const staleGeneration = await requestJson(
    `/api/v1/report-jobs/${reportJobId}/sections/shell-plate-thickness-measurements/generate`,
    {
      method: "POST",
      body: { expectedVersion: 0 },
    },
  );
  assertStatus(staleGeneration, 409, "stale section generation is rejected before work starts");
  if (staleGeneration.body.code !== "section_version_conflict") {
    throw new Error("Expected controlled section_version_conflict API error for stale generation.");
  }

  const approved = await requestJson(
    `/api/v1/report-jobs/${reportJobId}/sections/shell-plate-thickness-measurements/approve`,
    {
      method: "POST",
      body: {
        actorUserId: "forged-user",
        expectedVersion: getSectionVersion(
          generated.body,
          "shell-plate-thickness-measurements",
        ),
      },
    },
  );
  assertStatus(approved, 200, "approve generated section");

  const timestampOnlyReExport = structuredClone(declaredUnitPackage);
  rewriteVolatileExportTimestamps(timestampOnlyReExport, "2026-07-20T12:00:00.000Z");
  const timestampOnlyReImport = await requestJson("/api/v1/imports/android-v3-product", {
    method: "POST",
    body: timestampOnlyReExport,
  });
  assertStatus(timestampOnlyReImport, 201, "timestamp-only re-import preserves report work");
  const preservedApprovedSection = timestampOnlyReImport.body.sectionDrafts.find(
    (section) => section.sectionId === "shell-plate-thickness-measurements",
  );
  if (!preservedApprovedSection?.approved || !preservedApprovedSection.content) {
    throw new Error("Timestamp-only re-import removed or invalidated approved report content.");
  }

  const docx = await requestBinary(
    `/api/v1/report-jobs/${reportJobId}/exports/final-report.docx`,
    {
      method: "POST",
      body: { sectionIds: ["shell-plate-thickness-measurements"] },
    },
  );
  assertStatus(docx, 200, "export approved DOCX");
  if (docx.bytes < 1000) {
    throw new Error(`Expected DOCX response to be non-trivial, received ${docx.bytes} bytes.`);
  }

  const floorReportSource = await requestJson(`/api/v1/report-jobs/${reportJobId}`);
  assertStatus(floorReportSource, 200, "load baseline floor layout report");
  const generatedFloorLayout = await requestJson(
    `/api/v1/report-jobs/${reportJobId}/sections/floor-plate-layout-platemaps-numbering-system/generate`,
    {
      method: "POST",
      body: {
        expectedVersion: getSectionVersion(
          floorReportSource.body,
          "floor-plate-layout-platemaps-numbering-system",
        ),
      },
    },
  );
  assertStatus(generatedFloorLayout, 200, "generate app-owned floor layout section");

  const floorLayoutSource = await requestJson(
    `/api/v1/report-jobs/${reportJobId}/manual-inputs`,
    {
      method: "PATCH",
      body: {
        expectedRevision: getManualInputsRevision(generatedFloorLayout.body),
        values: {
          "floor-plate-layout-platemaps-numbering-system-layout-source": "LAIQ inspection app floor layout",
        },
      },
    },
  );
  assertStatus(floorLayoutSource, 200, "save app-owned floor layout source confirmation");

  const regeneratedFloorLayout = await requestJson(`/api/v1/report-jobs/${reportJobId}/sections/floor-plate-layout-platemaps-numbering-system/generate`, {
    method: "POST", body: { expectedVersion: getSectionVersion(floorLayoutSource.body, "floor-plate-layout-platemaps-numbering-system") },
  });
  assertStatus(regeneratedFloorLayout, 200, "regenerate floor layout against confirmed current inputs");

  const approvedFloorLayout = await requestJson(
    `/api/v1/report-jobs/${reportJobId}/sections/floor-plate-layout-platemaps-numbering-system/approve`,
    {
      method: "POST",
      body: {
        expectedVersion: getSectionVersion(
          regeneratedFloorLayout.body,
          "floor-plate-layout-platemaps-numbering-system",
        ),
      },
    },
  );
  assertStatus(approvedFloorLayout, 200, "approve app-owned floor layout section");

  const initialRestoreAudit = await requestJson(
    `/api/v1/report-jobs/${reportJobId}/sections/scope-of-inspection`,
    {
      method: "PATCH",
      body: {
        content: "<p>Initial report draft retained for restore concurrency testing.</p>",
        generated: true,
        edited: false,
        expectedVersion: 0,
      },
    },
  );
  assertStatus(initialRestoreAudit, 200, "create initial restore concurrency audit section");
  const editedRestoreAudit = await requestJson(
    `/api/v1/report-jobs/${reportJobId}/sections/scope-of-inspection`,
    {
      method: "PATCH",
      body: {
        content: "<p>Inspector edit retained for restore concurrency testing.</p>",
        generated: true,
        edited: true,
        expectedVersion: getSectionVersion(initialRestoreAudit.body, "scope-of-inspection"),
      },
    },
  );
  assertStatus(editedRestoreAudit, 200, "create prior section version for restore audit");
  const staleRestoreAudit = await requestJson(
    `/api/v1/report-jobs/${reportJobId}/sections/scope-of-inspection/restore-previous`,
    {
      method: "POST",
      body: {
        expectedVersion: getSectionVersion(initialRestoreAudit.body, "scope-of-inspection"),
      },
    },
  );
  assertStatus(staleRestoreAudit, 409, "stale restore request is rejected");
  if (staleRestoreAudit.body.code !== "section_version_conflict") {
    throw new Error("Expected controlled section_version_conflict API error for stale restore.");
  }
  const validRestoreAudit = await requestJson(
    `/api/v1/report-jobs/${reportJobId}/sections/scope-of-inspection/restore-previous`,
    {
      method: "POST",
      body: {
        expectedVersion: getSectionVersion(editedRestoreAudit.body, "scope-of-inspection"),
      },
    },
  );
  assertStatus(validRestoreAudit, 200, "current section version can restore prior output");

  const floorLayoutDocx = await requestBinary(
    `/api/v1/report-jobs/${reportJobId}/exports/final-report.docx`,
    {
      method: "POST",
      body: { sectionIds: ["floor-plate-layout-platemaps-numbering-system"] },
    },
  );
  assertStatus(floorLayoutDocx, 200, "export app-owned floor layout DOCX");
  if (floorLayoutDocx.bytes < 1000) {
    throw new Error(`Expected floor-layout DOCX response to be non-trivial, received ${floorLayoutDocx.bytes} bytes.`);
  }

  const logoutResult = await requestJson("/api/v1/auth/logout", {
    method: "POST",
    cookie: reviewerCookie,
  });
  assertStatus(logoutResult, 204, "logout clears authenticated session");
  const loggedOutAccess = await requestJson(`/api/v1/report-jobs/${reportJobId}`, {
    cookie: reviewerCookie,
  });
  assertStatus(loggedOutAccess, 401, "logged-out session cannot access report");

  await restartAuditServer();
  const persistedSessionAccess = await requestJson(`/api/v1/report-jobs/${reportJobId}`, {
    cookie: activeCookie,
  });
  assertStatus(persistedSessionAccess, 200, "password session survives API restart");

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    await loginAs(
      { userId: "invalid", username: "lockout-target.audit" },
      "incorrect-password",
      401,
    );
  }
  await loginAs(
    { userId: "invalid", username: "lockout-target.audit" },
    "incorrect-password",
    429,
  );

  console.log("API hardening audit passed: negative routes return controlled errors and valid generation/export still works.");
} catch (error) {
  const diagnostics = serverOutput.replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[redacted database URL]").slice(-16000);
  console.error(`Isolated API audit server output:\n${diagnostics}`);
  throw error;
} finally {
  await stopAuditServer();
  await dropAuditSchema(testSchema);
  rmSync(tempDir, { recursive: true, force: true });
}

function startAuditServer() {
  const child = spawn(process.execPath, ["./server/index.mjs"], {
    cwd: appRoot,
    env: {
      ...process.env,
      // This integration audit must not invoke the developer's live model CLI.
      PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
      REPORT_PLATFORM_API_HOST: "127.0.0.1",
      REPORT_PLATFORM_API_PORT: String(port),
      DATABASE_URL: testSchema.url,
      REPORT_PLATFORM_DB_SSL: process.env.REPORT_PLATFORM_DB_SSL ?? "disable",
      REPORT_PLATFORM_ARTIFACT_ROOT: join(tempDir, "artifacts"),
      REPORT_PLATFORM_ENABLE_DEMO_DATA: "true",
      REPORT_PLATFORM_ENABLE_DEVELOPMENT_IDENTITIES: "true",
      REPORT_PLATFORM_ALLOW_LEGACY_SOURCE_IMPORTS: "true",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });
  return child;
}

async function restartAuditServer() {
  await stopAuditServer();
  server = startAuditServer();
  await waitForHealth();
}

async function stopAuditServer() {
  if (!server || server.exitCode != null) return;
  const exited = new Promise((resolve) => server.once("exit", resolve));
  server.kill("SIGTERM");
  await exited;
}

async function createAuditSchema(sourceUrl) {
  const target = new URL(sourceUrl);
  const schemaName = `laiq_report_audit_${process.pid}_${Date.now()}`;
  const client = new Client({
    connectionString: sourceUrl,
    ssl: process.env.REPORT_PLATFORM_DB_SSL === "require"
      ? { rejectUnauthorized: true }
      : false,
  });
  await client.connect();
  await client.query(`CREATE SCHEMA ${schemaName}`);
  await client.end();
  target.searchParams.set("options", `-c search_path=${schemaName},public`);
  return { schemaName, sourceUrl, url: target.toString() };
}

async function dropAuditSchema({ schemaName, sourceUrl }) {
  const client = new Client({
    connectionString: sourceUrl,
    ssl: process.env.REPORT_PLATFORM_DB_SSL === "require"
      ? { rejectUnauthorized: true }
      : false,
  });
  await client.connect();
  await client.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
  await client.end();
}

async function waitForHealth() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 10000) {
    try {
      const result = await requestJson("/api/health");
      if (result.status === 200) {
        if (result.body?.storage?.databaseDriver !== "postgresql") {
          throw new Error("API health did not report the required PostgreSQL database driver.");
        }
        return;
      }
    } catch {
      // Server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`API server did not become healthy. Output:\n${serverOutput}`);
}

async function requestJson(pathname, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers ?? {}) };
  const cookie = options.cookie === undefined ? activeCookie : options.cookie;
  if (cookie) headers.Cookie = cookie;
  if (options.authorization) headers.Authorization = options.authorization;
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const rawText = await response.text();
  let body = null;

  if (rawText) {
    try {
      body = JSON.parse(rawText);
    } catch {
      body = rawText;
    }
  }

  return {
    status: response.status,
    body,
    rawText,
    setCookie: response.headers.get("set-cookie"),
  };
}

async function requestBinary(pathname, options = {}) {
  const headers = { "Content-Type": "application/json" };
  const cookie = options.cookie === undefined ? activeCookie : options.cookie;
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const bytes = (await response.arrayBuffer()).byteLength;

  return {
    status: response.status,
    bytes,
  };
}

async function requestRaw(pathname, options = {}) {
  const headers = {};
  const cookie = options.cookie === undefined ? activeCookie : options.cookie;
  if (cookie) headers.Cookie = cookie;
  if (options.contentType) headers["Content-Type"] = options.contentType;
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body,
  });
  return {
    status: response.status,
    body: await response.text(),
  };
}

async function loginAs(account, password = auditPassword, expectedStatus = 200) {
  const login = await requestJson("/api/v1/auth/login", {
    method: "POST",
    body: { password, username: account.username },
    cookie: null,
  });
  assertStatus(login, expectedStatus, `password login for ${account.username}`);
  if (expectedStatus !== 200) return null;
  const cookie = login.setCookie?.split(";", 1)[0];
  if (!cookie) {
    throw new Error(`Password login for ${account.username} did not return a session cookie.`);
  }
  return cookie;
}

async function provisionAuditAccounts(databaseUrl) {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: false,
  });
  const passwordHash = await hashPassword(auditPassword);
  await client.connect();
  try {
    for (const account of Object.values(auditAccounts)) {
      await client.query(
        `INSERT INTO auth_password_credentials (
          user_id,
          username_normalized,
          password_hash,
          password_changed_at_iso,
          created_at_iso,
          updated_at_iso
        ) VALUES ($1, $2, $3, NOW(), NOW(), NOW())
        ON CONFLICT(user_id) DO UPDATE SET
          username_normalized = excluded.username_normalized,
          password_hash = excluded.password_hash,
          password_changed_at_iso = excluded.password_changed_at_iso,
          updated_at_iso = excluded.updated_at_iso`,
        [account.userId, account.username, passwordHash],
      );
    }
  } finally {
    await client.end();
  }
}

function getSectionVersion(state, sectionId) {
  const version = state.sectionDrafts?.find(
    (section) => section.sectionId === sectionId,
  )?.version ?? 0;
  if (!Number.isInteger(version) || version < 0) {
    throw new Error(`Section ${sectionId} did not expose a valid concurrency version.`);
  }
  return version;
}

async function auditEvidenceUseEditing({ reportJobId, planning, evidenceId, sourcePackageHash, actorUserId, viewerCookie, isolatedCookie }) {
  const planningPath = `/api/v1/report-jobs/${reportJobId}/section-plans`;
  const decisionsPath = `/api/v1/report-jobs/${reportJobId}/classification-decisions`;
  const sourceReport = await requestJson(`/api/v1/report-jobs/${reportJobId}`);
  assertStatus(sourceReport, 200, "capture ordinary report drafts before candidate review");
  const allUses = (snapshot) => snapshot.sectionPlans.flatMap((plan) => plan.evidenceUses);
  const uses = (snapshot = planning) => allUses(snapshot).filter((use) => use.evidenceIds.includes(evidenceId));
  const sourceRecord = planning.evidenceRecords.find((record) => record.evidenceId === evidenceId).sourceRecord;
  const originalUses = structuredClone(uses());
  const otherEvidenceUses = structuredClone(allUses(planning).filter((use) => !use.evidenceIds.includes(evidenceId)));
  const originalRequired = originalUses.find((use) => use.sectionId === "general-tank-information" && use.slotKey === "identity" && use.role === "required_structured");
  assert.ok(originalRequired, "Native identity must begin with its required outline assignment");
  const addDecision = {
    operation: "add", evidenceId, sectionId: "general-tank-information", slotKey: "configuration", role: "required_structured",
    reason: "Audit independently reusing one source record in another outline block.", actorId: "forged-use-editor",
  };
  const initialBody = { expectedSnapshotId: planning.snapshotId, decision: addDecision };
  for (const [cookie, status, label] of [[null, 401, "authentication"], [viewerCookie, 403, "viewer role"], [isolatedCookie, 403, "tenant scope"]]) {
    assertStatus(await requestJson(decisionsPath, { method: "POST", cookie, body: initialBody }), status, `evidence-use addition enforces ${label}`);
  }
  async function decide(decision, label, expectedStatus = 200) {
    const previousSnapshotId = planning.snapshotId;
    const response = await requestJson(decisionsPath, {
      method: "POST", body: { expectedSnapshotId: previousSnapshotId, decision },
    });
    assertStatus(response, expectedStatus, label);
    if (expectedStatus === 200) {
      planning = response.body;
      assert.notEqual(planning.snapshotId, previousSnapshotId, `${label}: immutable snapshot must advance`);
      const record = planning.evidenceRecords.find((entry) => entry.evidenceId === evidenceId);
      assert.deepEqual(record.sourceRecord, sourceRecord, `${label}: original source remains unchanged`);
      assert.equal(record.reviewDecision.actorId, actorUserId, `${label}: reviewer identity comes from authentication`);
      assert.deepEqual(allUses(planning).filter((use) => !use.evidenceIds.includes(evidenceId)), otherEvidenceUses, `${label}: other evidence assignments remain unchanged`);
    }
    return response;
  }

  await decide(addDecision, "add a second required block in the same section");
  assert.equal(uses().length, originalUses.length + 1, "Adding a use retains existing destinations");
  for (const original of originalUses) assert.deepEqual(uses().find((use) => use.useId === original.useId), original, "Adding a block must preserve each original assignment");
  const addedUse = uses().find((use) => use.sectionId === "general-tank-information" && use.slotKey === "configuration");
  assert.ok(addedUse?.useId, "New outline assignment exposes an independently addressable use ID");
  const originalPlan = planning.sectionPlans.find((plan) => plan.sectionId === "general-tank-information");
  for (const slotKey of ["identity", "configuration"]) assert.ok(originalPlan.outputObligations.some((entry) => entry.evidenceIds.includes(evidenceId) && entry.targetBlockId === `general-tank-information:${slotKey}`), `Required output obligation survives for ${slotKey}`);
  assertStatus(await requestJson(decisionsPath, { method: "POST", body: initialBody }), 409, "evidence-use addition rejects stale snapshots");
  await decide(addDecision, "duplicate outline assignment is rejected", 400);

  const moveDecision = {
    operation: "update", evidenceId, useId: addedUse.useId,
    sectionId: "scope-of-inspection", slotKey: "identity", role: "required_structured",
    reason: "Audit moving only the added assignment to another section.",
  };
  const foreignUse = allUses(planning).find((use) => !use.evidenceIds.includes(evidenceId));
  assert.ok(foreignUse, "Fixture contains an assignment owned by another evidence record");
  for (const useId of [undefined, 17, [], "unknown-use-id", foreignUse.useId]) {
    await decide({ ...moveDecision, useId }, "use update rejects missing, malformed or foreign assignment IDs", 400);
    await decide({ operation: "remove", evidenceId, useId, reason: "Invalid removal audit." }, "use removal rejects missing, malformed or foreign assignment IDs", 400);
  }
  await decide(moveDecision, "move one evidence use to another section");
  const movedUse = uses().find((use) => use.useId === addedUse.useId);
  assert.equal(movedUse?.sectionId, "scope-of-inspection", "Moving an assignment preserves its ID and changes its destination");
  assert.equal(movedUse?.slotKey, "identity");
  assert.equal(uses().length, originalUses.length + 1, "Moving an assignment does not duplicate it");
  assert.ok(!uses().some((use) => use.sectionId === "general-tank-information" && use.slotKey === "configuration"), "Moving a use removes its previous destination");
  assert.ok(!planning.sectionPlans.find((plan) => plan.sectionId === "general-tank-information").outputObligations.some((entry) => entry.evidenceIds.includes(evidenceId) && entry.targetBlockId.endsWith(":configuration")), "Moving a use removes its previous output obligation");
  for (const original of originalUses) assert.deepEqual(uses().find((use) => use.useId === original.useId), original, "Moving a use preserves its siblings");
  const movedPlanning = await requestJson(planningPath);
  assertStatus(movedPlanning, 200, "reload individually moved evidence use");
  assert.equal(movedPlanning.body.snapshotId, planning.snapshotId, "Saved decisions replay to the same snapshot");
  assert.deepEqual(uses(movedPlanning.body), uses(), "Reload preserves all destinations and the moved use ID");

  const removal = { operation: "remove", evidenceId, useId: addedUse.useId, reason: "Audit removing only one destination link." };
  await decide(removal, "remove one evidence use while preserving siblings");
  assert.deepEqual(uses(), originalUses, "Removing the added use leaves all original uses");
  await decide(removal, "removed use cannot be removed again", 400);
  for (const original of originalUses) {
    await decide({ ...removal, useId: original.useId }, "remove one remaining destination without deleting the source");
  }
  assert.equal(uses().length, 0, "Every destination link can be removed independently");
  assert.ok(planning.unresolvedEvidence.some((entry) => entry.evidenceId === evidenceId && entry.reason === "unassigned"), "An evidence record without destinations is retained for assignment review");
  const unassignedPlanning = await requestJson(planningPath);
  assertStatus(unassignedPlanning, 200, "reload evidence after its final assignment is removed");
  assert.equal(uses(unassignedPlanning.body).length, 0, "Reload does not restore removed rule-based assignments");
  assert.ok(unassignedPlanning.body.evidenceRecords.some((record) => record.evidenceId === evidenceId), "Reload retains the unassigned source evidence");

  // Restore this isolated fixture's original destinations for the generation checks below.
  for (const original of originalUses) {
    await decide({ operation: "add", evidenceId, sectionId: original.sectionId, slotKey: original.slotKey, role: original.role, reason: "Restore the original audit fixture destination after removal checks." }, "assign retained evidence to its original outline block");
  }
  assert.ok(!planning.unresolvedEvidence.some((entry) => entry.evidenceId === evidenceId && entry.reason === "unassigned"), "Reassignment clears the unassigned review issue");
  const restored = await requestJson(`/api/v1/report-jobs/${reportJobId}`);
  assertStatus(restored, 200, "reload report after evidence-use review");
  assert.equal(sha256(JSON.stringify(restored.body.exportPackage)), sourcePackageHash, "Reviewing destination links never mutates the imported package");
  assert.deepEqual(restored.body.sectionDrafts, sourceReport.body.sectionDrafts, "Candidate review never changes ordinary report drafts or approval state");
  assert.ok(!restored.body.sectionPlanning, "Evaluation review does not activate candidate planning in ordinary report state");
  const persisted = await requestJson(planningPath);
  assertStatus(persisted, 200, "reload the separate evaluation planning state");
  assert.equal(persisted.body.snapshotId, planning.snapshotId, "Evaluation replay retains the final classification snapshot");
  assert.deepEqual(uses(persisted.body), uses(), "Evaluation replay retains final per-use assignments");
}

async function linkIsolatedOutlineEvaluation(databaseUrl, reportJobId, actorUserId) {
  const client = new Client({ connectionString: databaseUrl, ssl: false });
  await client.connect();
  try {
    // This trusted diagnostic registration exists only in the disposable audit schema.
    // Imported app metadata must never create this association in the application.
    const result = await client.query(
      `INSERT INTO report_evaluation_cases (
        evaluation_case_id, tenant_id, workspace_id, display_name, report_family,
        input_inspection_id, gold_document_id, gold_source_report_name, dataset_split,
        label_status, config_json, created_by_user_id, created_at_iso, updated_at_iso
      ) SELECT $1, rj.tenant_id, rj.workspace_id, 'Isolated outline diagnostic',
        'api_653_internal_external', rj.inspection_id, NULL, 'Isolated native outline diagnostic',
        'validation', 'machine_proposed',
        jsonb_build_object('sourceReportJobId', rj.report_job_id, 'evaluationTrack', 'native_diagnostic',
          'learningEligible', FALSE, 'promotionEligible', FALSE),
        $3, NOW(), NOW()
      FROM report_jobs rj WHERE rj.report_job_id = $2`,
      [`outline-audit-${reportJobId}`, reportJobId, actorUserId],
    );
    assert.equal(result.rowCount, 1, "Isolated evaluation case is linked to the authorized fixture report");
  } finally {
    await client.end();
  }
}

async function unlinkIsolatedOutlineEvaluation(databaseUrl, reportJobId) {
  const client = new Client({ connectionString: databaseUrl, ssl: false });
  await client.connect();
  try {
    const result = await client.query(
      "DELETE FROM report_evaluation_cases WHERE evaluation_case_id = $1 AND config_json->>'sourceReportJobId' = $2",
      [`outline-audit-${reportJobId}`, reportJobId],
    );
    assert.equal(result.rowCount, 1, "Isolated diagnostic case is removed before baseline evaluation checks");
  } finally {
    await client.end();
  }
}

async function auditOutlineEvaluationIsolation(reportJobId, adminCookie) {
  const path = `/api/v1/report-jobs/${reportJobId}/outline-evaluations`;
  const before = await requestJson(`/api/v1/report-jobs/${reportJobId}`);
  const planning = await requestJson(`/api/v1/report-jobs/${reportJobId}/section-plans`);
  assertStatus(before, 200, "capture baseline report before candidate evaluation");
  assertStatus(planning, 200, "load candidate snapshot for an explicit evaluation");
  const body = { sectionId: "general-tank-information", expectedSnapshotId: planning.body.snapshotId };
  assertStatus(await requestJson(path, { method: "POST", cookie: null, body }), 401, "outline evaluation requires authentication");
  assertStatus(await requestJson(path, { method: "POST", body }), 403, "ordinary inspector cannot execute candidate evaluation");
  assertStatus(await requestJson(path, { method: "POST", cookie: adminCookie, body: { ...body, expectedSnapshotId: "stale-candidate-snapshot" } }), 409, "outline evaluation rejects a stale evidence snapshot");
  const policiesBefore = await requestJson("/api/v1/admin/system-rl/status", { cookie: adminCookie });
  assertStatus(policiesBefore, 200, "capture policies before standalone candidate evaluation");
  const result = await requestJson(path, { method: "POST", cookie: adminCookie, body });
  assertStatus(result, 200, "administrator evaluates the candidate outline in isolation");
  assert.ok(result.body.generatedContent, "Candidate evaluation returns reviewable generated content");
  assert.equal(result.body.sectionPlanningSnapshotId, planning.body.snapshotId, "Candidate output is bound to the reviewed snapshot");
  const evalRun = result.body.evalRun;
  assert.equal(evalRun.experimentContract, "outline_evidence_v2");
  assert.equal(evalRun.runPurpose, "frozen_diagnostic");
  for (const flag of ["independentQualityEligible", "learningEligible", "promotionEligible"]) assert.equal(evalRun[flag], false, `Candidate diagnostic cannot set ${flag}`);
  const after = await requestJson(`/api/v1/report-jobs/${reportJobId}`);
  assertStatus(after, 200, "reload baseline report after standalone candidate evaluation");
  assert.ok(!after.body.sectionPlanning, "Candidate evaluation does not switch ordinary report state to the candidate pipeline");
  assert.deepEqual(after.body.sectionDrafts, before.body.sectionDrafts, "Candidate evaluation cannot save or approve production drafts");
  assert.deepEqual(after.body.exportPackage, before.body.exportPackage, "Candidate evaluation cannot mutate imported evidence");
  const policiesAfter = await requestJson("/api/v1/admin/system-rl/status", { cookie: adminCookie });
  assertStatus(policiesAfter, 200, "reload policies after standalone candidate evaluation");
  assert.deepEqual(policiesAfter.body.policies, policiesBefore.body.policies, "Candidate evaluation neither trains nor promotes a policy");
}

function getLayoutVersion(state, sectionId) {
  const version = state.layoutOverrides?.find(
    (layout) => layout.sectionId === sectionId,
  )?.version ?? 0;
  if (!Number.isInteger(version) || version < 0) {
    throw new Error(`Layout ${sectionId} did not expose a valid concurrency version.`);
  }
  return version;
}

function getManualInputsRevision(state) {
  const revision = state.reportJob?.manualInputsRevision;
  if (!Number.isInteger(revision) || revision < 0) {
    throw new Error("Report state did not expose a valid manual-input revision.");
  }
  return revision;
}

function sha256(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

function assertStatus(result, expectedStatus, label) {
  if (result.status !== expectedStatus) {
    throw new Error(`${label}: expected HTTP ${expectedStatus}, received ${result.status}. Body: ${result.rawText ?? result.bytes}`);
  }
}

function assertNoInternalErrorLeak(rawText, label) {
  if (/FOREIGN KEY|constraint failed|PostgreSQL|duplicate key|violates .* constraint/i.test(rawText)) {
    throw new Error(`${label}: response leaked database internals: ${rawText}`);
  }
}

function rewriteVolatileExportTimestamps(value, timestamp) {
  if (Array.isArray(value)) {
    value.forEach((item) => rewriteVolatileExportTimestamps(item, timestamp));
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, nestedValue] of Object.entries(value)) {
    if (key === "exportedAtIso" || key === "updatedAtIso") {
      value[key] = timestamp;
    } else {
      rewriteVolatileExportTimestamps(nestedValue, timestamp);
    }
  }
}
