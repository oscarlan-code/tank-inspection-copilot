import { createPostgresDatabase } from "../storage/postgres.mjs";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const kbIndexId = "governed_kb_content_v1";
const db = await createPostgresDatabase({ databaseUrl: process.env.DATABASE_URL });
try {
  const summary = await db.prepare(
    `SELECT COUNT(DISTINCT d.corpus_report_id)::int documents,COUNT(DISTINCT d.asset_lineage_key)::int lineages,
      COUNT(DISTINCT d.core_family)::int families,COUNT(s.section_id)::int sections
     FROM report_governed_kb_documents d LEFT JOIN report_governed_kb_sections s
       ON s.kb_index_id=d.kb_index_id AND s.corpus_report_id=d.corpus_report_id
     WHERE d.kb_index_id=?`,
  ).get(kbIndexId);
  const expected = await db.prepare(
    `SELECT COUNT(*)::int count FROM report_corpus_registry WHERE eligibility_role='training_reference'`,
  ).get();
  const invalidSources = await db.prepare(
    `SELECT COUNT(*)::int count FROM report_governed_kb_documents i
     JOIN report_corpus_registry r USING (corpus_report_id)
     JOIN kb_documents d ON d.document_id=i.document_id
     WHERE i.kb_index_id=? AND (r.dataset_split<>'training' OR r.eligibility_role<>'training_reference'
       OR NOT r.retrieval_eligible OR d.source_sha256<>r.binary_sha256
       OR i.asset_lineage_key<>r.asset_lineage_key OR i.core_family<>r.core_family)`,
  ).get(kbIndexId);
  const emptyDocuments = await db.prepare(
    `SELECT COUNT(*)::int count FROM report_governed_kb_documents d WHERE d.kb_index_id=?
       AND NOT EXISTS (SELECT 1 FROM report_governed_kb_sections s
         WHERE s.kb_index_id=d.kb_index_id AND s.corpus_report_id=d.corpus_report_id)`,
  ).get(kbIndexId);
  const exposedGold = await db.prepare(
    `SELECT COUNT(*)::int count FROM report_governed_kb_documents i
     JOIN report_corpus_registry r USING (corpus_report_id)
     WHERE i.kb_index_id=? AND r.eligibility_role IN ('validation_gold','hidden_test_gold')`,
  ).get(kbIndexId);
  const duplicateContent = await db.prepare(
    `SELECT COUNT(*)::int count FROM (
      SELECT r.content_sha256 FROM report_governed_kb_documents i JOIN report_corpus_registry r USING(corpus_report_id)
      WHERE i.kb_index_id=? GROUP BY r.content_sha256 HAVING COUNT(*)>1
    ) duplicate`,
  ).get(kbIndexId);
  const failures={documentCoverage:summary.documents!==expected.count,invalidSources:invalidSources.count,
    emptyDocuments:emptyDocuments.count,exposedGold:exposedGold.count,duplicateContent:duplicateContent.count};
  if(Object.values(failures).some(Boolean)) throw new Error(`Governed KB audit failed: ${JSON.stringify(failures)}`);
  console.log(JSON.stringify({passed:true,kbIndexId,expectedDocuments:expected.count,summary,failures},null,2));
} finally { await db.close(); }
