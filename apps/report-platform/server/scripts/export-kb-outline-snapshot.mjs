// Structural research export only. SELECTs under a read-only snapshot; never
// changes source approval, dataset assignment, retrieval publication or policy.
// Run from app root: node --env-file=.env server/scripts/export-kb-outline-snapshot.mjs --output /tmp/kb-outline.json
import pg from 'pg';
import { writeFile } from 'node:fs/promises';
const args = process.argv.slice(2);
const output = args[args.indexOf('--output') + 1];
if (!args.includes('--output') || !output) throw new Error('--output FILE is required');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  await db.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const documents = (await db.query(`SELECT d.document_id,d.case_id,d.rendition_id,d.source_sha256,
    d.document_role,d.dataset_split,d.approval_status,d.source_uri,d.source_object_key,
    d.metadata_json,d.extraction_quality_json,c.report_family
    FROM kb_documents d LEFT JOIN kb_cases c ON c.case_id=d.case_id ORDER BY d.document_id`)).rows;
  const sections = (await db.query(`SELECT section_id,document_id,section_key,original_heading,
    stable_order,review_status,metadata_json FROM kb_sections ORDER BY document_id,stable_order,section_id`)).rows;
  const chunks = (await db.query(`SELECT document_id,chunk_id,section_type,block_type,content,
    page_numbers_json,stable_order,metadata_json FROM kb_chunks ORDER BY document_id,stable_order,chunk_id`)).rows;
  const registry = (await db.query(`SELECT corpus_report_id,content_sha256,binary_sha256,
    selected_relative_path,report_reference,asset_lineage_key,core_family,profile_json,
    eligibility_role,dataset_split,registry_status,publication_status
    FROM report_corpus_registry ORDER BY corpus_report_id`)).rows;
  await db.query('ROLLBACK');
  // Contains source content for offline inspection; keep outside tracked/runtime
  // generation assets. The published catalogue contains only structural design.
  await writeFile(output, JSON.stringify({ reviewedAt: new Date().toISOString(), documents, sections, chunks, registry }, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ output, documentEntries: documents.length, sections: sections.length, chunks: chunks.length, readOnly: true }));
} finally {
  await db.end();
}
