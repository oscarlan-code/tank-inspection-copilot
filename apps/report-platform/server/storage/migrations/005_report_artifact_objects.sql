CREATE TABLE report_artifact_objects (
  artifact_object_id TEXT PRIMARY KEY,
  report_job_id TEXT NOT NULL REFERENCES report_jobs (report_job_id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants (tenant_id),
  workspace_id TEXT NOT NULL REFERENCES workspaces (workspace_id),
  artifact_run_id TEXT NOT NULL,
  artifact_kind TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  media_type TEXT NOT NULL,
  byte_size BIGINT NOT NULL,
  sha256 TEXT NOT NULL,
  original_file_name TEXT,
  created_by_user_id TEXT REFERENCES platform_users (user_id) ON DELETE SET NULL,
  created_at_iso TIMESTAMPTZ NOT NULL,
  UNIQUE (report_job_id, artifact_run_id, relative_path)
);

CREATE INDEX idx_report_artifact_objects_report_run
  ON report_artifact_objects (report_job_id, artifact_run_id, relative_path);

CREATE INDEX idx_report_artifact_objects_scope
  ON report_artifact_objects (tenant_id, workspace_id, created_at_iso DESC);
