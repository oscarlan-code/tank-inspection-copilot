import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import pg from "pg";
import { createDurableFloorCorrosionArtifactService } from "../durable-floor-corrosion-artifacts.mjs";
import { createReportStore } from "../store.mjs";

const { Client } = pg;
const sourceDatabaseUrl = process.env.REPORT_PLATFORM_TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!sourceDatabaseUrl) {
  throw new Error("DATABASE_URL or REPORT_PLATFORM_TEST_DATABASE_URL is required.");
}

const fixture = JSON.parse(readFileSync(
  new URL("../../src/fixtures/v3-product-export-shell-internal.json", import.meta.url),
  "utf8",
));
const workingDirectory = mkdtempSync(join(tmpdir(), "laiq-durable-floor-artifact-audit-"));
const testSchema = await createAuditSchema(sourceDatabaseUrl);
const reportStore = await createReportStore({ databaseUrl: testSchema.url });
const localArtifacts = createAuditLocalArtifactProcessor(join(workingDirectory, "processor"));
const objectStorage = createAuditObjectStorage();
const artifacts = createDurableFloorCorrosionArtifactService({
  localArtifacts,
  objectStorage,
  reportStore,
});

try {
  const state = await reportStore.ensureSeedReport({
    bootstrapKey: `durable-floor-artifact-audit-${Date.now()}`,
    exportPackage: fixture,
  });
  const reportJobId = state.reportJob.reportJobId;
  const actorUserId = state.reportJob.createdByUserId;
  const result = await artifacts.importMflPdf({
    actorUserId,
    layoutMap: { id: "audit-floor", plates: [{ id: "1.1" }] },
    pdfBuffer: Buffer.from("%PDF-1.4\nLAIQ durable MFL artifact audit\n", "utf8"),
    reportJobId,
    sourceDocumentName: "MFL audit source.pdf",
  });
  const runId = result.summary.artifactRunId;

  assert(!localArtifacts.hasRun(reportJobId, runId), "Temporary MFL processor output was not deleted after persistence.");
  const objectKeys = await reportStore.listReportArtifactRunObjectKeys({
    artifactRunId: runId,
    reportJobId,
  });
  assert(objectKeys.length === 4, `Expected four persisted MFL artifacts, received ${objectKeys.length}.`);
  assert(objectStorage.size === 4, "S3-compatible audit storage did not receive every MFL artifact.");
  assert(objectKeys.every((key) => !key.includes("MFL audit source")), "Object keys leaked the uploaded filename.");

  const overlay = await artifacts.readArtifact({
    artifactFileName: "plate-1.1.png",
    reportJobId,
    runId,
  });
  assert(overlay.equals(localArtifacts.overlayBytes), "Persisted MFL overlay bytes changed during object storage.");

  const hydrated = await artifacts.hydrateInlineArtifacts(reportJobId, result.layoutMap);
  const hydratedOverlay = hydrated.floorCorrosion.overlays[0];
  assert(
    hydratedOverlay.inlineImageDataUrl === `data:image/png;base64,${localArtifacts.overlayBytes.toString("base64")}`,
    "DOCX hydration did not read the MFL overlay from durable object storage.",
  );
  assert(
    hydratedOverlay.sourcePreviewInlineImageDataUrl
      === `data:image/png;base64,${localArtifacts.previewBytes.toString("base64")}`,
    "DOCX hydration did not read the immutable MFL source preview from durable object storage.",
  );

  const overlayMetadata = await reportStore.getReportArtifactObject({
    artifactFileName: "plate-1.1.png",
    artifactRunId: runId,
    reportJobId,
  });
  objectStorage.corrupt(overlayMetadata.objectKey);
  await expectError(
    () => artifacts.readArtifact({
      artifactFileName: "plate-1.1.png",
      reportJobId,
      runId,
    }),
    "artifact_checksum_mismatch",
  );
  objectStorage.restore();

  await artifacts.deleteArtifactRun({ reportJobId, runId });
  assert(objectStorage.size === 0, "Deleting an MFL run did not remove its object-storage artifacts.");
  assert(
    (await reportStore.listReportArtifactRunObjectKeys({ artifactRunId: runId, reportJobId })).length === 0,
    "Deleting an MFL run did not remove its PostgreSQL metadata.",
  );

  console.log(
    "Durable floor-corrosion artifact audit passed: ephemeral processing, PostgreSQL ownership, S3 persistence, checksum reads, DOCX hydration, and cleanup.",
  );
} finally {
  await reportStore.close();
  await dropAuditSchema(testSchema);
  rmSync(workingDirectory, { recursive: true, force: true });
}

function createAuditLocalArtifactProcessor(root) {
  const overlayBytes = Buffer.from("audit-transparent-corrosion-overlay", "utf8");
  const previewBytes = Buffer.from("audit-immutable-mfl-source-preview", "utf8");
  return {
    overlayBytes,
    previewBytes,
    deleteArtifactRun({ reportJobId, runId }) {
      rmSync(runDirectory(reportJobId, runId), { recursive: true, force: true });
    },
    deleteReportArtifacts(reportJobId) {
      rmSync(join(root, reportJobId), { recursive: true, force: true });
    },
    getArtifactContentType(fileName) {
      return String(fileName).toLowerCase().endsWith(".svg") ? "image/svg+xml" : "image/png";
    },
    hasRun(reportJobId, runId) {
      return existsSync(runDirectory(reportJobId, runId));
    },
    hydrateInlineArtifacts(_reportJobId, layoutMap) {
      return layoutMap;
    },
    importLayoutPdf() {
      throw new Error("Layout import is outside this persistence audit.");
    },
    importMflPdf({ pdfBuffer, reportJobId }) {
      const runId = randomUUID();
      const directory = runDirectory(reportJobId, runId);
      const scans = join(directory, "scans");
      mkdirSync(scans, { recursive: true });
      writeFileSync(join(directory, "source.pdf"), pdfBuffer);
      writeFileSync(join(directory, "floor-corrosion-map.json"), "{}\n");
      writeFileSync(join(scans, "plate-1.1.png"), overlayBytes);
      writeFileSync(join(scans, "plate-1.1-source.png"), previewBytes);
      const baseUri = `/api/v1/report-jobs/${reportJobId}/floor-corrosion/artifacts/${runId}`;
      return {
        layoutMap: {
          id: "audit-floor",
          floorCorrosion: {
            artifactRunId: runId,
            overlays: [{
              artifactUri: `${baseUri}/plate-1.1.png`,
              hostPlateId: "1.1",
              scanPlateId: "1.1",
              sourcePreviewArtifactUri: `${baseUri}/plate-1.1-source.png`,
              status: "orientation_review_required",
            }],
          },
        },
        summary: { artifactRunId: runId, overlayCount: 1 },
      };
    },
    listRunArtifactFiles({ reportJobId, runId }) {
      const directory = runDirectory(reportJobId, runId);
      return listFiles(directory).map((localPath) => {
        const relativePath = relative(directory, localPath).split(sep).join("/");
        return {
          byteSize: statSync(localPath).size,
          localPath,
          mediaType: relativePath.endsWith(".pdf")
            ? "application/pdf"
            : relativePath.endsWith(".json")
              ? "application/json"
              : "image/png",
          relativePath,
        };
      });
    },
    readArtifact() {
      throw new Error("Durable reads must not fall back to the local processor.");
    },
    updatePlacement({ layoutMap }) {
      return layoutMap;
    },
  };

  function runDirectory(reportJobId, runId) {
    return join(root, reportJobId, runId);
  }
}

function createAuditObjectStorage() {
  const stored = new Map();
  const originals = new Map();
  return {
    assertConfigured() {},
    async deleteObjects(keys) {
      keys.forEach((key) => stored.delete(key));
    },
    async getObjectBuffer({ expectedByteSize, expectedSha256, mediaType, objectKey }) {
      const object = stored.get(objectKey);
      if (!object) throw artifactError("Stored artifact was not found.", "artifact_not_found", 404);
      const sha256 = createHash("sha256").update(object.bytes).digest("hex");
      if (object.bytes.length !== expectedByteSize) throw artifactError("Stored artifact size mismatch.", "artifact_size_mismatch");
      if (sha256 !== expectedSha256) throw artifactError("Stored artifact checksum mismatch.", "artifact_checksum_mismatch");
      if (object.mediaType !== mediaType) throw artifactError("Stored artifact media type mismatch.", "artifact_media_type_mismatch");
      return Buffer.from(object.bytes);
    },
    get size() {
      return stored.size;
    },
    async putFile({ filePath, mediaType, objectKey }) {
      const bytes = readFileSync(filePath);
      const object = { bytes, mediaType };
      stored.set(objectKey, object);
      originals.set(objectKey, object);
      return {
        byteSize: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      };
    },
    corrupt(key) {
      const object = stored.get(key);
      stored.set(key, { ...object, bytes: Buffer.alloc(object.bytes.length, 0x58) });
    },
    restore() {
      stored.clear();
      originals.forEach((value, key) => stored.set(key, value));
    },
  };
}

function artifactError(message, code, statusCode = 409) {
  return Object.assign(new Error(message), { code, statusCode });
}

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const child = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(child) : entry.isFile() ? [child] : [];
  });
}

async function expectError(action, expectedCode) {
  try {
    await action();
  } catch (error) {
    if (error?.code === expectedCode) return;
    throw error;
  }
  throw new Error(`Expected ${expectedCode}.`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function createAuditSchema(sourceUrl) {
  const target = new URL(sourceUrl);
  const schemaName = `laiq_floor_artifact_audit_${process.pid}_${Date.now()}`;
  const client = new Client({
    connectionString: sourceUrl,
    ssl: process.env.REPORT_PLATFORM_DB_SSL === "require" ? { rejectUnauthorized: true } : false,
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
    ssl: process.env.REPORT_PLATFORM_DB_SSL === "require" ? { rejectUnauthorized: true } : false,
  });
  await client.connect();
  await client.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
  await client.end();
}
