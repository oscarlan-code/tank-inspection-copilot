UPDATE system_rl_policy_versions
SET status_code='archived',archived_at_iso=NOW()
WHERE policy_version_id='rl_policy_report_generation_v2_candidate' AND status_code='training';

INSERT INTO system_rl_policy_versions (
  policy_version_id,policy_key,version_number,display_name,status_code,algorithm_code,
  exploration_coefficient,minimum_promotion_episodes,minimum_mean_reward,maximum_hard_failures,
  config_json,created_at_iso
) VALUES (
  'rl_policy_report_generation_v3_atomic','report_generation',3,'Atomic-fact reward candidate',
  'training','contextual_ucb_v1',0.35,100,0.72,0,
  '{"goldFirewall":true,"tenantIsolation":true,"learningMode":"offline_only","rewardContract":"atomic_protected_claims_v1"}'::jsonb,NOW()
) ON CONFLICT (policy_version_id) DO NOTHING;

INSERT INTO system_rl_policy_arms (
  arm_id,policy_version_id,arm_key,display_name,description,config_json,is_enabled,stable_order,created_at_iso
)
SELECT 'rl_arm_v3_'||arm_key,'rl_policy_report_generation_v3_atomic',arm_key,display_name,description,
  config_json,is_enabled,stable_order,NOW()
FROM system_rl_policy_arms WHERE policy_version_id='rl_policy_report_generation_v2_candidate'
ON CONFLICT (arm_id) DO NOTHING;
