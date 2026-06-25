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
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let serverOutput = "";
server.stdout.on("data", (chunk) => {
  serverOutput += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  serverOutput += chunk.toString();
});

try {
  await waitForHealth();

  const bootstrap = await requestJson("/api/v1/report-jobs/bootstrap/v10-api-standard");
  assertStatus(bootstrap, 200, "bootstrap report job");

  const reportJobId = bootstrap.body.reportJob.reportJobId;
  const actorUserId = bootstrap.body.authorizationContext.actorUserId;
  const fixtureExport = await requestJson("/api/v1/exports/android-v3-product/v10-api-standard.json");
  assertStatus(fixtureExport, 200, "load V3 fixture");

  const unknownJob = await requestJson("/api/v1/report-jobs/not-a-report-job");
  assertStatus(unknownJob, 404, "unknown report job returns 404");

  const unknownSection = await requestJson(
    `/api/v1/report-jobs/${reportJobId}/sections/not-a-section/generate`,
    {
      method: "POST",
      body: { actorUserId },
    },
  );
  assertStatus(unknownSection, 404, "unknown section returns 404");

  const invalidActor = await requestJson(
    `/api/v1/report-jobs/${reportJobId}/sections/shell-plate-thickness-measurements/approve`,
    {
      method: "POST",
      body: { actorUserId: "missing-user" },
    },
  );
  assertStatus(invalidActor, 400, "invalid approval actor returns 400");
  assertNoInternalErrorLeak(invalidActor.rawText, "invalid approval actor");

  const invalidPackage = await requestJson("/api/v1/imports/android-v3-product", {
    method: "POST",
    body: { packageType: "not-valid", schemaVersion: 999 },
  });
  assertStatus(invalidPackage, 400, "invalid export package returns 400");

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
      body: { actorUserId },
    },
  );
  assertStatus(generated, 200, "generate shell plate thickness section");

  const approved = await requestJson(
    `/api/v1/report-jobs/${reportJobId}/sections/shell-plate-thickness-measurements/approve`,
    {
      method: "POST",
      body: { actorUserId },
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
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method ?? "GET",
    headers: { "Content-Type": "application/json" },
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
  };
}

async function requestBinary(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const bytes = (await response.arrayBuffer()).byteLength;

  return {
    status: response.status,
    bytes,
  };
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
