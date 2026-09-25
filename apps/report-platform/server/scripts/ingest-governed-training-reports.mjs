import { existsSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";
import { createS3ObjectStorage } from "../object-storage.mjs";
import { createPostgresDatabase } from "../storage/postgres.mjs";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const sourceRoot = process.env.REPORT_CORPUS_ROOT ?? "/Users/oscar/Public/irs/Sample Reports";
const outputRoot = process.env.GOVERNED_KB_INGESTION_OUTPUT
  ?? join(process.cwd(), ".local/governed-kb-ingestion-v1");
const limit = Math.max(1, Number(process.env.GOVERNED_KB_INGESTION_LIMIT ?? 1000));
const db = await createPostgresDatabase({ databaseUrl: process.env.DATABASE_URL });
const storage = createS3ObjectStorage();
let completed = 0;
const failures = [];

try {
  storage.assertConfigured();
  const reports = await db.prepare(
    `SELECT r.* FROM report_corpus_registry r
     WHERE r.eligibility_role IN ('training_reference','validation_gold') AND r.registry_status IN ('audited','active')
       AND NOT EXISTS (SELECT 1 FROM kb_documents d WHERE d.source_sha256=r.binary_sha256)
     ORDER BY r.selected_relative_path LIMIT ?`,
  ).all(limit);
  mkdirSync(outputRoot, { recursive: true });
  for (const [index, report] of reports.entries()) {
    const sourcePath = join(sourceRoot, report.selected_relative_path);
    const documentId = `governed_${report.corpus_report_id}`;
    const caseId = `governed_case_${report.corpus_report_id.slice(-16)}`;
    const renditionId = `governed_rendition_${report.binary_sha256.slice(0, 16)}`;
    const outputDirectory = join(outputRoot, report.corpus_report_id);
    const manifestPath = join(outputDirectory, "manifest.json");
    const safeName = basename(sourcePath).replace(/[^a-zA-Z0-9._-]+/g, "-");
    const objectKey = `kb-sources/governed-v1/${report.corpus_report_id}/${safeName}`;
    try {
      if (!existsSync(sourcePath)) throw new Error(`Source does not exist: ${sourcePath}`);
      console.error(`[${index + 1}/${reports.length}] storing ${report.selected_relative_path}`);
      await storage.putFile({ filePath: sourcePath, mediaType: "application/pdf", objectId: report.corpus_report_id, objectKey });
      const extraction = spawnSync("uv", [
        "run", "--frozen", "kb-ingest", "ingest", sourcePath,
        "--output", outputDirectory,
        "--case-id", caseId,
        "--document-id", documentId,
        "--rendition-id", renditionId,
        "--report-family", report.core_family,
        "--dataset-split", report.dataset_split,
        "--dataset-group-key", report.asset_lineage_key,
        "--source-object-key", objectKey,
        "--no-ocr",
      ], { cwd: join(process.cwd(), "services/kb-ingestion"), encoding: "utf8", maxBuffer: 30 * 1024 * 1024 });
      if (extraction.status !== 0) throw new Error(`Extraction failed: ${tail(extraction.stderr)}`);
      const publication = spawnSync("uv", [
        "run", "--frozen", "kb-ingest", "publish-review", manifestPath,
        "--database-url", process.env.DATABASE_URL,
      ], { cwd: join(process.cwd(), "services/kb-ingestion"), encoding: "utf8", maxBuffer: 30 * 1024 * 1024 });
      if (publication.status !== 0) throw new Error(`Publication failed: ${tail(publication.stderr)}`);
      await db.prepare(
        `UPDATE kb_documents SET approval_status='approved',retrieval_eligible=FALSE,
          review_notes='Approved for governed versioned KB index; global retrieval remains disabled.',updated_at_iso=NOW()
         WHERE document_id=?`,
      ).run(documentId);
      await db.prepare(
        `UPDATE kb_sections SET review_status='approved',include_in_retrieval=FALSE,
          review_notes='Approved for governed versioned KB index; global retrieval remains disabled.',updated_at_iso=NOW()
         WHERE document_id=?`,
      ).run(documentId);
      completed += 1;
      console.error(`[${index + 1}/${reports.length}] completed ${report.selected_relative_path}`);
    } catch (error) {
      failures.push({ corpusReportId: report.corpus_report_id, path: report.selected_relative_path, error: String(error.message ?? error) });
      console.error(`[${index + 1}/${reports.length}] failed ${report.selected_relative_path}: ${error.message}`);
    }
  }
  console.log(JSON.stringify({ attempted: reports.length, completed, failed: failures.length, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
} finally {
  await db.close();
}

function tail(value) { return String(value ?? "").trim().split("\n").slice(-12).join("\n"); }
