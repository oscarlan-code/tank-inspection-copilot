CREATE TABLE report_governed_kb_indexes (
  kb_index_id TEXT PRIMARY KEY,
  taxonomy_version_id TEXT NOT NULL REFERENCES report_corpus_taxonomy_versions (taxonomy_version_id) ON DELETE RESTRICT,
  index_version INTEGER NOT NULL CHECK (index_version > 0),
  status_code TEXT NOT NULL CHECK (status_code IN ('building', 'audited', 'active', 'retired')),
  retrieval_contract_json JSONB NOT NULL CHECK (jsonb_typeof(retrieval_contract_json) = 'object'),
  created_at_iso TIMESTAMPTZ NOT NULL,
  audited_at_iso TIMESTAMPTZ,
  activated_at_iso TIMESTAMPTZ,
  UNIQUE (taxonomy_version_id, index_version)
);

CREATE UNIQUE INDEX idx_governed_kb_one_active
  ON report_governed_kb_indexes ((status_code)) WHERE status_code = 'active';

CREATE TABLE report_governed_kb_documents (
  kb_index_id TEXT NOT NULL REFERENCES report_governed_kb_indexes (kb_index_id) ON DELETE CASCADE,
  corpus_report_id TEXT NOT NULL REFERENCES report_corpus_registry (corpus_report_id) ON DELETE RESTRICT,
  document_id TEXT NOT NULL REFERENCES kb_documents (document_id) ON DELETE RESTRICT,
  asset_lineage_key TEXT NOT NULL,
  core_family TEXT NOT NULL,
  scope_code TEXT NOT NULL,
  lifecycle_code TEXT NOT NULL,
  method_codes_json JSONB NOT NULL CHECK (jsonb_typeof(method_codes_json) = 'array'),
  metadata_snapshot_json JSONB NOT NULL CHECK (jsonb_typeof(metadata_snapshot_json) = 'object'),
  created_at_iso TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (kb_index_id, corpus_report_id),
  UNIQUE (kb_index_id, document_id)
);

CREATE TABLE report_governed_kb_sections (
  kb_index_id TEXT NOT NULL,
  corpus_report_id TEXT NOT NULL,
  section_id TEXT NOT NULL REFERENCES kb_sections (section_id) ON DELETE RESTRICT,
  section_key TEXT NOT NULL,
  stable_order INTEGER NOT NULL CHECK (stable_order > 0),
  created_at_iso TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (kb_index_id, corpus_report_id, section_id),
  FOREIGN KEY (kb_index_id, corpus_report_id)
    REFERENCES report_governed_kb_documents (kb_index_id, corpus_report_id) ON DELETE CASCADE
);

CREATE INDEX idx_governed_kb_retrieval
  ON report_governed_kb_documents (kb_index_id, core_family, scope_code, lifecycle_code);
CREATE INDEX idx_governed_kb_section_retrieval
  ON report_governed_kb_sections (kb_index_id, section_key, stable_order);

CREATE OR REPLACE FUNCTION guard_governed_kb_training_source()
RETURNS TRIGGER AS $$
DECLARE
  registry_row report_corpus_registry%ROWTYPE;
  document_row kb_documents%ROWTYPE;
BEGIN
  SELECT * INTO registry_row FROM report_corpus_registry WHERE corpus_report_id=NEW.corpus_report_id;
  SELECT * INTO document_row FROM kb_documents WHERE document_id=NEW.document_id;
  IF registry_row.dataset_split <> 'training'
     OR registry_row.eligibility_role <> 'training_reference'
     OR NOT registry_row.retrieval_eligible THEN
    RAISE EXCEPTION 'Governed KB indexes accept only audited training references'
      USING ERRCODE='check_violation';
  END IF;
  IF document_row.source_sha256 IS DISTINCT FROM registry_row.binary_sha256 THEN
    RAISE EXCEPTION 'Governed KB document hash must match the canonical corpus report'
      USING ERRCODE='check_violation';
  END IF;
  IF NEW.asset_lineage_key IS DISTINCT FROM registry_row.asset_lineage_key
     OR NEW.core_family IS DISTINCT FROM registry_row.core_family THEN
    RAISE EXCEPTION 'Governed KB metadata must match the canonical corpus registry'
      USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER governed_kb_training_source_guard
BEFORE INSERT OR UPDATE ON report_governed_kb_documents
FOR EACH ROW EXECUTE FUNCTION guard_governed_kb_training_source();
