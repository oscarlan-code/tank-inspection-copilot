CREATE TABLE kb_cases (
  case_id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants (tenant_id) ON DELETE CASCADE,
  workspace_id TEXT REFERENCES workspaces (workspace_id) ON DELETE CASCADE,
  report_family TEXT NOT NULL,
  dataset_split TEXT NOT NULL CHECK (
    dataset_split IN ('training', 'validation', 'hidden_test', 'unassigned')
  ),
  status_code TEXT NOT NULL CHECK (
    status_code IN ('discovered', 'reviewed', 'approved', 'retired', 'quarantined')
  ),
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at_iso TIMESTAMPTZ NOT NULL,
  updated_at_iso TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_kb_cases_scope_split
  ON kb_cases (tenant_id, workspace_id, dataset_split, status_code);

ALTER TABLE kb_documents
  ADD COLUMN case_id TEXT REFERENCES kb_cases (case_id) ON DELETE CASCADE,
  ADD COLUMN rendition_id TEXT,
  ADD COLUMN document_role TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN dataset_split TEXT NOT NULL DEFAULT 'unassigned',
  ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'pending_review',
  ADD COLUMN retrieval_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN source_object_key TEXT,
  ADD COLUMN parser_name TEXT,
  ADD COLUMN parser_version TEXT,
  ADD COLUMN extraction_quality_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE kb_documents
  ADD CONSTRAINT kb_documents_dataset_split_check CHECK (
    dataset_split IN ('training', 'validation', 'hidden_test', 'unassigned')
  ),
  ADD CONSTRAINT kb_documents_approval_status_check CHECK (
    approval_status IN ('pending_review', 'reviewed', 'approved', 'rejected', 'retired')
  ),
  ADD CONSTRAINT kb_documents_retrieval_gate_check CHECK (
    NOT retrieval_eligible OR approval_status = 'approved'
  );

CREATE UNIQUE INDEX idx_kb_documents_case_rendition
  ON kb_documents (case_id, rendition_id)
  WHERE case_id IS NOT NULL AND rendition_id IS NOT NULL;

CREATE TABLE kb_ingestion_runs (
  ingestion_run_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES kb_cases (case_id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES kb_documents (document_id) ON DELETE CASCADE,
  source_sha256 TEXT NOT NULL,
  pipeline_version TEXT NOT NULL,
  status_code TEXT NOT NULL CHECK (
    status_code IN ('running', 'awaiting_review', 'failed', 'approved', 'rejected')
  ),
  quality_json JSONB NOT NULL,
  manifest_json JSONB NOT NULL,
  started_at_iso TIMESTAMPTZ NOT NULL,
  completed_at_iso TIMESTAMPTZ
);

CREATE INDEX idx_kb_ingestion_runs_document
  ON kb_ingestion_runs (document_id, started_at_iso DESC);

CREATE TABLE kb_sections (
  section_id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES kb_documents (document_id) ON DELETE CASCADE,
  ingestion_run_id TEXT NOT NULL REFERENCES kb_ingestion_runs (ingestion_run_id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  original_heading TEXT NOT NULL,
  stable_order INTEGER NOT NULL CHECK (stable_order > 0),
  review_status TEXT NOT NULL CHECK (
    review_status IN ('pending_review', 'reviewed', 'approved', 'rejected')
  ),
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at_iso TIMESTAMPTZ NOT NULL,
  updated_at_iso TIMESTAMPTZ NOT NULL,
  UNIQUE (document_id, section_key)
);

ALTER TABLE kb_chunks
  ADD COLUMN ingestion_run_id TEXT REFERENCES kb_ingestion_runs (ingestion_run_id) ON DELETE CASCADE,
  ADD COLUMN block_type TEXT,
  ADD COLUMN content_sha256 TEXT,
  ADD COLUMN source_block_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN page_numbers_json JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE kb_ingestion_escalations (
  request_id TEXT PRIMARY KEY,
  ingestion_run_id TEXT NOT NULL REFERENCES kb_ingestion_runs (ingestion_run_id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES kb_documents (document_id) ON DELETE CASCADE,
  task_code TEXT NOT NULL,
  status_code TEXT NOT NULL CHECK (
    status_code IN ('pending', 'proposed', 'accepted', 'rejected', 'failed')
  ),
  request_json JSONB NOT NULL,
  annotation_json JSONB,
  reviewed_by_user_id TEXT REFERENCES platform_users (user_id) ON DELETE SET NULL,
  reviewed_at_iso TIMESTAMPTZ,
  created_at_iso TIMESTAMPTZ NOT NULL,
  updated_at_iso TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_kb_ingestion_escalations_status
  ON kb_ingestion_escalations (status_code, created_at_iso DESC);
