UPDATE system_rl_policy_versions SET status_code='archived',archived_at_iso=NOW()
WHERE policy_key='report_generation' AND status_code='training';

INSERT INTO system_rl_policy_versions (
  policy_version_id,policy_key,version_number,display_name,status_code,algorithm_code,
  exploration_coefficient,minimum_promotion_episodes,minimum_mean_reward,maximum_hard_failures,
  config_json,created_at_iso
) VALUES (
  'rl_policy_report_generation_v7_labelled_voice','report_generation',7,'Labelled mobile-voice evidence candidate',
  'training','contextual_ucb_v1',0.25,90,0.72,0,
  '{"goldFirewall":true,"learningMode":"offline_only","rewardContract":"evidence_conditioned_v2","goldSimilarityRole":"diagnostic_only","retrievalIndex":"governed_kb_content_v1","pairContractVersion":3,"voiceContract":"section_field_labelled_v1","typedProtectedFactsOnly":true}'::jsonb,NOW()
) ON CONFLICT (policy_version_id) DO NOTHING;

INSERT INTO system_rl_policy_arms (arm_id,policy_version_id,arm_key,display_name,description,config_json,is_enabled,stable_order,created_at_iso)
SELECT replace(arm_id,'rl_arm_v6_','rl_arm_v7_'),'rl_policy_report_generation_v7_labelled_voice',arm_key,display_name,description,config_json,is_enabled,stable_order,NOW()
FROM system_rl_policy_arms WHERE policy_version_id='rl_policy_report_generation_v6_evidence_reward'
ON CONFLICT (arm_id) DO NOTHING;
