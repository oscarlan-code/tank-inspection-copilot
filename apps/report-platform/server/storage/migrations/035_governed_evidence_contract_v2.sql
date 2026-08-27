ALTER TABLE report_governed_gold_sections
  ADD COLUMN IF NOT EXISTS gold_contract_version INTEGER NOT NULL DEFAULT 1 CHECK (gold_contract_version > 0);

ALTER TABLE report_governed_gold_sections
  DROP CONSTRAINT IF EXISTS report_governed_gold_sections_taxonomy_version_id_corpus_re_key;

ALTER TABLE report_governed_gold_sections
  ADD CONSTRAINT report_governed_gold_sections_version_identity_key
  UNIQUE (taxonomy_version_id,corpus_report_id,section_key,gold_contract_version);

UPDATE system_rl_policy_versions
SET status_code='archived',archived_at_iso=NOW()
WHERE policy_key='report_generation' AND status_code='training';

INSERT INTO system_rl_policy_versions (
  policy_version_id,policy_key,version_number,display_name,status_code,algorithm_code,
  exploration_coefficient,minimum_promotion_episodes,minimum_mean_reward,maximum_hard_failures,
  config_json,created_at_iso
) VALUES (
  'rl_policy_report_generation_v5_governed','report_generation',5,'Governed evidence-contract V2 candidate',
  'training','contextual_ucb_v1',0.25,90,0.72,0,
  '{"goldFirewall":true,"learningMode":"offline_only","rewardContract":"governed_semantic_v2","retrievalIndex":"governed_kb_content_v1","pairContractVersion":2,"typedProtectedFactsOnly":true}'::jsonb,NOW()
) ON CONFLICT (policy_version_id) DO NOTHING;

INSERT INTO system_rl_policy_arms (
  arm_id,policy_version_id,arm_key,display_name,description,config_json,is_enabled,stable_order,created_at_iso
) VALUES
  ('rl_arm_v5_grounded','rl_policy_report_generation_v5_governed','grounded','Strict matched precedent','Exact scope and lifecycle, compact precedent, concise evidence-only drafting.',
   '{"agentRoute":"deterministic_first","promptVariant":"grounded_concise_v2","precedentLimit":2,"retrievalScope":"exact_profile","precedentCharacterLimit":1600}'::jsonb,TRUE,1,NOW()),
  ('rl_arm_v5_balanced','rl_policy_report_generation_v5_governed','balanced','Method-aware balanced','Same-family and same-section retrieval ranked by evidence and inspection-method compatibility.',
   '{"agentRoute":"default","promptVariant":"balanced_method_v2","precedentLimit":3,"retrievalScope":"method_compatible","precedentCharacterLimit":2200}'::jsonb,TRUE,2,NOW()),
  ('rl_arm_v5_recovery','rl_policy_report_generation_v5_governed','evidence_recovery','Broad evidence recovery','Broader same-family, same-section precedent with explicit missing-information synthesis controls.',
   '{"agentRoute":"context_enriched","promptVariant":"evidence_recovery_v2","precedentLimit":5,"retrievalScope":"family_section","precedentCharacterLimit":2600}'::jsonb,TRUE,3,NOW())
ON CONFLICT (arm_id) DO NOTHING;
