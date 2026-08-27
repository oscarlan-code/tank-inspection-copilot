UPDATE system_rl_policy_versions
SET status_code='archived',archived_at_iso=NOW()
WHERE policy_key='report_generation' AND status_code='training';

INSERT INTO system_rl_policy_versions (
  policy_version_id,policy_key,version_number,display_name,status_code,algorithm_code,
  exploration_coefficient,minimum_promotion_episodes,minimum_mean_reward,maximum_hard_failures,
  config_json,created_at_iso
) VALUES (
  'rl_policy_report_generation_v4_family_scoped','report_generation',4,'Family-scoped voice evidence candidate',
  'training','contextual_ucb_v1',0.30,100,0.75,0,
  '{"goldFirewall":true,"tenantIsolation":true,"learningMode":"offline_only","rewardContract":"voice_evidence_semantic_v1","retrievalFamilyScoped":true}'::jsonb,NOW()
) ON CONFLICT (policy_version_id) DO NOTHING;

INSERT INTO system_rl_policy_arms (
  arm_id,policy_version_id,arm_key,display_name,description,config_json,is_enabled,stable_order,created_at_iso
) VALUES
  ('rl_arm_v4_grounded','rl_policy_report_generation_v4_family_scoped','grounded','Grounded exact-family','Same-section, exact-family precedent with concise evidence-first prompting.',
   '{"agentRoute":"deterministic_first","wordingLimit":1,"promptVariant":"grounded_concise_v1","precedentLimit":2,"standardsLimit":1,"precedentMinimumScore":70,"factRecommendationLimit":0,"precedentCandidateMultiplier":2,"precedentFamilyMode":"exact"}'::jsonb,TRUE,1,NOW()),
  ('rl_arm_v4_balanced','rl_policy_report_generation_v4_family_scoped','balanced','Balanced family-compatible','Same-section, family-compatible precedent with balanced coverage.',
   '{"agentRoute":"default","wordingLimit":2,"promptVariant":"baseline_v1","precedentLimit":3,"standardsLimit":2,"precedentMinimumScore":60,"factRecommendationLimit":0,"precedentCandidateMultiplier":3,"precedentFamilyMode":"compatible"}'::jsonb,TRUE,2,NOW()),
  ('rl_arm_v4_recovery','rl_policy_report_generation_v4_family_scoped','evidence_recovery','Evidence recovery family-compatible','Broader evidence recovery while retaining section and family boundaries.',
   '{"agentRoute":"context_enriched","wordingLimit":3,"promptVariant":"evidence_recovery_v1","precedentLimit":4,"standardsLimit":2,"precedentMinimumScore":55,"factRecommendationLimit":0,"precedentCandidateMultiplier":3,"precedentFamilyMode":"compatible"}'::jsonb,TRUE,3,NOW())
ON CONFLICT (arm_id) DO NOTHING;
