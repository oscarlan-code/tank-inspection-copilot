import {createPostgresDatabase} from "../storage/postgres.mjs";

if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL is required.");
const cohortId=String(process.env.GOVERNED_COHORT_ID??"governed_v12_frozen20");
const sourcePolicy=String(process.env.GOVERNED_SOURCE_POLICY_VERSION_ID??"rl_policy_report_generation_v12_app_table_validation");
const datasetSplit=String(process.env.GOVERNED_DATASET_SPLIT??"validation");
const db=await createPostgresDatabase({databaseUrl:process.env.DATABASE_URL});
try{
  const rows=await db.prepare(`SELECT DISTINCT p.corpus_report_id,p.section_key FROM report_governed_rag_training_runs r JOIN report_governed_baseline_pairs p USING(governed_pair_id) WHERE r.policy_version_id=? AND p.dataset_split=? AND r.status_code='completed' ORDER BY p.corpus_report_id,p.section_key`).all(sourcePolicy,datasetSplit);
  if(!rows.length)throw new Error(`No completed source episodes found for ${sourcePolicy}/${datasetSplit}.`);
  await db.transaction(async()=>{
    await db.prepare(`INSERT INTO report_governed_validation_cohorts (cohort_id,display_name,dataset_split,source_policy_version_id) VALUES (?,?,?,?) ON CONFLICT (cohort_id) DO NOTHING`).run(cohortId,`Frozen cohort from ${sourcePolicy}`,datasetSplit,sourcePolicy);
    const existing=await db.prepare(`SELECT COUNT(*)::int count FROM report_governed_validation_cohort_items WHERE cohort_id=?`).get(cohortId);
    if(existing.count&&existing.count!==rows.length)throw new Error(`Immutable cohort ${cohortId} already has ${existing.count} items, not ${rows.length}.`);
    if(!existing.count)for(const [index,row] of rows.entries())await db.prepare(`INSERT INTO report_governed_validation_cohort_items (cohort_id,stable_order,corpus_report_id,section_key) VALUES (?,?,?,?)`).run(cohortId,index+1,row.corpus_report_id,row.section_key);
  });
  console.log(JSON.stringify({cohortId,sourcePolicy,datasetSplit,items:rows.length,immutable:true},null,2));
}finally{await db.close();}
