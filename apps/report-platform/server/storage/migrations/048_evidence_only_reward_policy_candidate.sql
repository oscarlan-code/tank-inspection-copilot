UPDATE system_rl_policy_versions SET status_code='archived',archived_at_iso=NOW()
WHERE policy_key='report_generation' AND status_code='training';

INSERT INTO system_rl_policy_versions (
  policy_version_id,policy_key,version_number,display_name,status_code,algorithm_code,
  exploration_coefficient,minimum_promotion_episodes,minimum_mean_reward,maximum_hard_failures,config_json,created_at_iso
) VALUES (
  'rl_policy_report_generation_v16_evidence_reward','report_generation',16,'Evidence-only reward frozen validation candidate','training','fixed_v1',0,20,0.80,0,
  '{"goldFirewall":true,"learningMode":"validation_only","trainingPolicy":"rl_policy_report_generation_v9_frozen_mock_benchmark","pairContract":10,"structuredRecordCompiler":"app_records_v1","narrativeContract":"fragment_safe_atomic_v2","pendingQualifierGuard":"deterministic_v1","validationCohortId":"governed_v12_frozen20","validationCohortSize":20,"selector":{"inspection-maintenance-regime":"evidence_recovery","default":"grounded"},"rewardBasis":"current_evidence_only","goldSimilarityRole":"diagnostic_only"}'::jsonb,NOW()
) ON CONFLICT (policy_version_id) DO NOTHING;

INSERT INTO system_rl_policy_arms (arm_id,policy_version_id,arm_key,display_name,description,config_json,is_enabled,stable_order,created_at_iso)
SELECT 'rl_arm_v16_grounded','rl_policy_report_generation_v16_evidence_reward','grounded','Evidence-reward grounded','Fragment-safe narrative and deterministic app records; reward uses current evidence only.',config_json,TRUE,1,NOW()
FROM system_rl_policy_arms WHERE arm_id='rl_arm_v15_grounded' ON CONFLICT (arm_id) DO NOTHING;

INSERT INTO system_rl_policy_arms (arm_id,policy_version_id,arm_key,display_name,description,config_json,is_enabled,stable_order,created_at_iso)
SELECT 'rl_arm_v16_evidence_recovery','rl_policy_report_generation_v16_evidence_reward','evidence_recovery','Evidence-reward maintenance recovery','Fragment-safe maintenance narrative and deterministic app records; reward uses current evidence only.',config_json,TRUE,2,NOW()
FROM system_rl_policy_arms WHERE arm_id='rl_arm_v15_evidence_recovery' ON CONFLICT (arm_id) DO NOTHING;
