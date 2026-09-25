CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE tenants (
  tenant_id TEXT PRIMARY KEY,
  tenant_name TEXT NOT NULL,
  created_at_iso TIMESTAMPTZ NOT NULL,
  updated_at_iso TIMESTAMPTZ NOT NULL
);

CREATE TABLE workspaces (
  workspace_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants (tenant_id),
  workspace_name TEXT NOT NULL,
  created_at_iso TIMESTAMPTZ NOT NULL,
  updated_at_iso TIMESTAMPTZ NOT NULL
);

CREATE TABLE platform_users (
  user_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants (tenant_id),
  workspace_id TEXT NOT NULL REFERENCES workspaces (workspace_id),
  display_name TEXT NOT NULL,
  role_label TEXT NOT NULL,
  device_id TEXT,
  identity_provider TEXT,
  external_subject TEXT,
  account_status TEXT NOT NULL DEFAULT 'active',
  created_at_iso TIMESTAMPTZ NOT NULL,
  updated_at_iso TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX idx_platform_users_external_identity
  ON platform_users (identity_provider, external_subject)
  WHERE identity_provider IS NOT NULL AND external_subject IS NOT NULL;

CREATE TABLE workspace_role_memberships (
  workspace_id TEXT NOT NULL REFERENCES workspaces (workspace_id),
  user_id TEXT NOT NULL REFERENCES platform_users (user_id),
  role_label TEXT NOT NULL,
  created_at_iso TIMESTAMPTZ NOT NULL,
  updated_at_iso TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (workspace_id, user_id, role_label)
);

CREATE TABLE report_imports (
  import_id TEXT PRIMARY KEY,
  inspection_id TEXT NOT NULL UNIQUE,
  tenant_id TEXT NOT NULL REFERENCES tenants (tenant_id),
  workspace_id TEXT NOT NULL REFERENCES workspaces (workspace_id),
  package_type TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  inspection_reference TEXT NOT NULL,
  exported_by_user_id TEXT NOT NULL REFERENCES platform_users (user_id),
  exported_at_iso TIMESTAMPTZ NOT NULL,
  raw_package_json JSONB NOT NULL,
  created_at_iso TIMESTAMPTZ NOT NULL,
  updated_at_iso TIMESTAMPTZ NOT NULL
);

CREATE TABLE report_jobs (
  report_job_id TEXT PRIMARY KEY,
  import_id TEXT NOT NULL REFERENCES report_imports (import_id),
  bootstrap_key TEXT,
  inspection_id TEXT NOT NULL UNIQUE,
  tenant_id TEXT NOT NULL REFERENCES tenants (tenant_id),
  workspace_id TEXT NOT NULL REFERENCES workspaces (workspace_id),
  created_by_user_id TEXT NOT NULL REFERENCES platform_users (user_id),
  report_reference TEXT NOT NULL,
  title TEXT NOT NULL,
  client TEXT NOT NULL,
  tank TEXT NOT NULL,
  inspected_date TEXT NOT NULL,
  status_code TEXT NOT NULL,
  created_at_iso TIMESTAMPTZ NOT NULL,
  updated_at_iso TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_report_jobs_bootstrap_key ON report_jobs (bootstrap_key);
CREATE INDEX idx_report_jobs_scope ON report_jobs (tenant_id, workspace_id, updated_at_iso DESC);

CREATE TABLE report_manual_inputs (
  report_job_id TEXT NOT NULL REFERENCES report_jobs (report_job_id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  field_value TEXT NOT NULL,
  updated_at_iso TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (report_job_id, field_key)
);

CREATE TABLE report_section_drafts (
  report_job_id TEXT NOT NULL REFERENCES report_jobs (report_job_id) ON DELETE CASCADE,
  section_id TEXT NOT NULL,
  content TEXT NOT NULL,
  generated INTEGER NOT NULL,
  edited INTEGER NOT NULL,
  approved INTEGER NOT NULL,
  review_required INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at_iso TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (report_job_id, section_id)
);

CREATE TABLE report_section_draft_versions (
  version_id TEXT PRIMARY KEY,
  report_job_id TEXT NOT NULL REFERENCES report_jobs (report_job_id) ON DELETE CASCADE,
  section_id TEXT NOT NULL,
  content TEXT NOT NULL,
  generated INTEGER NOT NULL,
  edited INTEGER NOT NULL,
  approved INTEGER NOT NULL,
  review_required INTEGER NOT NULL,
  source_updated_at_iso TIMESTAMPTZ NOT NULL,
  reason_code TEXT NOT NULL,
  created_at_iso TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_report_section_draft_versions_section_created
  ON report_section_draft_versions (report_job_id, section_id, created_at_iso DESC);

CREATE TABLE report_layout_overrides (
  report_job_id TEXT NOT NULL REFERENCES report_jobs (report_job_id) ON DELETE CASCADE,
  section_id TEXT NOT NULL,
  layout_json JSONB NOT NULL,
  updated_at_iso TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (report_job_id, section_id)
);

CREATE TABLE report_review_decisions (
  decision_id BIGSERIAL PRIMARY KEY,
  report_job_id TEXT NOT NULL REFERENCES report_jobs (report_job_id) ON DELETE CASCADE,
  section_id TEXT NOT NULL,
  decision_code TEXT NOT NULL,
  actor_user_id TEXT NOT NULL REFERENCES platform_users (user_id),
  note TEXT,
  created_at_iso TIMESTAMPTZ NOT NULL
);

CREATE TABLE report_generation_runs (
  run_id TEXT PRIMARY KEY,
  report_job_id TEXT NOT NULL REFERENCES report_jobs (report_job_id) ON DELETE CASCADE,
  section_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL REFERENCES platform_users (user_id),
  template_key TEXT NOT NULL,
  status_code TEXT NOT NULL,
  retrieval_json JSONB NOT NULL,
  calculation_json JSONB NOT NULL,
  map_artifacts_json JSONB NOT NULL,
  warnings_json JSONB NOT NULL,
  blockers_json JSONB NOT NULL,
  provider_code TEXT,
  model_id TEXT,
  used_live_model INTEGER,
  fallback_reason TEXT,
  assistant_summary TEXT,
  orchestration_json JSONB NOT NULL,
  generated_content TEXT NOT NULL,
  created_at_iso TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_report_generation_runs_job_created
  ON report_generation_runs (report_job_id, created_at_iso DESC);

CREATE TABLE report_eval_runs (
  eval_run_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES report_generation_runs (run_id) ON DELETE CASCADE,
  report_job_id TEXT NOT NULL REFERENCES report_jobs (report_job_id) ON DELETE CASCADE,
  section_id TEXT NOT NULL,
  evaluator_key TEXT NOT NULL,
  score DOUBLE PRECISION NOT NULL,
  outcome_code TEXT NOT NULL,
  summary TEXT NOT NULL,
  eval_json JSONB NOT NULL,
  created_at_iso TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_report_eval_runs_job_created
  ON report_eval_runs (report_job_id, created_at_iso DESC);
CREATE INDEX idx_report_eval_runs_section_created
  ON report_eval_runs (report_job_id, section_id, created_at_iso DESC);

CREATE TABLE kb_documents (
  document_id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants (tenant_id),
  workspace_id TEXT REFERENCES workspaces (workspace_id),
  visibility_code TEXT NOT NULL,
  document_type TEXT NOT NULL,
  source_uri TEXT NOT NULL,
  source_sha256 TEXT NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at_iso TIMESTAMPTZ NOT NULL,
  updated_at_iso TIMESTAMPTZ NOT NULL
);

CREATE TABLE kb_chunks (
  chunk_id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES kb_documents (document_id) ON DELETE CASCADE,
  tenant_id TEXT REFERENCES tenants (tenant_id),
  workspace_id TEXT REFERENCES workspaces (workspace_id),
  section_type TEXT,
  content TEXT NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding vector(1536),
  created_at_iso TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_kb_chunks_scope ON kb_chunks (tenant_id, workspace_id, section_type);
