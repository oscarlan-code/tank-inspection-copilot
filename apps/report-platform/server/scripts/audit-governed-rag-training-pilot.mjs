import {createPostgresDatabase} from "../storage/postgres.mjs";

if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL is required.");
const policyVersionId=String(process.env.GOVERNED_POLICY_VERSION_ID??"rl_policy_report_generation_v7_labelled_voice");
const db=await createPostgresDatabase({databaseUrl:process.env.DATABASE_URL});
try{
  const summary=await db.prepare(`SELECT a.arm_key,COUNT(*)::int episodes,AVG(r.reward_value)::float8 mean_reward,AVG((r.semantic_metrics_json->>'evidenceCoverage')::float8)::float8 evidence_coverage,AVG((r.semantic_metrics_json->>'evidenceFidelity')::float8)::float8 evidence_fidelity,AVG((r.semantic_metrics_json->'goldBenchmark'->>'semanticSimilarity')::float8)::float8 gold_similarity_diagnostic,SUM(CASE WHEN r.hard_failure THEN 1 ELSE 0 END)::int hard_failures FROM report_governed_rag_training_runs r JOIN system_rl_policy_arms a USING(arm_id) WHERE r.policy_version_id=? AND r.status_code='completed' GROUP BY a.arm_key ORDER BY mean_reward DESC`).all(policyVersionId);
  const failures=(await db.prepare(`SELECT
    COUNT(*) FILTER (WHERE r.status_code<>'completed')::int incomplete,
    COUNT(*) FILTER (WHERE NOT COALESCE((r.retrieval_audit_json->>'firewallPassed')::boolean,FALSE))::int firewall_failures,
    COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM jsonb_array_elements_text(r.retrieval_audit_json->'retrievedCorpusReportIds') value WHERE value=p.corpus_report_id))::int source_report_leaks,
    COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM jsonb_array_elements_text(r.retrieval_audit_json->'retrievedCorpusReportIds') value JOIN report_corpus_registry retrieved ON retrieved.corpus_report_id=value WHERE retrieved.asset_lineage_key=source.asset_lineage_key))::int source_lineage_leaks,
    COUNT(*) FILTER (WHERE r.hard_failure)::int hard_failures,
    COUNT(*) FILTER (WHERE r.generated_content='')::int empty_outputs
    FROM report_governed_rag_training_runs r JOIN report_governed_baseline_pairs p USING(governed_pair_id) JOIN report_corpus_registry source ON source.corpus_report_id=p.corpus_report_id WHERE r.policy_version_id=?`).get(policyVersionId));
  const blockingFailures={...failures};delete blockingFailures.hard_failures;
  if(Object.values(blockingFailures).some((value)=>Number(value)>0))throw new Error(`Governed RAG pilot audit failed: ${JSON.stringify(failures)}`);
  console.log(JSON.stringify({passed:true,policyVersionId,summary,failures,safetySignal:{hardFailures:Number(failures.hard_failures),learningRewardForcedToZero:true}},null,2));
}finally{await db.close();}
