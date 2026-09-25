CREATE TABLE report_governed_gold_sections (
  governed_gold_section_id TEXT PRIMARY KEY,
  taxonomy_version_id TEXT NOT NULL REFERENCES report_corpus_taxonomy_versions (taxonomy_version_id) ON DELETE RESTRICT,
  corpus_report_id TEXT NOT NULL REFERENCES report_corpus_registry (corpus_report_id) ON DELETE RESTRICT,
  document_id TEXT NOT NULL REFERENCES kb_documents (document_id) ON DELETE RESTRICT,
  section_key TEXT NOT NULL,
  dataset_split TEXT NOT NULL CHECK (dataset_split IN ('training','validation')),
  target_content TEXT NOT NULL,
  target_sha256 TEXT NOT NULL CHECK (target_sha256 ~ '^[a-f0-9]{64}$'),
  provenance_json JSONB NOT NULL CHECK (jsonb_typeof(provenance_json)='object'),
  status_code TEXT NOT NULL CHECK (status_code IN ('ready','quarantined')),
  created_at_iso TIMESTAMPTZ NOT NULL,
  updated_at_iso TIMESTAMPTZ NOT NULL,
  UNIQUE (taxonomy_version_id,corpus_report_id,section_key)
);

CREATE TABLE report_governed_baseline_pairs (
  governed_pair_id TEXT PRIMARY KEY,
  governed_gold_section_id TEXT NOT NULL REFERENCES report_governed_gold_sections (governed_gold_section_id) ON DELETE CASCADE,
  corpus_report_id TEXT NOT NULL REFERENCES report_corpus_registry (corpus_report_id) ON DELETE RESTRICT,
  section_key TEXT NOT NULL,
  dataset_split TEXT NOT NULL CHECK (dataset_split IN ('training','validation')),
  contract_version INTEGER NOT NULL CHECK (contract_version > 0),
  mock_input_json JSONB NOT NULL CHECK (jsonb_typeof(mock_input_json)='object'),
  hidden_content_json JSONB NOT NULL CHECK (jsonb_typeof(hidden_content_json)='array'),
  protected_invariants_json JSONB NOT NULL CHECK (jsonb_typeof(protected_invariants_json)='array'),
  validation_json JSONB NOT NULL CHECK (jsonb_typeof(validation_json)='object'),
  input_sha256 TEXT NOT NULL CHECK (input_sha256 ~ '^[a-f0-9]{64}$'),
  status_code TEXT NOT NULL CHECK (status_code IN ('ready','quarantined')),
  created_at_iso TIMESTAMPTZ NOT NULL,
  updated_at_iso TIMESTAMPTZ NOT NULL,
  UNIQUE (governed_gold_section_id,contract_version)
);

CREATE INDEX idx_governed_gold_split_section
  ON report_governed_gold_sections (dataset_split,section_key,status_code);
CREATE INDEX idx_governed_pairs_split_section
  ON report_governed_baseline_pairs (dataset_split,section_key,status_code);

CREATE OR REPLACE FUNCTION guard_governed_pair_alignment()
RETURNS TRIGGER AS $$
DECLARE
  gold_row report_governed_gold_sections%ROWTYPE;
  registry_row report_corpus_registry%ROWTYPE;
BEGIN
  SELECT * INTO gold_row FROM report_governed_gold_sections WHERE governed_gold_section_id=NEW.governed_gold_section_id;
  SELECT * INTO registry_row FROM report_corpus_registry WHERE corpus_report_id=NEW.corpus_report_id;
  IF NEW.corpus_report_id IS DISTINCT FROM gold_row.corpus_report_id
     OR NEW.section_key IS DISTINCT FROM gold_row.section_key
     OR NEW.dataset_split IS DISTINCT FROM gold_row.dataset_split
     OR NEW.dataset_split IS DISTINCT FROM registry_row.dataset_split THEN
    RAISE EXCEPTION 'Governed mock/gold pair identity and split must align'
      USING ERRCODE='check_violation';
  END IF;
  IF NEW.dataset_split='training' AND registry_row.eligibility_role<>'training_reference' THEN
    RAISE EXCEPTION 'Training pairs require a training reference' USING ERRCODE='check_violation';
  END IF;
  IF NEW.dataset_split='validation' AND registry_row.eligibility_role<>'validation_gold' THEN
    RAISE EXCEPTION 'Validation pairs require validation gold' USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER governed_pair_alignment_guard
BEFORE INSERT OR UPDATE ON report_governed_baseline_pairs
FOR EACH ROW EXECUTE FUNCTION guard_governed_pair_alignment();
