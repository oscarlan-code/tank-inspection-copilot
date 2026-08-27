CREATE TABLE report_corpus_taxonomy_versions (
  taxonomy_version_id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL CHECK (schema_version > 0),
  status_code TEXT NOT NULL CHECK (status_code IN ('draft', 'audited', 'active', 'retired')),
  definition_json JSONB NOT NULL CHECK (jsonb_typeof(definition_json) = 'object'),
  source_manifest_sha256 TEXT NOT NULL CHECK (source_manifest_sha256 ~ '^[a-f0-9]{64}$'),
  created_at_iso TIMESTAMPTZ NOT NULL,
  activated_at_iso TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_report_corpus_one_active_taxonomy
  ON report_corpus_taxonomy_versions ((status_code)) WHERE status_code = 'active';

CREATE TABLE report_corpus_registry (
  corpus_report_id TEXT PRIMARY KEY,
  taxonomy_version_id TEXT NOT NULL REFERENCES report_corpus_taxonomy_versions (taxonomy_version_id) ON DELETE RESTRICT,
  content_sha256 TEXT NOT NULL UNIQUE CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  binary_sha256 TEXT NOT NULL CHECK (binary_sha256 ~ '^[a-f0-9]{64}$'),
  selected_relative_path TEXT NOT NULL,
  report_reference TEXT,
  revision_code TEXT,
  asset_lineage_key TEXT NOT NULL,
  publication_status TEXT NOT NULL CHECK (publication_status IN ('issued_revision', 'issued_status_unconfirmed', 'preliminary_or_draft', 'alternate_rendition')),
  document_role TEXT NOT NULL CHECK (document_role IN ('main_report', 'specialist_report')),
  core_family TEXT NOT NULL,
  profile_json JSONB NOT NULL CHECK (jsonb_typeof(profile_json) = 'object'),
  evidence_json JSONB NOT NULL CHECK (jsonb_typeof(evidence_json) = 'array'),
  ambiguity_reasons_json JSONB NOT NULL CHECK (jsonb_typeof(ambiguity_reasons_json) = 'array'),
  dataset_split TEXT NOT NULL CHECK (dataset_split IN ('training', 'validation', 'hidden_test')),
  eligibility_role TEXT NOT NULL CHECK (eligibility_role IN ('training_reference', 'validation_gold', 'hidden_test_gold', 'excluded_draft', 'excluded_ambiguous')),
  retrieval_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  registry_status TEXT NOT NULL CHECK (registry_status IN ('proposed', 'audited', 'active', 'quarantined')),
  created_at_iso TIMESTAMPTZ NOT NULL,
  updated_at_iso TIMESTAMPTZ NOT NULL,
  CHECK (NOT retrieval_eligible OR (dataset_split = 'training' AND eligibility_role = 'training_reference' AND registry_status IN ('audited', 'active'))),
  CHECK (eligibility_role <> 'validation_gold' OR dataset_split = 'validation'),
  CHECK (eligibility_role <> 'hidden_test_gold' OR dataset_split = 'hidden_test')
);

CREATE TABLE report_corpus_copies (
  corpus_report_id TEXT NOT NULL REFERENCES report_corpus_registry (corpus_report_id) ON DELETE CASCADE,
  relative_path TEXT NOT NULL,
  is_selected BOOLEAN NOT NULL DEFAULT FALSE,
  created_at_iso TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (corpus_report_id, relative_path)
);

CREATE UNIQUE INDEX idx_report_corpus_selected_copy
  ON report_corpus_copies (corpus_report_id) WHERE is_selected;
CREATE INDEX idx_report_corpus_lineage_split
  ON report_corpus_registry (asset_lineage_key, dataset_split);
CREATE INDEX idx_report_corpus_retrieval_scope
  ON report_corpus_registry (core_family, dataset_split, retrieval_eligible);

CREATE OR REPLACE FUNCTION guard_report_corpus_lineage_split()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM report_corpus_registry existing
    WHERE existing.asset_lineage_key = NEW.asset_lineage_key
      AND existing.corpus_report_id <> NEW.corpus_report_id
      AND existing.dataset_split <> NEW.dataset_split
  ) THEN
    RAISE EXCEPTION 'All reports in an asset lineage must remain in one dataset split'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER report_corpus_lineage_split_guard
BEFORE INSERT OR UPDATE OF asset_lineage_key, dataset_split ON report_corpus_registry
FOR EACH ROW EXECUTE FUNCTION guard_report_corpus_lineage_split();
