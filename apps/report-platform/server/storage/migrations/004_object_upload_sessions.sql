CREATE TABLE report_object_upload_sessions (
  upload_session_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants (tenant_id),
  workspace_id TEXT NOT NULL REFERENCES workspaces (workspace_id),
  inspection_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL REFERENCES platform_users (user_id),
  idempotency_key TEXT NOT NULL,
  package_sha256 TEXT NOT NULL,
  export_package_json JSONB NOT NULL,
  status_code TEXT NOT NULL,
  expires_at_iso TIMESTAMPTZ NOT NULL,
  finalized_import_id TEXT REFERENCES report_imports (import_id) ON DELETE SET NULL,
  finalized_report_job_id TEXT REFERENCES report_jobs (report_job_id) ON DELETE SET NULL,
  created_at_iso TIMESTAMPTZ NOT NULL,
  updated_at_iso TIMESTAMPTZ NOT NULL,
  finalized_at_iso TIMESTAMPTZ,
  UNIQUE (actor_user_id, idempotency_key)
);

CREATE INDEX idx_report_object_upload_sessions_scope
  ON report_object_upload_sessions (tenant_id, workspace_id, actor_user_id, updated_at_iso DESC);

CREATE TABLE report_object_uploads (
  object_id TEXT PRIMARY KEY,
  upload_session_id TEXT NOT NULL REFERENCES report_object_upload_sessions (upload_session_id) ON DELETE CASCADE,
  attachment_id TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  attachment_kind TEXT NOT NULL,
  media_type TEXT NOT NULL,
  expected_byte_size BIGINT NOT NULL,
  expected_sha256 TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  status_code TEXT NOT NULL,
  verified_byte_size BIGINT,
  verified_sha256 TEXT,
  verified_at_iso TIMESTAMPTZ,
  created_at_iso TIMESTAMPTZ NOT NULL,
  updated_at_iso TIMESTAMPTZ NOT NULL,
  UNIQUE (upload_session_id, attachment_id),
  UNIQUE (upload_session_id, relative_path)
);

CREATE INDEX idx_report_object_uploads_session_status
  ON report_object_uploads (upload_session_id, status_code);
