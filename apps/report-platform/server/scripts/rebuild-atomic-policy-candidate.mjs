import { evaluateTruthGraphRecovery } from "../eval.mjs";
import { calculateSystemRlReward } from "../system-rl-policy.mjs";
import { createPostgresDatabase } from "../storage/postgres.mjs";

const POLICY_ID="rl_policy_report_generation_v3_atomic";
if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL is required.");
const db=await createPostgresDatabase({databaseUrl:process.env.DATABASE_URL});
try{
  const rows=await db.prepare(
    `SELECT e.eval_run_id,e.eval_json,e.score,e.outcome_code,e.section_id,g.generated_content,g.blockers_json,
      c.config_json,r.reward_id,d.context_key,d.arm_id,old_arm.arm_key,r.created_at_iso
    FROM report_eval_runs e JOIN report_generation_runs g ON g.run_id=e.run_id
    JOIN report_evaluation_cases c USING(evaluation_case_id)
    JOIN system_rl_policy_rewards r ON r.eval_run_id=e.eval_run_id
    JOIN system_rl_policy_decisions d ON d.decision_id=r.decision_id
    JOIN system_rl_policy_arms old_arm ON old_arm.arm_id=d.arm_id
    WHERE c.dataset_split='training' AND jsonb_exists(c.config_json,'baselineVariationId')`,
  ).all();
  if(rows.length!==800)throw new Error(`Expected 800 matched training episodes; found ${rows.length}.`);
  const corrected=[];
  for(const row of rows){
    const facts=await db.prepare(
      `SELECT f.*,a.answerability_class,a.required_fact FROM report_training_case_facts f
      JOIN report_training_case_answerability a USING(fact_id)
      WHERE f.training_case_id=? AND f.section_key=? AND f.review_status='approved' AND a.review_status='approved'`,
    ).all(row.config_json.goldTruthCaseId,row.section_id);
    const truth=evaluateTruthGraphRecovery({facts,generatedContent:row.generated_content});
    const evaluation={...row.eval_json,truthGraphEvaluation:truth,metricContract:"atomic_protected_claims_v1"};
    const hardFailure=truth.protectedFactMismatchCount>0||truth.unsupportedClaimCount>0;
    const inadequate=truth.requiredFactCount>0&&truth.requiredFactRecall<0.8;
    const outcomeCode=hardFailure?"fail_truth_contract":inadequate?"fail_truth_recovery":String(row.eval_json.outcomeCode??"pass");
    const score=hardFailure||inadequate?Math.min(Number(row.eval_json.score??row.score),0.49):Number(row.eval_json.score??row.score);
    evaluation.outcomeCode=outcomeCode;evaluation.score=score;
    const reward=calculateSystemRlReward({evalRun:{...evaluation,outcomeCode,score},generationRun:{blockers:row.blockers_json??[]}});
    corrected.push({...row,reward});
    await db.transaction(async()=>{
      await db.prepare(`UPDATE report_eval_runs SET score=?,outcome_code=?,eval_json=?::jsonb WHERE eval_run_id=?`).run(score,outcomeCode,JSON.stringify(evaluation),row.eval_run_id);
      await db.prepare(`UPDATE system_rl_policy_rewards SET reward_value=?,learning_eligible=?,hard_failure=?,hard_failure_reasons_json=?::jsonb,metrics_json=?::jsonb WHERE reward_id=?`).run(reward.value,reward.learningEligible,reward.hardFailure,JSON.stringify(reward.hardFailureReasons),JSON.stringify(reward.metrics),row.reward_id);
    });
  }
  const armMap=new Map((await db.prepare(`SELECT arm_key,arm_id FROM system_rl_policy_arms WHERE policy_version_id=?`).all(POLICY_ID)).map((row)=>[row.arm_key,row.arm_id]));
  const aggregates=new Map();
  for(const row of corrected){if(!row.reward.learningEligible)continue;for(const contextKey of [row.context_key,"__global__"]){const armId=armMap.get(row.arm_key);if(!armId)throw new Error(`V3 arm missing for ${row.arm_key}.`);const key=`${armId}||${contextKey}`;const value=Number(row.reward.value??0);const current=aggregates.get(key)??{armId,contextKey,count:0,sum:0,squared:0,hard:0,last:null,latest:""};current.count++;current.sum+=value;current.squared+=value*value;current.hard+=row.reward.hardFailure?1:0;if(String(row.created_at_iso)>current.latest){current.latest=String(row.created_at_iso);current.last=value;}aggregates.set(key,current);}}
  await db.transaction(async()=>{await db.prepare(`DELETE FROM system_rl_context_arm_stats WHERE policy_version_id=?`).run(POLICY_ID);for(const item of aggregates.values())await db.prepare(`INSERT INTO system_rl_context_arm_stats (policy_version_id,arm_id,context_key,eligible_episode_count,reward_sum,reward_squared_sum,hard_failure_count,last_reward,updated_at_iso) VALUES (?,?,?,?,?,?,?,?,NOW())`).run(POLICY_ID,item.armId,item.contextKey,item.count,item.sum,item.squared,item.hard,item.last);});
  const eligible=corrected.filter((row)=>row.reward.learningEligible);console.log(JSON.stringify({policyVersionId:POLICY_ID,episodes:corrected.length,eligible:eligible.length,hardFailures:eligible.filter((row)=>row.reward.hardFailure).length,meanReward:eligible.reduce((sum,row)=>sum+Number(row.reward.value??0),0)/eligible.length,aggregateRows:aggregates.size,rewardContract:"atomic_protected_claims_v1"},null,2));
}finally{await db.close();}
