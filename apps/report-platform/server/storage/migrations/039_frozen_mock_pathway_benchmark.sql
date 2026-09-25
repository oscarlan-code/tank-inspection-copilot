UPDATE system_rl_policy_versions SET status_code='archived',archived_at_iso=NOW()
WHERE policy_key='report_generation' AND status_code='training';

INSERT INTO system_rl_policy_versions (
  policy_version_id,policy_key,version_number,display_name,status_code,algorithm_code,
  exploration_coefficient,minimum_promotion_episodes,minimum_mean_reward,maximum_hard_failures,
  config_json,created_at_iso
) VALUES (
  'rl_policy_report_generation_v9_frozen_mock_benchmark','report_generation',9,'Frozen mock-pathway benchmark',
  'training','contextual_ucb_v1',0,80,0.72,0,
  '{"goldFirewall":true,"learningMode":"offline_only","experiment":"frozen_mock_pathway_benchmark_v1","cohortSize":20,"pairContracts":[1,4,5,6],"rewardContract":"evidence_conditioned_v2","goldSimilarityRole":"diagnostic_only","retrievalIndex":"governed_kb_content_v1","promptContract":"qualification_preserving_grounded_v1"}'::jsonb,NOW()
) ON CONFLICT (policy_version_id) DO NOTHING;

INSERT INTO system_rl_policy_arms (arm_id,policy_version_id,arm_key,display_name,description,config_json,is_enabled,stable_order,created_at_iso)
SELECT 'rl_arm_v9_grounded_control','rl_policy_report_generation_v9_frozen_mock_benchmark','grounded','Frozen grounded control','Identical generation and retrieval control for every mock-data pathway.',config_json,TRUE,1,NOW()
FROM system_rl_policy_arms WHERE arm_id='rl_arm_v8_grounded_control'
ON CONFLICT (arm_id) DO NOTHING;
