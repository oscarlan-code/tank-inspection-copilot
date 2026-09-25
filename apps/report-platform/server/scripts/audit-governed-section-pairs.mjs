import {createPostgresDatabase} from "../storage/postgres.mjs";
if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL is required.");
const db=await createPostgresDatabase({databaseUrl:process.env.DATABASE_URL});
try{
  const summary=await db.prepare(`SELECT dataset_split,status_code,COUNT(*)::int count FROM report_governed_baseline_pairs GROUP BY 1,2 ORDER BY 1,2`).all();
  const misaligned=await db.prepare(`SELECT COUNT(*)::int count FROM report_governed_baseline_pairs p JOIN report_governed_gold_sections g ON g.governed_gold_section_id=p.governed_gold_section_id JOIN report_corpus_registry r ON r.corpus_report_id=p.corpus_report_id WHERE p.corpus_report_id<>g.corpus_report_id OR p.section_key<>g.section_key OR p.dataset_split<>g.dataset_split OR p.dataset_split<>r.dataset_split`).get();
  const retrievalLeak=await db.prepare(`SELECT COUNT(*)::int count FROM report_governed_baseline_pairs p JOIN report_governed_kb_documents i ON i.corpus_report_id=p.corpus_report_id WHERE p.dataset_split='validation'`).get();
  const lineageLeak=await db.prepare(`SELECT COUNT(*)::int count FROM report_governed_baseline_pairs p JOIN report_corpus_registry r ON r.corpus_report_id=p.corpus_report_id JOIN report_governed_kb_documents i ON i.asset_lineage_key=r.asset_lineage_key WHERE p.dataset_split='validation'`).get();
  const exactGoldLeak=await db.prepare(`SELECT COUNT(*)::int count FROM report_governed_baseline_pairs p JOIN report_governed_gold_sections g USING(governed_gold_section_id) WHERE p.mock_input_json::text LIKE '%'||g.target_content||'%'`).get();
  const missingAppEvidence=await db.prepare(`SELECT COUNT(*)::int count FROM report_governed_baseline_pairs WHERE status_code='ready'
    AND jsonb_array_length(COALESCE(mock_input_json->'voiceNotes','[]'::jsonb))=0
    AND jsonb_array_length(COALESCE(mock_input_json->'appRecords'->'structuredTables','[]'::jsonb))=0`).get();
  const failedAnswerability=await db.prepare(`SELECT COUNT(*)::int count FROM report_governed_baseline_pairs WHERE contract_version>=7 AND status_code='ready' AND COALESCE((validation_json->'answerability'->>'qaPassed')::boolean,FALSE)=FALSE`).get();
  const generatorGoldAccess=await db.prepare(`SELECT COUNT(*)::int count FROM report_governed_baseline_pairs WHERE contract_version>=7 AND status_code='ready' AND COALESCE((validation_json->'answerability'->>'originalReferenceAvailableToGenerator')::boolean,TRUE)=TRUE`).get();
  const failures={misaligned:misaligned.count,validationReportInIndex:retrievalLeak.count,validationLineageInIndex:lineageLeak.count,exactGoldInMock:exactGoldLeak.count,missingAppEvidence:missingAppEvidence.count,failedAnswerability:failedAnswerability.count,generatorGoldAccess:generatorGoldAccess.count};
  if(Object.values(failures).some(Boolean))throw new Error(`Governed pair audit failed: ${JSON.stringify(failures)}`);
  console.log(JSON.stringify({passed:true,summary,failures},null,2));
}finally{await db.close();}
