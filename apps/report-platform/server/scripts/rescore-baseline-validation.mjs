import { evaluateTruthGraphRecovery } from "../eval.mjs";
import { calculateSystemRlReward } from "../system-rl-policy.mjs";
import { createPostgresDatabase } from "../storage/postgres.mjs";

if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL is required.");
const db=await createPostgresDatabase({databaseUrl:process.env.DATABASE_URL});
try{
  const rows=await db.prepare(
    `SELECT e.eval_run_id,e.eval_json,e.score,e.outcome_code,e.section_id,g.generated_content,g.blockers_json,
      c.config_json,r.reward_id
    FROM report_eval_runs e
    JOIN report_generation_runs g ON g.run_id=e.run_id
    JOIN report_evaluation_cases c USING(evaluation_case_id)
    JOIN system_rl_policy_rewards r ON r.eval_run_id=e.eval_run_id
    WHERE c.dataset_split='validation' AND jsonb_exists(c.config_json,'baselineVariationId')`,
  ).all();
  let hardFailures=0;
  for(const row of rows){
    const facts=await db.prepare(
      `SELECT f.*,a.answerability_class,a.required_fact FROM report_training_case_facts f
      JOIN report_training_case_answerability a USING(fact_id)
      WHERE f.training_case_id=? AND f.section_key=? AND f.review_status='approved' AND a.review_status='approved'`,
    ).all(row.config_json.goldTruthCaseId,row.section_id);
    const truth=evaluateTruthGraphRecovery({facts,generatedContent:row.generated_content});
    const evaluation={...row.eval_json,truthGraphEvaluation:truth};
    const hardFailure=truth.protectedFactMismatchCount>0||truth.unsupportedClaimCount>0;
    const inadequate=truth.requiredFactCount>0&&truth.requiredFactRecall<0.8;
    const outcomeCode=hardFailure?"fail_truth_contract":inadequate?"fail_truth_recovery":String(row.eval_json.outcomeCode??"pass");
    const score=hardFailure||inadequate?Math.min(Number(row.eval_json.score??row.score),0.49):Number(row.eval_json.score??row.score);
    evaluation.outcomeCode=outcomeCode;evaluation.score=score;
    const reward=calculateSystemRlReward({evalRun:{...evaluation,outcomeCode,score},generationRun:{blockers:row.blockers_json??[]}});
    hardFailures+=reward.hardFailure?1:0;
    await db.transaction(async()=>{
      await db.prepare(`UPDATE report_eval_runs SET score=?,outcome_code=?,eval_json=?::jsonb WHERE eval_run_id=?`).run(score,outcomeCode,JSON.stringify(evaluation),row.eval_run_id);
      await db.prepare(`UPDATE system_rl_policy_rewards SET reward_value=?,learning_eligible=?,hard_failure=?,hard_failure_reasons_json=?::jsonb,metrics_json=?::jsonb WHERE reward_id=?`).run(reward.value,reward.learningEligible,reward.hardFailure,JSON.stringify(reward.hardFailureReasons),JSON.stringify(reward.metrics),row.reward_id);
    });
  }
  console.log(JSON.stringify({rescored:rows.length,hardFailures,policyStatisticsUpdated:false,metricContract:"atomic_protected_claims_v1"},null,2));
}finally{await db.close();}
