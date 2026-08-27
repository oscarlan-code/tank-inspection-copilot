CREATE TABLE canonical_ingestion_jobs (
  job_id TEXT PRIMARY KEY,
  status_code TEXT NOT NULL CHECK (status_code IN ('idle', 'running', 'completed', 'completed_with_errors', 'stopped')),
  total_reports INTEGER NOT NULL DEFAULT 0,
  processed_reports INTEGER NOT NULL DEFAULT 0,
  failed_reports INTEGER NOT NULL DEFAULT 0,
  current_file_name TEXT,
  failures_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at_iso TIMESTAMPTZ,
  updated_at_iso TIMESTAMPTZ NOT NULL,
  completed_at_iso TIMESTAMPTZ
);
