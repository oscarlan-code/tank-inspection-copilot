import { createKbReviewService } from "../kb-review.mjs";
import { createS3ObjectStorage } from "../object-storage.mjs";
import { createStandardizedPairBuilder } from "../standardized-pair-builder.mjs";
import { createPostgresDatabase } from "../storage/postgres.mjs";
import { BENCHMARK_TRACKS, createTrainingHarnessService } from "../training-harness.mjs";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const db = await createPostgresDatabase({ databaseUrl: process.env.DATABASE_URL });
const storage = createS3ObjectStorage();
const createError = (statusCode, message, code) => Object.assign(new Error(message), { statusCode, code });
const kbReview = createKbReviewService({ db, createError });
const training = createTrainingHarnessService({ db, createError });
const pairs = createStandardizedPairBuilder({ db });

try {
  storage.assertConfigured();
  const actor = await db.prepare(
    `SELECT user_id FROM platform_users
    WHERE lower(regexp_replace(role_label, '[^a-zA-Z0-9]+', '_', 'g'))='super_admin'
    ORDER BY created_at_iso LIMIT 1`,
  ).get();
  if (!actor?.user_id) throw new Error("A Super Admin account is required.");
  const documents = await db.prepare(
    `SELECT d.document_id, d.approval_status, d.dataset_split, d.metadata_json,
      d.extraction_quality_json, c.report_family
    FROM kb_documents d JOIN kb_cases c ON c.case_id=d.case_id
    WHERE d.document_id LIKE 'canonical_kba_%'
    ORDER BY d.document_id`,
  ).all();
  const failures = [];
  let quarantined = 0;
  let prepared = 0;
  for (const [index, document] of documents.entries()) {
    const quality = parseJson(document.extraction_quality_json, {});
    const label = parseJson(document.metadata_json, {}).localSourceName ?? document.document_id;
    try {
      if (quality.status !== "passed") {
        if (document.approval_status === "pending_review") {
          await kbReview.decideDocument({ action: "quarantine", actorUserId: actor.user_id, documentId: document.document_id, notes: "Automatically quarantined: extraction quality requires correction before truth normalization." });
        }
        quarantined += 1;
        console.error(`[${index + 1}/${documents.length}] quarantined extraction: ${label}`);
        continue;
      }
      if (document.approval_status !== "approved") {
        await kbReview.decideDocument({ action: "approve", actorUserId: actor.user_id, documentId: document.document_id, notes: "Automatically approved after passed extraction-quality and provenance gates." });
      }
      const lineage = String(parseJson(document.metadata_json, {}).datasetGroupKey ?? "").trim() || null;
      const detail = await training.createTruthCaseFromApprovedSource({
        actorUserId: actor.user_id,
        documentId: document.document_id,
        benchmarkTrack: BENCHMARK_TRACKS.OPERATIONAL_HISTORY,
        assetLineageKey: lineage,
        evidenceAsOf: inferEvidenceDateFromName(label),
      });
      const caseId = detail.truthCase.truthCaseId;
      if (detail.truthCase.status !== "case_approved") {
        await training.proposeTruthFacts({ actorUserId: actor.user_id, trainingCaseId: caseId });
        await training.acceptAutomatedTruthDraft({ actorUserId: actor.user_id, trainingCaseId: caseId });
        const truthManifest = await training.buildTruthGraphManifest(caseId);
        const truthBytes = Buffer.from(JSON.stringify(truthManifest));
        const truthKey = `training-harness/truth-graphs/${caseId}/truth-graph-v${truthManifest.truthGraphVersion}.json`;
        const storedTruth = await storage.putBuffer({ bytes: truthBytes, mediaType: "application/json", objectId: caseId, objectKey: truthKey });
        await training.approveTruthCase({ actorUserId: actor.user_id, trainingCaseId: caseId, truthGraphObjectKey: truthKey, truthGraphSha256: storedTruth.sha256 });
      }
      prepared += 1;
      console.error(`[${index + 1}/${documents.length}] prepared: ${label}`);
    } catch (error) {
      failures.push({ documentId: document.document_id, fileName: label, code: error.code ?? null, message: error.message });
      console.error(`[${index + 1}/${documents.length}] failed: ${label} · ${error.message}`);
    }
  }
  const baselineResult = await pairs.buildBaselines();
  console.log(JSON.stringify({ documents: documents.length, prepared, quarantined, failures, baselineResult }, null, 2));
  process.exitCode = failures.length ? 1 : 0;
} finally {
  await db.close();
}

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function inferEvidenceDateFromName(value) {
  const text = String(value ?? "");
  const fullYear = text.match(/\b((?:19|20)\d{2})\b/)?.[1];
  if (fullYear) return `${fullYear}-12-31T23:59:59.000Z`;
  const reportYear = text.match(/^\s*(\d{2})[A-Za-z]{2,}/)?.[1]
    ?? text.match(/\b(?:NDE[-_ ]?RP[-_ ])(\d{2})\b/i)?.[1];
  if (!reportYear) return null;
  const year = Number(reportYear) >= 70 ? 1900 + Number(reportYear) : 2000 + Number(reportYear);
  return `${year}-12-31T23:59:59.000Z`;
}
