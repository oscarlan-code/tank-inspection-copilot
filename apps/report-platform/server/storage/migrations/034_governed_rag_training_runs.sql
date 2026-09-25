CREATE TABLE report_governed_rag_training_runs (
  governed_run_id TEXT PRIMARY KEY,
  governed_pair_id TEXT NOT NULL REFERENCES report_governed_baseline_pairs (governed_pair_id) ON DELETE RESTRICT,
  policy_version_id TEXT NOT NULL REFERENCES system_rl_policy_versions (policy_version_id) ON DELETE RESTRICT,
  arm_id TEXT NOT NULL REFERENCES system_rl_policy_arms (arm_id) ON DELETE RESTRICT,
  context_key TEXT NOT NULL,
  retrieval_audit_json JSONB NOT NULL CHECK (jsonb_typeof(retrieval_audit_json)='object'),
  generated_content TEXT NOT NULL DEFAULT '',
  deterministic_metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(deterministic_metrics_json)='object'),
  semantic_metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(semantic_metrics_json)='object'),
  reward_value DOUBLE PRECISION,
  hard_failure BOOLEAN NOT NULL DEFAULT FALSE,
  status_code TEXT NOT NULL CHECK (status_code IN ('running','completed','failed')),
  error_message TEXT,
  started_at_iso TIMESTAMPTZ NOT NULL,
  completed_at_iso TIMESTAMPTZ,
  updated_at_iso TIMESTAMPTZ NOT NULL,
  UNIQUE (governed_pair_id,policy_version_id,arm_id)
);

CREATE INDEX idx_governed_rag_training_status
  ON report_governed_rag_training_runs (policy_version_id,status_code,context_key);

CREATE OR REPLACE FUNCTION guard_governed_rag_training_run()
RETURNS TRIGGER AS $$
DECLARE
  pair_row report_governed_baseline_pairs%ROWTYPE;
  arm_policy TEXT;
BEGIN
  SELECT * INTO pair_row FROM report_governed_baseline_pairs WHERE governed_pair_id=NEW.governed_pair_id;
  SELECT policy_version_id INTO arm_policy FROM system_rl_policy_arms WHERE arm_id=NEW.arm_id;
  IF pair_row.dataset_split<>'training' OR pair_row.status_code<>'ready' THEN
    RAISE EXCEPTION 'Governed learning runs require a ready training pair' USING ERRCODE='check_violation';
  END IF;
  IF arm_policy IS DISTINCT FROM NEW.policy_version_id THEN
    RAISE EXCEPTION 'Governed learning run arm must belong to its policy' USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER governed_rag_training_run_guard
BEFORE INSERT OR UPDATE ON report_governed_rag_training_runs
FOR EACH ROW EXECUTE FUNCTION guard_governed_rag_training_run();
