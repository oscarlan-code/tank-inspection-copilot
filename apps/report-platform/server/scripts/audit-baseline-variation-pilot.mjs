import { createPostgresDatabase } from "../storage/postgres.mjs";

if(!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const db=await createPostgresDatabase({databaseUrl:process.env.DATABASE_URL});
try{
  const expectedBaselines=Number(process.env.PILOT_EXPECTED_BASELINES??100);
  const profilesPerBaseline=Number(process.env.PILOT_PROFILES_PER_BASELINE??8);
  const expectedDistinctProfiles=Number(process.env.PILOT_EXPECTED_DISTINCT_PROFILES??8);
  const summary=await db.prepare(
    `SELECT COUNT(*)::int AS scenarios,COUNT(DISTINCT baseline_pair_id)::int AS baselines,
      COUNT(DISTINCT profile_version_id)::int AS profiles,
      COUNT(*) FILTER (WHERE v.dataset_split<>'training')::int AS non_training,
      COUNT(*) FILTER (WHERE v.status_code NOT IN ('scenario_ready','materialized'))::int AS not_ready,
      COUNT(*) FILTER (WHERE v.scenario_object_key IS NULL OR v.scenario_sha256 IS NULL)::int AS unstored,
      COUNT(*) FILTER (WHERE COALESCE((v.validation_json->>'protectedFactsPreserved')::boolean,FALSE)=FALSE)::int AS protected_failures,
      COUNT(*) FILTER (WHERE COALESCE((v.validation_json->>'requiredFactsPreserved')::boolean,FALSE)=FALSE)::int AS required_failures,
      COUNT(*) FILTER (WHERE COALESCE((v.validation_json->>'goldTargetVisibleToScenario')::boolean,TRUE)=TRUE)::int AS gold_visible
    FROM report_baseline_capture_variations v
    JOIN report_baseline_pilot_cohorts c ON c.cohort_id=v.cohort_id AND c.status_code='active'
    WHERE v.dataset_split='training'`,
  ).get();
  const incomplete=await db.prepare(
    `SELECT v.baseline_pair_id,COUNT(*)::int AS count FROM report_baseline_capture_variations v
    JOIN report_baseline_pilot_cohorts c ON c.cohort_id=v.cohort_id AND c.status_code='active'
    WHERE v.dataset_split='training'
    GROUP BY v.baseline_pair_id HAVING COUNT(*)<>?`,
  ).all(profilesPerBaseline);
  const expected={scenarios:expectedBaselines*profilesPerBaseline,baselines:expectedBaselines,profiles:expectedDistinctProfiles,profilesPerBaseline};
  const failures={
    wrongScenarioCount:Number(summary.scenarios)!==expected.scenarios,
    wrongBaselineCount:Number(summary.baselines)!==expected.baselines,
    wrongProfileCount:Number(summary.profiles)!==expected.profiles,
    incompleteStyleSets:incomplete.length,
    nonTraining:Number(summary.non_training),notReady:Number(summary.not_ready),unstored:Number(summary.unstored),
    protectedFailures:Number(summary.protected_failures),requiredFailures:Number(summary.required_failures),goldVisible:Number(summary.gold_visible),
  };
  if(Object.values(failures).some(value=>value===true||Number(value)>0)) throw new Error(`Variation pilot audit failed: ${JSON.stringify(failures)}`);
  console.log(JSON.stringify({passed:true,expected,failures},null,2));
}finally{await db.close();}
