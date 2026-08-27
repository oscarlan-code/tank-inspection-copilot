import { createHash, randomUUID } from "node:crypto";
import { createKbReviewService } from "../kb-review.mjs";
import { createPostgresDatabase } from "../storage/postgres.mjs";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for the KB review integration audit.");
}

const db = await createPostgresDatabase({ databaseUrl });
const createError = (statusCode, message, code) => Object.assign(new Error(message), {
  code,
  statusCode,
});
const service = createKbReviewService({ db, createError });
const suffix = randomUUID().replaceAll("-", "");
const caseId = `kb-audit-case-${suffix}`;
const documentId = `kb-audit-document-${suffix}`;
const runId = `kb-audit-run-${suffix}`;
const sectionId = `kb-audit-section-${suffix}`;
const warningSectionId = `kb-audit-warning-section-${suffix}`;
const chunkId = `kb-audit-chunk-${suffix}`;
const sourceText = "Localized shell thinning was recorded at the selected inspection area.";
const sourceSha256 = createHash("sha256").update(sourceText).digest("hex");
const now = new Date().toISOString();
const warningIssue = {
  issue_code: "empty_table_extraction",
  severity: "warning",
  message: "A detected table requires extraction review.",
  block_ids: ["block-warning"],
  page_numbers: [2],
};
const qualityPayload = {
  status: "needs_review",
  score: 0.9,
  text_page_coverage: 1,
  provenance_coverage: 1,
  heading_count: 2,
  table_count: 1,
  issues: [warningIssue],
};

try {
  const actor = await db.prepare(
    `SELECT u.user_id
    FROM platform_users u
    WHERE lower(regexp_replace(u.role_label, '[^a-zA-Z0-9]+', '_', 'g')) = 'super_admin'
    ORDER BY u.created_at_iso
    LIMIT 1`,
  ).get();
  if (!actor?.user_id) throw new Error("The KB review audit requires a Super Admin account.");

  await db.transaction(async () => {
    await db.prepare(
      `INSERT INTO kb_cases (
        case_id, report_family, dataset_split, status_code,
        metadata_json, created_at_iso, updated_at_iso
      ) VALUES (?, 'api653_internal_external', 'training', 'discovered',
        '{"datasetAssignment":"automatic","datasetGroupKey":"kb-audit"}'::jsonb, ?, ?)`,
    ).run(caseId, now, now);
    await db.prepare(
      `INSERT INTO kb_documents (
        document_id, visibility_code, document_type, source_uri, source_sha256,
        metadata_json, created_at_iso, updated_at_iso, case_id, rendition_id,
        document_role, dataset_split, approval_status, retrieval_eligible,
        source_object_key, parser_name, parser_version, extraction_quality_json
      ) VALUES (
        ?, 'platform_private', 'historical_report', ?, ?, ?, ?, ?, ?, ?,
        'historical_source', 'training', 'pending_review', FALSE, ?,
        'docling', 'audit', ?
      )`,
    ).run(
      documentId,
      `s3://kb-review/audit/${documentId}.pdf`,
      sourceSha256,
      JSON.stringify({
        classificationSource: "automatic",
        datasetAssignment: "automatic",
        datasetGroupKey: "kb-audit",
        localSourceName: "KB audit report.pdf",
      }),
      now,
      now,
      caseId,
      `rendition-${suffix}`,
      `kb-review/audit/${documentId}.pdf`,
      JSON.stringify(qualityPayload),
    );
    await db.prepare(
      `INSERT INTO kb_ingestion_runs (
        ingestion_run_id, case_id, document_id, source_sha256, pipeline_version,
        status_code, quality_json, manifest_json, started_at_iso, completed_at_iso
      ) VALUES (?, ?, ?, ?, 'audit', 'awaiting_review', ?, ?, ?, ?)`,
    ).run(
      runId,
      caseId,
      documentId,
      sourceSha256,
      JSON.stringify(qualityPayload),
      JSON.stringify({ identity: { media_type: "application/pdf", source_path: "KB audit report.pdf" } }),
      now,
      now,
    );
    await db.prepare(
      `INSERT INTO kb_sections (
        section_id, document_id, ingestion_run_id, section_key, original_heading,
        stable_order, review_status, metadata_json, lane_code,
        include_in_retrieval, created_at_iso, updated_at_iso
      ) VALUES (?, ?, ?, 'inspection-report', 'Inspection Report', 1,
        'pending_review',
        '{"classificationSource":"automatic","automaticRetrievalCandidate":true,"qualityWarning":false}'::jsonb,
        'wording_precedent', FALSE, ?, ?)`,
    ).run(sectionId, documentId, runId, now, now);
    await db.prepare(
      `INSERT INTO kb_sections (
        section_id, document_id, ingestion_run_id, section_key, original_heading,
        stable_order, review_status, metadata_json, lane_code,
        include_in_retrieval, created_at_iso, updated_at_iso
      ) VALUES (?, ?, ?, 'unresolved-table', 'Unresolved Table', 2,
        'pending_review',
        '{"classificationSource":"automatic","automaticRetrievalCandidate":false,"qualityWarning":true}'::jsonb,
        'quarantine', FALSE, ?, ?)`,
    ).run(warningSectionId, documentId, runId, now, now);
    await db.prepare(
      `INSERT INTO kb_chunks (
        chunk_id, document_id, section_type, content, metadata_json, embedding,
        created_at_iso, ingestion_run_id, block_type, content_sha256,
        source_block_ids_json, page_numbers_json, source_spans_json, stable_order
      ) VALUES (?, ?, 'inspection-report', ?, '{}'::jsonb, NULL, ?, ?,
        'paragraph', ?, '["block-audit"]'::jsonb, '[1]'::jsonb,
        '[{"source_block_id":"block-audit","page_number":1,"bbox":[0.1,0.2,0.8,0.3]}]'::jsonb,
        1)`,
    ).run(chunkId, documentId, sourceText, now, runId, sourceSha256);
  });

  const queue = await service.listCases();
  assert(queue.cases.some((item) => item.caseId === caseId), "Pending case was not listed.");
  const reviewCase = await service.getCase(caseId);
  const sourceSpan = reviewCase.documents[0]?.sections[0]?.chunks[0]?.sourceSpans[0];
  assert(sourceSpan?.sourceBlockId === "block-audit", "Chunk source-block provenance was not returned.");
  assert(sourceSpan?.pageNumber === 1, "Chunk source-page provenance was not returned.");
  assert(sourceSpan?.bbox?.[1] === 0.2, "Chunk source bounding box was not returned.");
  assert(
    reviewCase.documents[0]?.sections[0]?.chunks[0]?.stableOrder === 1,
    "Chunk stable document order was not returned.",
  );
  const reviewIssue = reviewCase.documents[0]?.quality.issues[0];
  assert(reviewIssue?.issueKey, "Extraction warning did not receive a stable issue key.");
  assert(reviewIssue?.review === null, "A new extraction warning was incorrectly pre-confirmed.");

  await assertRejectsStatus(
    () => service.decideDocument({
      action: "approve",
      actorUserId: actor.user_id,
      documentId,
      notes: "Approval must wait for warning review.",
    }),
    409,
    "Document approval bypassed unresolved extraction warnings.",
  );
  await assertRejectsStatus(
    () => service.reviewWarning({
      actorUserId: actor.user_id,
      documentId,
      issueKey: reviewIssue.issueKey,
      resolution: "needs_correction",
      notes: "",
    }),
    400,
    "Needs-correction warning outcome did not require an explanation.",
  );
  await service.reviewWarning({
    actorUserId: actor.user_id,
    documentId,
    issueKey: reviewIssue.issueKey,
    resolution: "needs_correction",
    notes: "The table values require another extraction pass.",
  });
  await assertRejectsStatus(
    () => service.decideDocument({
      action: "approve",
      actorUserId: actor.user_id,
      documentId,
      notes: "Correction outcomes must continue to block approval.",
    }),
    409,
    "Document approval bypassed a needs-correction warning outcome.",
  );
  const warningReviewed = await service.reviewWarning({
    actorUserId: actor.user_id,
    documentId,
    issueKey: reviewIssue.issueKey,
    resolution: "accepted",
    notes: "Compared the source page with the extracted table context.",
  });
  const persistedReview = warningReviewed.documents[0]?.quality.issues[0]?.review;
  assert(persistedReview?.resolution === "accepted", "Warning outcome was not persisted.");
  assert(persistedReview?.actorDisplayName, "Warning reviewer identity was not returned.");

  const approved = await service.decideDocument({
    action: "approve",
    actorUserId: actor.user_id,
    documentId,
    notes: "Approved by integration audit.",
  });
  const approvedDocument = approved.documents[0];
  assert(approvedDocument.approvalStatus === "approved", "Document approval was not persisted.");
  assert(approvedDocument.retrievalEligible === false, "Review approval bypassed the index gate.");
  assert(approvedDocument.datasetAssignment === "automatic", "Automatic dataset assignment was not returned.");
  assert(
    approvedDocument.sections[0]?.includeInRetrieval === true,
    "Safe automatic training section was not selected at approval.",
  );
  assert(
    approvedDocument.sections[0]?.reviewStatus === "reviewed",
    "Safe automatic training section was not reviewed at approval.",
  );
  const warningSection = approvedDocument.sections.find(
    (section) => section.sectionId === warningSectionId,
  );
  assert(warningSection?.includeInRetrieval === false, "Warned section entered retrieval.");
  assert(warningSection?.laneCode === "quarantine", "Warned section left quarantine.");

  const reopened = await service.decideDocument({
    action: "reopen",
    actorUserId: actor.user_id,
    documentId,
    notes: "Verify reversible review state.",
  });
  assert(reopened.documents[0].approvalStatus === "pending_review", "Reopen did not restore review state.");

  await service.updateDocument({
    actorUserId: actor.user_id,
    documentId,
    values: {
      datasetSplit: "validation",
      documentRole: "historical_source",
      reportFamily: "api653_internal_external",
      reviewNotes: "Validation override for guard audit.",
    },
  });
  await assertRejectsStatus(
    () => service.updateSection({
      actorUserId: actor.user_id,
      sectionId,
      values: { includeInRetrieval: true, laneCode: "wording_precedent", reviewNotes: "" },
    }),
    409,
    "Non-training data entered retrieval selection.",
  );

  console.log("KB review workflow audit passed.");
  console.log("- Safe automatic classification works without user configuration.");
  console.log("- Extraction warnings require durable reviewer outcomes before approval.");
  console.log("- PostgreSQL review queue, approval, audit history, and reopen are durable.");
  console.log("- Non-training retrieval selection is blocked.");
  console.log("- Review approval cannot bypass the later embedding/index publication gate.");
} finally {
  await db.prepare("DELETE FROM kb_cases WHERE case_id = ?").run(caseId).catch(() => {});
  await db.close();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertRejectsStatus(operation, statusCode, message) {
  try {
    await operation();
  } catch (error) {
    if (error?.statusCode === statusCode) return;
    throw error;
  }
  throw new Error(message);
}
