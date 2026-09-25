import { createHash } from "node:crypto";
import { createPostgresDatabase } from "../storage/postgres.mjs";
import { createReportStore } from "../store.mjs";

if(!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const requested=Number(process.env.PILOT_EVALUATION_LIMIT??800);
const limit=Number.isInteger(requested)&&requested>0?requested:800;
const datasetSplit=String(process.env.PILOT_DATASET_SPLIT??"training");
const metricContract=String(process.env.PILOT_METRIC_CONTRACT??"initial_truth_graph_v1");
if(!["training","validation","hidden_test"].includes(datasetSplit))throw new Error("PILOT_DATASET_SPLIT must be training, validation, or hidden_test.");
const db=await createPostgresDatabase({databaseUrl:process.env.DATABASE_URL});
const store=await createReportStore({databaseUrl:process.env.DATABASE_URL});
try{
  const actor=await db.prepare(`SELECT user_id FROM platform_users WHERE account_status='active' ORDER BY (lower(role_label)='super admin') DESC,created_at_iso LIMIT 1`).get();
  if(!actor)throw new Error("An active platform user is required.");
  const rows=await db.prepare(
    `SELECT v.variation_id,v.app_report_job_id,v.manifest_json,p.section_key,p.training_case_id,
      g.gold_section_id,c.display_name,c.report_family,c.gold_document_id
    FROM report_baseline_capture_variations v
    JOIN report_baseline_pilot_cohorts cohort ON cohort.cohort_id=v.cohort_id AND cohort.status_code='active'
    JOIN report_baseline_gold_pairs p ON p.baseline_pair_id=v.baseline_pair_id
    JOIN report_standardized_gold_sections g ON g.gold_section_id=p.gold_section_id
    JOIN report_training_cases c ON c.training_case_id=p.training_case_id
    WHERE v.status_code='materialized' AND v.dataset_split=? AND NOT EXISTS (
      SELECT 1 FROM report_evaluation_cases ec WHERE ec.config_json->>'baselineVariationId'=v.variation_id
        AND COALESCE(ec.config_json->>'metricContract','initial_truth_graph_v1')=?
        AND EXISTS (SELECT 1 FROM report_eval_runs er WHERE er.evaluation_case_id=ec.evaluation_case_id AND er.section_id=p.section_key)
    ) ORDER BY v.match_group_number,v.profile_version_id LIMIT ?`,
  ).all(datasetSplit,metricContract,limit);
  let completed=0,failed=0,nextQueueIndex=0;
  async function processRow(row){
    const report=await db.prepare(`SELECT inspection_id,tenant_id,workspace_id FROM report_jobs WHERE report_job_id=?`).get(row.app_report_job_id);
    const existingCase=await db.prepare(
      `SELECT evaluation_case_id FROM report_evaluation_cases
      WHERE input_inspection_id=? AND gold_source_report_name=? LIMIT 1`,
    ).get(report.inspection_id,row.display_name);
    const evaluationCaseId=existingCase?.evaluation_case_id??`eval-baseline-${sha(row.variation_id).slice(0,32)}`;
    const now=new Date().toISOString();
    const caseConfig={goldFirewall:true,goldTruthCaseId:row.training_case_id,baselineVariationId:row.variation_id,goldSectionId:row.gold_section_id,metricContract};
    await db.prepare(
      `INSERT INTO report_evaluation_cases (evaluation_case_id,tenant_id,workspace_id,display_name,report_family,
        input_inspection_id,gold_document_id,gold_source_report_name,dataset_split,label_status,config_json,
        created_by_user_id,created_at_iso,updated_at_iso)
      VALUES (?,?,?,?,?,?,?,?,?,'approved',?::jsonb,?,?,?) ON CONFLICT (evaluation_case_id) DO NOTHING`,
    ).run(evaluationCaseId,report.tenant_id,report.workspace_id,`${row.display_name} · ${row.variation_id.slice(-8)}`,
      row.report_family,report.inspection_id,row.gold_document_id,row.display_name,datasetSplit,
      JSON.stringify(caseConfig),actor.user_id,now,now);
    await db.prepare(`UPDATE report_evaluation_cases SET config_json=?::jsonb,updated_at_iso=? WHERE evaluation_case_id=?`).run(JSON.stringify(caseConfig),now,evaluationCaseId);
    await db.prepare(
      `INSERT INTO report_evaluation_case_sections (evaluation_case_id,section_id,gold_section_key,evaluation_enabled,config_json)
      VALUES (?,?,?,TRUE,'{}'::jsonb) ON CONFLICT (evaluation_case_id,section_id) DO NOTHING`,
    ).run(evaluationCaseId,row.section_key,row.section_key);
    try{
      await store.runSystemRlEvaluation({actorUserId:actor.user_id,reportJobId:row.app_report_job_id,sectionId:row.section_key,evaluationCaseId,frozenCandidate:datasetSplit!=="training",updateLearning:datasetSplit==="training"});
      completed+=1;
      if(completed%10===0)process.stdout.write(`${JSON.stringify({progress:{completed,failed,total:rows.length}})}\n`);
    }catch(error){failed+=1;process.stderr.write(`${row.variation_id}: ${error instanceof Error?error.message:String(error)}\n`);}
  }
  const contextQueues=[...rows.reduce((queues,row)=>{
    const manifest=typeof row.manifest_json==="string"?JSON.parse(row.manifest_json):row.manifest_json;
    const contextKey=`${row.report_family}:${row.section_key}:${manifest?.identity?.captureProfile??"organic_capture"}`;
    const queue=queues.get(contextKey)??[];
    queue.push(row);
    queues.set(contextKey,queue);
    return queues;
  },new Map()).values()];
  async function worker(){
    while(nextQueueIndex<contextQueues.length){
      const queue=contextQueues[nextQueueIndex++];
      for(const row of queue)await processRow(row);
    }
  }
  await Promise.all(Array.from({length:Math.min(4,contextQueues.length)},()=>worker()));
  console.log(JSON.stringify({datasetSplit,metricContract,attempted:rows.length,completed,failed,policyStatisticsUpdated:datasetSplit==="training"},null,2));
  if(failed)process.exitCode=1;
}finally{await Promise.all([db.close(),store.close()]);}
function sha(value){return createHash("sha256").update(String(value)).digest("hex");}
