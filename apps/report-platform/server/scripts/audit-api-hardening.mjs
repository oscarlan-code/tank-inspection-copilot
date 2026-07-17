import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const appRoot = new URL("../..", import.meta.url).pathname;
const tempDir = mkdtempSync(join(tmpdir(), "laiq-report-platform-api-"));
const port = 19000 + Math.floor(Math.random() * 1000);
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["./server/index.mjs"], {
  cwd: appRoot,
  env: {
    ...process.env,
    REPORT_PLATFORM_API_HOST: "127.0.0.1",
    REPORT_PLATFORM_API_PORT: String(port),
    REPORT_PLATFORM_DB_PATH: join(tempDir, "report-platform.sqlite"),
    REPORT_PLATFORM_ARTIFACT_ROOT: join(tempDir, "artifacts"),
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let serverOutput = "";
let activeCookie = "";
server.stdout.on("data", (chunk) => {
  serverOutput += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  serverOutput += chunk.toString();
});

try {
  await waitForHealth();

  const unauthenticatedBootstrap = await requestJson("/api/v1/report-jobs/bootstrap/v10-api-standard", {
    cookie: null,
  });
  assertStatus(unauthenticatedBootstrap, 401, "bootstrap requires authentication");

  const authConfig = await requestJson("/api/v1/auth/config", { cookie: null });
  assertStatus(authConfig, 200, "load authentication configuration");
  const inspector = findDevelopmentUser(authConfig.body, "Inspector");
  const reviewer = findDevelopmentUser(authConfig.body, "Reviewer");
  const clientViewer = findDevelopmentUser(authConfig.body, "Client Viewer");
  const superAdmin = findDevelopmentUser(authConfig.body, "Super Admin");
  const isolatedInspector = authConfig.body.developmentUsers.find(
    (user) => user.userId === "demo-isolated-inspector",
  );
  if (!isolatedInspector) {
    throw new Error("Expected isolated development identity for tenant-boundary audit.");
  }
  activeCookie = await loginAs(inspector.userId);

  const bootstrap = await requestJson("/api/v1/report-jobs/bootstrap/v10-api-standard");
  assertStatus(bootstrap, 200, "bootstrap report job");

  const reportJobId = bootstrap.body.reportJob.reportJobId;
  const actorUserId = bootstrap.body.authorizationContext.actorUserId;
  if (actorUserId !== inspector.userId) {
    throw new Error(`Expected authenticated actor ${inspector.userId}, received ${actorUserId}.`);
  }

  const missingCorrosionSourceApproval = await requestJson(
    `/api/v1/report-jobs/${reportJobId}/sections/floor-plate-corrosion-plan/approve`,
    {
      method: "POST",
      body: {},
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
      body: { layoutMap: pendingCorrosionLayout },
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
      body: {},
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
      body: { layoutMap: approvedCorrosionLayout },
    },
  );
  assertStatus(approvedCorrosionSave, 200, "save approved floor corrosion layout");
  const approvedCorrosionSection = await requestJson(
    `/api/v1/report-jobs/${reportJobId}/sections/floor-plate-corrosion-plan/approve`,
    {
      method: "POST",
      body: {},
    },
  );
  assertStatus(approvedCorrosionSection, 200, "approved floor corrosion placements allow section approval");
  const changedCorrosionSave = await requestJson(
    `/api/v1/report-jobs/${reportJobId}/layout-overrides/floor-plate-corrosion-plan`,
    {
      method: "PATCH",
      body: { layoutMap: pendingCorrosionLayout },
    },
  );
  assertStatus(changedCorrosionSave, 200, "changing floor corrosion layout invalidates approval");
  const changedCorrosionSection = changedCorrosionSave.body.sectionDrafts.find(
    (section) => section.sectionId === "floor-plate-corrosion-plan",
  );
  if (changedCorrosionSection?.approved !== false || changedCorrosionSection?.reviewRequired !== true) {
    throw new Error("Changing a layout override did not invalidate section approval.");
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
      body: { actorUserId: "forged-user" },
    },
  );
  assertStatus(unknownSection, 404, "unknown section returns 404");

  const isolatedCookie = await loginAs(isolatedInspector.userId);
  const crossTenantRead = await requestJson(`/api/v1/report-jobs/${reportJobId}`, {
    cookie: isolatedCookie,
  });
  assertStatus(crossTenantRead, 403, "cross-tenant report read is denied");

  const invalidToken = await requestJson(`/api/v1/report-jobs/${reportJobId}`, {
    cookie: `${"laiq_report_session"}=not-a-valid-session`,
  });
  assertStatus(invalidToken, 401, "invalid session is rejected");

  const reviewerCookie = await loginAs(reviewer.userId);
  const reviewerRead = await requestJson(`/api/v1/report-jobs/${reportJobId}`, {
    cookie: reviewerCookie,
  });
  assertStatus(reviewerRead, 200, "reviewer can access assigned workspace report");

  const clientCookie = await loginAs(clientViewer.userId);
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

  const superAdminCookie = await loginAs(superAdmin.userId);
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

  const generated = await requestJson(
    `/api/v1/report-jobs/${reportJobId}/sections/shell-plate-thickness-measurements/generate`,
    {
      method: "POST",
      body: { actorUserId: "forged-user" },
    },
  );
  assertStatus(generated, 200, "generate shell plate thickness section");
  if (generated.body.authorizationContext.actorUserId !== inspector.userId) {
    throw new Error("Request body actorUserId overrode the authenticated principal.");
  }

  const approved = await requestJson(
    `/api/v1/report-jobs/${reportJobId}/sections/shell-plate-thickness-measurements/approve`,
    {
      method: "POST",
      body: { actorUserId: "forged-user" },
    },
  );
  assertStatus(approved, 200, "approve generated section");

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

  const generatedFloorLayout = await requestJson(
    `/api/v1/report-jobs/${reportJobId}/sections/floor-plate-layout-platemaps-numbering-system/generate`,
    {
      method: "POST",
      body: {},
    },
  );
  assertStatus(generatedFloorLayout, 200, "generate app-owned floor layout section");

  const approvedFloorLayout = await requestJson(
    `/api/v1/report-jobs/${reportJobId}/sections/floor-plate-layout-platemaps-numbering-system/approve`,
    {
      method: "POST",
      body: {},
    },
  );
  assertStatus(approvedFloorLayout, 200, "approve app-owned floor layout section");

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

  console.log("API hardening audit passed: negative routes return controlled errors and valid generation/export still works.");
} finally {
  server.kill("SIGTERM");
  rmSync(tempDir, { recursive: true, force: true });
}

async function waitForHealth() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 10000) {
    try {
      const result = await requestJson("/api/health");
      if (result.status === 200) return;
    } catch {
      // Server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`API server did not become healthy. Output:\n${serverOutput}`);
}

async function requestJson(pathname, options = {}) {
  const headers = { "Content-Type": "application/json" };
  const cookie = options.cookie === undefined ? activeCookie : options.cookie;
  if (cookie) headers.Cookie = cookie;
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

async function loginAs(userId) {
  const login = await requestJson("/api/v1/auth/development-login", {
    method: "POST",
    body: { userId },
    cookie: null,
  });
  assertStatus(login, 200, `development login for ${userId}`);
  const cookie = login.setCookie?.split(";", 1)[0];
  if (!cookie) {
    throw new Error(`Development login for ${userId} did not return a session cookie.`);
  }
  return cookie;
}

function findDevelopmentUser(config, roleLabel) {
  const normalizedRole = roleLabel.toLowerCase();
  const user = config.developmentUsers.find((candidate) =>
    [...candidate.platformRoles, ...candidate.workspaceMemberships.flatMap((membership) => membership.roles)]
      .some((role) => role.toLowerCase() === normalizedRole),
  );
  if (!user) {
    throw new Error(`Expected a development identity with role ${roleLabel}.`);
  }
  return user;
}

function assertStatus(result, expectedStatus, label) {
  if (result.status !== expectedStatus) {
    throw new Error(`${label}: expected HTTP ${expectedStatus}, received ${result.status}. Body: ${result.rawText ?? result.bytes}`);
  }
}

function assertNoInternalErrorLeak(rawText, label) {
  if (/FOREIGN KEY|SQLITE|constraint failed|DatabaseSync/i.test(rawText)) {
    throw new Error(`${label}: response leaked database internals: ${rawText}`);
  }
}
