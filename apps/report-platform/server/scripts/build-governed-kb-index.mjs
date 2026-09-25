import { createPostgresDatabase } from "../storage/postgres.mjs";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const taxonomyVersionId = "report_taxonomy_content_v1";
const kbIndexId = "governed_kb_content_v1";
const db = await createPostgresDatabase({ databaseUrl: process.env.DATABASE_URL });
const nowIso = new Date().toISOString();
try {
  const missing = await db.prepare(
    `SELECT COUNT(*)::int count FROM report_corpus_registry r
     WHERE r.taxonomy_version_id=? AND r.eligibility_role='training_reference'
       AND NOT EXISTS (SELECT 1 FROM kb_documents d WHERE d.source_sha256=r.binary_sha256)`,
  ).get(taxonomyVersionId);
  if (missing.count) throw new Error(`${missing.count} training reports still require KB ingestion.`);
  await db.transaction(async () => {
    await db.prepare(
      `INSERT INTO report_governed_kb_indexes (
        kb_index_id,taxonomy_version_id,index_version,status_code,retrieval_contract_json,created_at_iso
       ) VALUES (?,?,?,?,?,?)
       ON CONFLICT (kb_index_id) DO UPDATE SET status_code='building',retrieval_contract_json=excluded.retrieval_contract_json`,
    ).run(kbIndexId,taxonomyVersionId,1,"building",{
      hierarchy:["coreFamily","primaryInspectionScope","lifecycle","methods","sectionKey"],
      exactSourceContentForbidden:true,
      exactAssetLineageForbidden:true,
      validationAndHiddenForbidden:true,
      compatibleFamilyFallback:"explicit_policy_arm_only",
    },nowIso);
    await db.prepare("DELETE FROM report_governed_kb_documents WHERE kb_index_id=?").run(kbIndexId);
    const reports = await db.prepare(
      `SELECT DISTINCT ON (r.corpus_report_id) r.*,d.document_id
       FROM report_corpus_registry r JOIN kb_documents d ON d.source_sha256=r.binary_sha256
       WHERE r.taxonomy_version_id=? AND r.eligibility_role='training_reference'
       ORDER BY r.corpus_report_id,(d.document_id LIKE 'governed_%') DESC,d.approval_status='approved' DESC,d.created_at_iso DESC`,
    ).all(taxonomyVersionId);
    for (const report of reports) {
      const profile = report.profile_json;
      await db.prepare(
        `INSERT INTO report_governed_kb_documents (
          kb_index_id,corpus_report_id,document_id,asset_lineage_key,core_family,scope_code,
          lifecycle_code,method_codes_json,metadata_snapshot_json,created_at_iso
         ) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      ).run(kbIndexId,report.corpus_report_id,report.document_id,report.asset_lineage_key,
        report.core_family,profile.primaryInspectionScope ?? "unknown",profile.lifecycle ?? "unspecified",
        JSON.stringify(profile.methods ?? []),profile,nowIso);
      const sections = await db.prepare(
        `SELECT section_id,section_key,stable_order FROM kb_sections WHERE document_id=? ORDER BY stable_order,section_id`,
      ).all(report.document_id);
      for (const section of sections) {
        await db.prepare(
          `INSERT INTO report_governed_kb_sections (
            kb_index_id,corpus_report_id,section_id,section_key,stable_order,created_at_iso
           ) VALUES (?,?,?,?,?,?)`,
        ).run(kbIndexId,report.corpus_report_id,section.section_id,section.section_key,section.stable_order,nowIso);
      }
    }
    await db.prepare(
      `UPDATE report_governed_kb_indexes SET status_code='audited',audited_at_iso=? WHERE kb_index_id=?`,
    ).run(nowIso,kbIndexId);
  });
  const summary = await db.prepare(
    `SELECT COUNT(DISTINCT d.corpus_report_id)::int documents,COUNT(s.section_id)::int sections
     FROM report_governed_kb_documents d LEFT JOIN report_governed_kb_sections s
       ON s.kb_index_id=d.kb_index_id AND s.corpus_report_id=d.corpus_report_id
     WHERE d.kb_index_id=?`,
  ).get(kbIndexId);
  console.log(JSON.stringify({ kbIndexId, ...summary }, null, 2));
} finally { await db.close(); }
