import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { createCanonicalReportReviewService } from "../canonical-report-review.mjs";
import { createS3ObjectStorage } from "../object-storage.mjs";
import { createPostgresDatabase } from "../storage/postgres.mjs";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const sourceRoot = process.env.PRECEDENT_SAMPLE_REPORTS_DIR ?? "/Users/oscar/Public/irs/Sample Reports";
const outputRoot = process.env.CANONICAL_INGESTION_OUTPUT_DIR
  ?? join(process.cwd(), ".local", "canonical-kb-ingestion");
const db = await createPostgresDatabase({ databaseUrl });
const storage = createS3ObjectStorage();
const service = createCanonicalReportReviewService({
  db,
  createError: (statusCode, message, code) => Object.assign(new Error(message), { statusCode, code }),
});

try {
  storage.assertConfigured();
  mkdirSync(outputRoot, { recursive: true });
  const queue = await service.getQueue();
  const approved = queue.reports.filter((report) => report.status === "approved_for_ingestion");
  if (approved.length === 0) throw new Error("No canonical reports are approved for ingestion.");

  let completed = 0;
  let skipped = 0;
  const failures = [];
  await saveProgress({ status: "running", total: approved.length, processed: 0, failures, currentFileName: null, started: true });
  for (const [index, report] of approved.entries()) {
    const asset = report.assets.find((candidate) => candidate.assetId === report.selectedCanonicalAssetId);
    if (!asset) throw new Error(`Selected canonical rendition is missing for ${report.groupKey}.`);
    const sourcePath = join(sourceRoot, asset.relativePath);
    const outputDirectory = join(outputRoot, asset.assetId);
    const manifestPath = join(outputDirectory, "manifest.json");
    const existing = await db.prepare(
      "SELECT document_id FROM kb_documents WHERE document_id = ? AND source_sha256 IS NOT NULL",
    ).get(`canonical_${asset.assetId}`);
    if (existing && existsSync(manifestPath)) {
      skipped += 1;
      await saveProgress({ status: "running", total: approved.length, processed: completed + skipped, failures, currentFileName: asset.fileName });
      console.error(`[${index + 1}/${approved.length}] already ingested: ${asset.fileName}`);
      continue;
    }

    const safeName = basename(asset.fileName).replace(/[^a-zA-Z0-9._-]+/g, "-");
    const objectKey = `kb-sources/canonical/${asset.assetId}/${safeName}`;
    await saveProgress({ status: "running", total: approved.length, processed: completed + skipped, failures, currentFileName: asset.fileName });
    console.error(`[${index + 1}/${approved.length}] storing: ${asset.fileName}`);
    await storage.putFile({
      filePath: sourcePath,
      mediaType: mediaTypeFor(sourcePath),
      objectId: asset.assetId,
      objectKey,
    });
    rmSync(outputDirectory, { recursive: true, force: true });

    const args = [
      "run", "--frozen", "kb-ingest", "ingest", sourcePath,
      "--output", outputDirectory,
      "--case-id", `canonical_case_${stableId(report.groupKey)}`,
      "--document-id", `canonical_${asset.assetId}`,
      "--rendition-id", asset.assetId,
      "--report-family", report.reportFamily,
      "--dataset-split", report.datasetSplit,
      "--dataset-group-key", report.assetLineageKey ?? `logical:${report.groupKey}`,
      "--source-object-key", objectKey,
    ];
    const ingestion = spawnSync("uv", args, {
      cwd: join(process.cwd(), "services", "kb-ingestion"),
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    });
    if (ingestion.status !== 0) {
      failures.push({ fileName: asset.fileName, stage: "extract", error: tail(ingestion.stderr) });
      await saveProgress({ status: "running", total: approved.length, processed: completed + skipped, failures, currentFileName: asset.fileName });
      console.error(`failed extraction: ${asset.fileName}`);
      continue;
    }
    const publication = spawnSync("uv", [
      "run", "--frozen", "kb-ingest", "publish-review", manifestPath,
      "--database-url", databaseUrl,
    ], {
      cwd: join(process.cwd(), "services", "kb-ingestion"),
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    });
    if (publication.status !== 0) {
      failures.push({ fileName: asset.fileName, stage: "publish", error: tail(publication.stderr) });
      await saveProgress({ status: "running", total: approved.length, processed: completed + skipped, failures, currentFileName: asset.fileName });
      console.error(`failed publication: ${asset.fileName}`);
      continue;
    }
    completed += 1;
    await saveProgress({ status: "running", total: approved.length, processed: completed + skipped, failures, currentFileName: asset.fileName });
    console.error(`[${index + 1}/${approved.length}] ingested: ${asset.fileName}`);
  }

  await saveProgress({ status: failures.length > 0 ? "completed_with_errors" : "completed", total: approved.length, processed: completed + skipped, failures, currentFileName: null, completedAt: true });

  console.log(JSON.stringify({ approved: approved.length, completed, skipped, failed: failures.length, failures }, null, 2));
  process.exitCode = failures.length > 0 ? 1 : 0;
} finally {
  await db.close();
}

function stableId(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 20);
}

function mediaTypeFor(filePath) {
  return ({
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".rtf": "application/rtf",
  })[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

function tail(value) {
  return String(value ?? "").trim().split("\n").slice(-8).join("\n");
}

async function saveProgress({ status, total, processed, failures, currentFileName, started = false, completedAt = false }) {
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO canonical_ingestion_jobs (
      job_id, status_code, total_reports, processed_reports, failed_reports,
      current_file_name, failures_json, started_at_iso, updated_at_iso, completed_at_iso
    ) VALUES ('canonical_bulk_v1', ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?)
    ON CONFLICT (job_id) DO UPDATE SET
      status_code=excluded.status_code, total_reports=excluded.total_reports,
      processed_reports=excluded.processed_reports, failed_reports=excluded.failed_reports,
      current_file_name=excluded.current_file_name, failures_json=excluded.failures_json,
      started_at_iso=CASE WHEN ? THEN excluded.started_at_iso ELSE canonical_ingestion_jobs.started_at_iso END,
      updated_at_iso=excluded.updated_at_iso, completed_at_iso=excluded.completed_at_iso`,
  ).run(status, total, processed, failures.length, currentFileName, JSON.stringify(failures), now, now,
    completedAt ? now : null, started);
}
