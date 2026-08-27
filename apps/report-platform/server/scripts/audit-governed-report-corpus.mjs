import { createPostgresDatabase } from "../storage/postgres.mjs";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const taxonomyVersionId = "report_taxonomy_content_v1";
const db = await createPostgresDatabase({ databaseUrl: process.env.DATABASE_URL });
try {
  const summary = await db.prepare(
    `SELECT COUNT(*)::int reports,COUNT(DISTINCT content_sha256)::int unique_content,
      COUNT(DISTINCT asset_lineage_key)::int lineages,
      COUNT(*) FILTER (WHERE retrieval_eligible)::int retrieval_eligible,
      COUNT(*) FILTER (WHERE eligibility_role='validation_gold')::int validation_gold,
      COUNT(*) FILTER (WHERE eligibility_role='hidden_test_gold')::int hidden_test_gold,
      COUNT(*) FILTER (WHERE eligibility_role='excluded_draft')::int excluded_drafts,
      COUNT(*) FILTER (WHERE eligibility_role='excluded_ambiguous')::int excluded_ambiguous
     FROM report_corpus_registry WHERE taxonomy_version_id=?`,
  ).get(taxonomyVersionId);
  const lineageLeaks = await db.prepare(
    `SELECT COUNT(*)::int count FROM (
       SELECT asset_lineage_key FROM report_corpus_registry WHERE taxonomy_version_id=?
       GROUP BY asset_lineage_key HAVING COUNT(DISTINCT dataset_split)>1
     ) leaked`,
  ).get(taxonomyVersionId);
  const retrievalLeaks = await db.prepare(
    `SELECT COUNT(*)::int count FROM report_corpus_registry WHERE taxonomy_version_id=? AND retrieval_eligible
       AND (dataset_split<>'training' OR eligibility_role<>'training_reference')`,
  ).get(taxonomyVersionId);
  const evaluationLeaks = await db.prepare(
    `SELECT COUNT(*)::int count FROM report_corpus_registry WHERE taxonomy_version_id=?
       AND eligibility_role IN ('validation_gold','hidden_test_gold') AND retrieval_eligible`,
  ).get(taxonomyVersionId);
  const duplicateLeaks = await db.prepare(
    `SELECT COUNT(*)::int count FROM (
       SELECT content_sha256 FROM report_corpus_registry WHERE taxonomy_version_id=?
       GROUP BY content_sha256 HAVING COUNT(*)>1
     ) duplicated`,
  ).get(taxonomyVersionId);
  const draftLeaks = await db.prepare(
    `SELECT COUNT(*)::int count FROM report_corpus_registry WHERE taxonomy_version_id=?
       AND publication_status='preliminary_or_draft'
       AND (retrieval_eligible OR eligibility_role IN ('training_reference','validation_gold','hidden_test_gold'))`,
  ).get(taxonomyVersionId);
  const missingProfiles = await db.prepare(
    `SELECT COUNT(*)::int count FROM report_corpus_registry WHERE taxonomy_version_id=?
       AND eligibility_role NOT IN ('excluded_ambiguous')
       AND (core_family='' OR NOT jsonb_exists(profile_json,'primaryInspectionScope')
         OR NOT jsonb_exists(profile_json,'lifecycle') OR NOT jsonb_exists(profile_json,'methods'))`,
  ).get(taxonomyVersionId);
  const familyCoverageLeaks = await db.prepare(
    `SELECT COUNT(*)::int count FROM (
       SELECT core_family,COUNT(DISTINCT asset_lineage_key) lineages,COUNT(DISTINCT dataset_split) splits
       FROM report_corpus_registry WHERE taxonomy_version_id=?
         AND eligibility_role IN ('training_reference','validation_gold','hidden_test_gold')
       GROUP BY core_family
       HAVING COUNT(DISTINCT asset_lineage_key)>=3 AND COUNT(DISTINCT dataset_split)<3
     ) incomplete`,
  ).get(taxonomyVersionId);
  const copies = await db.prepare(
    `SELECT COUNT(*)::int copies,COUNT(*) FILTER (WHERE is_selected)::int selected
     FROM report_corpus_copies c JOIN report_corpus_registry r USING (corpus_report_id)
     WHERE r.taxonomy_version_id=?`,
  ).get(taxonomyVersionId);
  const splitCounts = await db.prepare(
    `SELECT dataset_split,eligibility_role,COUNT(*)::int count
     FROM report_corpus_registry WHERE taxonomy_version_id=? GROUP BY 1,2 ORDER BY 1,2`,
  ).all(taxonomyVersionId);
  const failures = {
    reportCountMismatch: summary.reports !== 199,
    contentDuplicates: duplicateLeaks.count,
    crossSplitLineages: lineageLeaks.count,
    nonTrainingRetrieval: retrievalLeaks.count,
    evaluationRetrievalExposure: evaluationLeaks.count,
    draftExposure: draftLeaks.count,
    missingProfiles: missingProfiles.count,
    familySplitCoverage: familyCoverageLeaks.count,
    selectedCopyMismatch: copies.selected !== summary.reports,
  };
  if (Object.values(failures).some(Boolean)) throw new Error(`Governed corpus audit failed: ${JSON.stringify(failures)}`);
  console.log(JSON.stringify({ passed: true, taxonomyVersionId, summary, copies, splitCounts, failures }, null, 2));
} finally {
  await db.close();
}
