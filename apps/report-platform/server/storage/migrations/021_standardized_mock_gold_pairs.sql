CREATE TABLE report_standardized_gold_sections (
  gold_section_id TEXT PRIMARY KEY,
  training_case_id TEXT NOT NULL REFERENCES report_training_cases (training_case_id) ON DELETE CASCADE,
  source_document_id TEXT NOT NULL REFERENCES kb_documents (document_id) ON DELETE RESTRICT,
  section_key TEXT NOT NULL,
  contract_version INTEGER NOT NULL DEFAULT 1 CHECK (contract_version > 0),
  dataset_split TEXT NOT NULL CHECK (dataset_split IN ('training', 'validation', 'hidden_test')),
  target_content TEXT NOT NULL,
  normalized_facts_json JSONB NOT NULL,
  provenance_json JSONB NOT NULL,
  target_sha256 TEXT NOT NULL CHECK (target_sha256 ~ '^[a-f0-9]{64}$'),
  created_at_iso TIMESTAMPTZ NOT NULL,
  UNIQUE (training_case_id, section_key, contract_version),
  CHECK (jsonb_typeof(normalized_facts_json) = 'array'),
  CHECK (jsonb_typeof(provenance_json) = 'object')
);

CREATE TABLE report_standardized_mock_gold_pairs (
  pair_id TEXT PRIMARY KEY,
  gold_section_id TEXT NOT NULL REFERENCES report_standardized_gold_sections (gold_section_id) ON DELETE CASCADE,
  variant_id TEXT NOT NULL REFERENCES report_capture_variants (variant_id) ON DELETE RESTRICT,
  training_case_id TEXT NOT NULL REFERENCES report_training_cases (training_case_id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  contract_version INTEGER NOT NULL DEFAULT 1 CHECK (contract_version > 0),
  dataset_split TEXT NOT NULL CHECK (dataset_split IN ('training', 'validation', 'hidden_test')),
  status_code TEXT NOT NULL CHECK (status_code IN ('ready', 'quarantined')),
  mock_input_json JSONB NOT NULL,
  hidden_fact_ledger_json JSONB NOT NULL,
  protected_invariants_json JSONB NOT NULL,
  expected_recoverable_fact_ids_json JSONB NOT NULL,
  validation_json JSONB NOT NULL,
  created_at_iso TIMESTAMPTZ NOT NULL,
  updated_at_iso TIMESTAMPTZ NOT NULL,
  UNIQUE (variant_id, section_key, contract_version),
  CHECK (jsonb_typeof(mock_input_json) = 'object'),
  CHECK (jsonb_typeof(hidden_fact_ledger_json) = 'array'),
  CHECK (jsonb_typeof(protected_invariants_json) = 'array'),
  CHECK (jsonb_typeof(expected_recoverable_fact_ids_json) = 'array'),
  CHECK (jsonb_typeof(validation_json) = 'object')
);

CREATE INDEX idx_standardized_pairs_split_status
  ON report_standardized_mock_gold_pairs (dataset_split, status_code, section_key);

CREATE OR REPLACE FUNCTION validate_standardized_pair_split()
RETURNS TRIGGER AS $$
DECLARE
  case_split TEXT;
  variant_split TEXT;
  gold_split TEXT;
BEGIN
  SELECT dataset_split INTO case_split FROM report_training_cases WHERE training_case_id = NEW.training_case_id;
  SELECT dataset_split INTO variant_split FROM report_capture_variants WHERE variant_id = NEW.variant_id;
  SELECT dataset_split INTO gold_split FROM report_standardized_gold_sections WHERE gold_section_id = NEW.gold_section_id;
  IF NEW.dataset_split IS DISTINCT FROM case_split
     OR NEW.dataset_split IS DISTINCT FROM variant_split
     OR NEW.dataset_split IS DISTINCT FROM gold_split THEN
    RAISE EXCEPTION 'Standardized pair split must match Truth Case, Capture Variant, and gold section'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER standardized_pair_split_guard
BEFORE INSERT OR UPDATE ON report_standardized_mock_gold_pairs
FOR EACH ROW EXECUTE FUNCTION validate_standardized_pair_split();
