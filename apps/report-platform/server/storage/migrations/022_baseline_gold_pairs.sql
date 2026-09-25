CREATE TABLE report_baseline_gold_pairs (
  baseline_pair_id TEXT PRIMARY KEY,
  gold_section_id TEXT NOT NULL REFERENCES report_standardized_gold_sections (gold_section_id) ON DELETE CASCADE,
  training_case_id TEXT NOT NULL REFERENCES report_training_cases (training_case_id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  contract_version INTEGER NOT NULL DEFAULT 1 CHECK (contract_version > 0),
  dataset_split TEXT NOT NULL CHECK (dataset_split IN ('training', 'validation', 'hidden_test')),
  status_code TEXT NOT NULL CHECK (status_code IN ('ready', 'quarantined')),
  deterministic_input_json JSONB NOT NULL,
  hidden_fact_ledger_json JSONB NOT NULL,
  protected_invariants_json JSONB NOT NULL,
  expected_recoverable_fact_ids_json JSONB NOT NULL,
  validation_json JSONB NOT NULL,
  input_sha256 TEXT NOT NULL CHECK (input_sha256 ~ '^[a-f0-9]{64}$'),
  created_at_iso TIMESTAMPTZ NOT NULL,
  updated_at_iso TIMESTAMPTZ NOT NULL,
  UNIQUE (training_case_id, section_key, contract_version),
  CHECK (jsonb_typeof(deterministic_input_json) = 'object'),
  CHECK (jsonb_typeof(hidden_fact_ledger_json) = 'array'),
  CHECK (jsonb_typeof(protected_invariants_json) = 'array'),
  CHECK (jsonb_typeof(expected_recoverable_fact_ids_json) = 'array'),
  CHECK (jsonb_typeof(validation_json) = 'object')
);

CREATE INDEX idx_baseline_gold_pairs_split_status
  ON report_baseline_gold_pairs (dataset_split, status_code, section_key);

CREATE OR REPLACE FUNCTION validate_baseline_pair_split()
RETURNS TRIGGER AS $$
DECLARE
  case_split TEXT;
  gold_split TEXT;
BEGIN
  SELECT dataset_split INTO case_split FROM report_training_cases WHERE training_case_id=NEW.training_case_id;
  SELECT dataset_split INTO gold_split FROM report_standardized_gold_sections WHERE gold_section_id=NEW.gold_section_id;
  IF NEW.dataset_split IS DISTINCT FROM case_split OR NEW.dataset_split IS DISTINCT FROM gold_split THEN
    RAISE EXCEPTION 'Baseline pair split must match Truth Case and gold section'
      USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER baseline_pair_split_guard
BEFORE INSERT OR UPDATE ON report_baseline_gold_pairs
FOR EACH ROW EXECUTE FUNCTION validate_baseline_pair_split();
