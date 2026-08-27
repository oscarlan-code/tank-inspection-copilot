INSERT INTO system_rl_policy_arms (arm_id,policy_version_id,arm_key,display_name,description,config_json,is_enabled,stable_order,created_at_iso)
SELECT 'rl_arm_v9_balanced','rl_policy_report_generation_v9_frozen_mock_benchmark','balanced','Method-aware balanced','Uses method-compatible precedents and balanced evidence organization.',config_json,TRUE,2,NOW()
FROM system_rl_policy_arms WHERE arm_id='rl_arm_v7_balanced'
ON CONFLICT (arm_id) DO NOTHING;

INSERT INTO system_rl_policy_arms (arm_id,policy_version_id,arm_key,display_name,description,config_json,is_enabled,stable_order,created_at_iso)
SELECT 'rl_arm_v9_evidence_recovery','rl_policy_report_generation_v9_frozen_mock_benchmark','evidence_recovery','Broad evidence recovery','Uses broader same-family section precedents while preserving missing inputs.',config_json,TRUE,3,NOW()
FROM system_rl_policy_arms WHERE arm_id='rl_arm_v7_recovery'
ON CONFLICT (arm_id) DO NOTHING;

UPDATE system_rl_policy_versions
SET algorithm_code='contextual_ucb_v1',exploration_coefficient=0.25,minimum_promotion_episodes=300,
    config_json=config_json||'{"experiment":"contextual_rag_arm_training_v1","pairContracts":[7],"cohortSize":100,"approvedArms":["grounded","balanced","evidence_recovery"]}'::jsonb
WHERE policy_version_id='rl_policy_report_generation_v9_frozen_mock_benchmark';
