UPDATE system_rl_policy_versions
SET status_code='archived',archived_at_iso=NOW()
WHERE policy_key='report_generation' AND status_code='training';

INSERT INTO system_rl_policy_versions (
  policy_version_id,policy_key,version_number,display_name,status_code,algorithm_code,
  exploration_coefficient,minimum_promotion_episodes,minimum_mean_reward,maximum_hard_failures,
  config_json,created_at_iso
) VALUES (
  'rl_policy_report_generation_v13_deterministic_records','report_generation',13,'Deterministic app-record frozen validation candidate',
  'training','fixed_v1',0,20,0.80,0,
  '{"goldFirewall":true,"learningMode":"validation_only","trainingPolicy":"rl_policy_report_generation_v9_frozen_mock_benchmark","pairContract":10,"entityBindingContract":"entity_relationship_binding_v1","structuredRecordCompiler":"app_records_v1","validationCohortId":"governed_v12_frozen20","validationCohortSize":20,"selector":{"inspection-maintenance-regime":"evidence_recovery","default":"grounded"},"goldSimilarityRole":"diagnostic_only"}'::jsonb,NOW()
) ON CONFLICT (policy_version_id) DO NOTHING;

INSERT INTO system_rl_policy_arms (arm_id,policy_version_id,arm_key,display_name,description,config_json,is_enabled,stable_order,created_at_iso)
SELECT 'rl_arm_v13_grounded','rl_policy_report_generation_v13_deterministic_records','grounded','Deterministic-record grounded','Narrative generation with deterministic app-record compilation.',config_json,TRUE,1,NOW()
FROM system_rl_policy_arms WHERE arm_id='rl_arm_v12_grounded' ON CONFLICT (arm_id) DO NOTHING;

INSERT INTO system_rl_policy_arms (arm_id,policy_version_id,arm_key,display_name,description,config_json,is_enabled,stable_order,created_at_iso)
SELECT 'rl_arm_v13_evidence_recovery','rl_policy_report_generation_v13_deterministic_records','evidence_recovery','Deterministic-record maintenance recovery','Maintenance narrative generation with deterministic app-record compilation.',config_json,TRUE,2,NOW()
FROM system_rl_policy_arms WHERE arm_id='rl_arm_v12_evidence_recovery' ON CONFLICT (arm_id) DO NOTHING;
