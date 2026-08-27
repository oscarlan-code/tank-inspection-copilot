UPDATE system_rl_policy_versions SET status_code='archived',archived_at_iso=NOW()
WHERE policy_key='report_generation' AND status_code='training';

INSERT INTO system_rl_policy_versions (
  policy_version_id,policy_key,version_number,display_name,status_code,algorithm_code,
  exploration_coefficient,minimum_promotion_episodes,minimum_mean_reward,maximum_hard_failures,
  config_json,created_at_iso
) VALUES (
  'rl_policy_report_generation_v10_frozen_contextual_validation','report_generation',10,'Frozen contextual validation candidate',
  'training','fixed_v1',0,20,0.72,0,
  '{"goldFirewall":true,"learningMode":"validation_only","trainingPolicy":"rl_policy_report_generation_v9_frozen_mock_benchmark","pairContract":7,"validationCohortSize":20,"selector":{"inspection-maintenance-regime":"evidence_recovery","default":"grounded"},"goldSimilarityRole":"diagnostic_only"}'::jsonb,NOW()
) ON CONFLICT (policy_version_id) DO NOTHING;

INSERT INTO system_rl_policy_arms (arm_id,policy_version_id,arm_key,display_name,description,config_json,is_enabled,stable_order,created_at_iso)
SELECT 'rl_arm_v10_grounded','rl_policy_report_generation_v10_frozen_contextual_validation','grounded','Frozen grounded','Grounded arm selected for all sections except inspection maintenance.',config_json,TRUE,1,NOW()
FROM system_rl_policy_arms WHERE arm_id='rl_arm_v9_grounded_control'
ON CONFLICT (arm_id) DO NOTHING;

INSERT INTO system_rl_policy_arms (arm_id,policy_version_id,arm_key,display_name,description,config_json,is_enabled,stable_order,created_at_iso)
SELECT 'rl_arm_v10_evidence_recovery','rl_policy_report_generation_v10_frozen_contextual_validation','evidence_recovery','Frozen maintenance recovery','Evidence-recovery arm selected only for inspection-maintenance sections.',config_json,TRUE,2,NOW()
FROM system_rl_policy_arms WHERE arm_id='rl_arm_v9_evidence_recovery'
ON CONFLICT (arm_id) DO NOTHING;

CREATE OR REPLACE FUNCTION guard_governed_rag_training_run()
RETURNS TRIGGER AS $$
DECLARE
  pair_row report_governed_baseline_pairs%ROWTYPE;
  arm_policy TEXT;
  policy_mode TEXT;
BEGIN
  SELECT * INTO pair_row FROM report_governed_baseline_pairs WHERE governed_pair_id=NEW.governed_pair_id;
  SELECT policy_version_id INTO arm_policy FROM system_rl_policy_arms WHERE arm_id=NEW.arm_id;
  SELECT config_json->>'learningMode' INTO policy_mode FROM system_rl_policy_versions WHERE policy_version_id=NEW.policy_version_id;
  IF pair_row.status_code<>'ready' OR NOT (
    pair_row.dataset_split='training' OR
    (pair_row.dataset_split='validation' AND policy_mode='validation_only')
  ) THEN
    RAISE EXCEPTION 'Governed runs require a ready pair compatible with policy mode' USING ERRCODE='check_violation';
  END IF;
  IF arm_policy IS DISTINCT FROM NEW.policy_version_id THEN
    RAISE EXCEPTION 'Governed learning run arm must belong to its policy' USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
