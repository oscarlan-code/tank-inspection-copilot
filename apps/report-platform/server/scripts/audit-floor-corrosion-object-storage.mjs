import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import pg from "pg";
import { buildApiStandardFixturePackage } from "../api-standard-fixture.mjs";
import { createDurableFloorCorrosionArtifactService } from "../durable-floor-corrosion-artifacts.mjs";
import { createFloorCorrosionArtifactService } from "../floor-corrosion-artifacts.mjs";
import { createFloorCorrosionWorkerService } from "../floor-corrosion-worker-service.mjs";
import { buildLayoutMapFigureSvg, getEffectiveLayoutMap } from "../layout-map-figure.mjs";
import { createS3ObjectStorage } from "../object-storage.mjs";
import { API_STANDARD_REPORT_TOC } from "../report-toc.mjs";
import { createReportStore } from "../store.mjs";

const { Client } = pg;
const sourceDatabaseUrl = process.env.REPORT_PLATFORM_TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!sourceDatabaseUrl) {
  throw new Error("DATABASE_URL or REPORT_PLATFORM_TEST_DATABASE_URL is required.");
}
const mflPdfPath = process.env.REPORT_PLATFORM_MFL_REFERENCE_PDF
  ?? "/Users/oscar/Public/irs/mfl and floor layout /MFL Individual Plate Maps.pdf";
const fixture = buildApiStandardFixturePackage(JSON.parse(readFileSync(
  new URL("../../src/fixtures/v3-product-export-shell-internal.json", import.meta.url),
  "utf8",
)));
const workingDirectory = mkdtempSync(join(tmpdir(), "laiq-floor-object-storage-audit-"));
const testSchema = await createAuditSchema(sourceDatabaseUrl);
const reportStore = await createReportStore({ databaseUrl: testSchema.url });
const objectStorage = createS3ObjectStorage();
const artifactRoot = join(workingDirectory, "processor");
const localProcessor = createFloorCorrosionArtifactService({
  artifactRoot,
});
const localArtifacts = createFloorCorrosionWorkerService({
  artifactRoot,
  localArtifacts: localProcessor,
  maxConcurrency: 1,
  maxQueueLength: 2,
});
const artifacts = createDurableFloorCorrosionArtifactService({
  localArtifacts,
  objectStorage,
  reportStore,
});

let cleanup;
try {
  await objectStorage.ping();
  const state = await reportStore.ensureSeedReport({
    bootstrapKey: `floor-object-storage-audit-${Date.now()}`,
    exportPackage: fixture,
  });
  const reportJobId = state.reportJob.reportJobId;
  const actorUserId = state.reportJob.createdByUserId;
  const section = API_STANDARD_REPORT_TOC.find((item) => item.id === "floor-plate-corrosion-plan");
  const layoutMap = getEffectiveLayoutMap(state, section);
  assert(layoutMap?.appFigure?.svg, "The V3 fixture did not provide its immutable app floor figure.");
  assert(layoutMap.plates.length === 34, `Expected 34 app-owned floor plates, received ${layoutMap.plates.length}.`);

  const result = await artifacts.importMflPdf({
    actorUserId,
    layoutMap,
    pdfPath: mflPdfPath,
    reportJobId,
    sourceDocumentName: basename(mflPdfPath),
  });
  const runId = result.summary.artifactRunId;
  cleanup = () => artifacts.deleteArtifactRun({ reportJobId, runId });
  assert(result.summary.overlayCount === 34, `Expected 34 persisted overlays, received ${result.summary.overlayCount}.`);
  assert(result.summary.errorCount === 0, "The persisted MFL import contains validation errors.");
  assert(result.summary.unmatchedScanCount === 0, "The persisted MFL import contains unmatched scans.");
  assert(
    !existsSync(join(workingDirectory, "processor", reportJobId, runId)),
    "The local MFL processor run remained after S3 persistence.",
  );

  const objectKeys = await reportStore.listReportArtifactRunObjectKeys({
    artifactRunId: runId,
    reportJobId,
  });
  assert(objectKeys.length >= 70, `Expected source, manifest, overlays, and previews in object storage; received ${objectKeys.length}.`);
  await reportStore.saveLayoutOverride(reportJobId, section.id, result.layoutMap, {
    expectedVersion: 0,
  });
  const reloaded = await reportStore.loadReportJobState(reportJobId);
  const reloadedMap = getEffectiveLayoutMap(reloaded, section);
  const hydrated = await artifacts.hydrateInlineArtifacts(reportJobId, reloadedMap);
  assert(
    hydrated.floorCorrosion.overlays.every(
      (overlay) => overlay.inlineImageDataUrl?.startsWith("data:image/png;base64,")
        && overlay.sourcePreviewInlineImageDataUrl?.startsWith("data:image/png;base64,"),
    ),
    "Reloaded MFL overlays did not hydrate from object storage for report rendering.",
  );
  const figure = buildLayoutMapFigureSvg(hydrated);
  assert(figure.svg.includes("floor-corrosion-overlay"), "The hydrated report figure omitted MFL corrosion overlays.");
  assert(figure.svg.includes("Floor Layout Map"), "The hydrated report figure omitted the immutable app layout.");

  await cleanup();
  cleanup = null;
  assert(
    (await reportStore.listReportArtifactRunObjectKeys({ artifactRunId: runId, reportJobId })).length === 0,
    "MFL object-storage cleanup left PostgreSQL artifact records.",
  );

  console.log(JSON.stringify({
    ok: true,
    appFloorPlateCount: layoutMap.plates.length,
    overlayCount: result.summary.overlayCount,
    persistedObjectCount: objectKeys.length,
    processorRunRemoved: true,
    reloadedFromObjectStorage: true,
  }, null, 2));
} finally {
  if (cleanup) await cleanup().catch(() => {});
  await reportStore.close();
  await dropAuditSchema(testSchema);
  rmSync(workingDirectory, { recursive: true, force: true });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function createAuditSchema(sourceUrl) {
  const target = new URL(sourceUrl);
  const schemaName = `laiq_floor_object_audit_${process.pid}_${Date.now()}`;
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
