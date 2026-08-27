CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE report_imports
  ADD COLUMN package_sha256 TEXT,
  ADD COLUMN revision_number INTEGER,
  ADD COLUMN source_object_key TEXT,
  ADD COLUMN source_byte_size BIGINT,
  ADD COLUMN source_sha256 TEXT,
  ADD COLUMN source_media_type TEXT,
  ADD COLUMN source_storage_status TEXT NOT NULL DEFAULT 'legacy';

UPDATE report_imports
SET package_sha256 = encode(digest(convert_to(raw_package_json::text, 'UTF8'), 'sha256'), 'hex'),
  revision_number = 1
WHERE package_sha256 IS NULL OR revision_number IS NULL;

ALTER TABLE report_imports
  ALTER COLUMN package_sha256 SET NOT NULL,
  ALTER COLUMN revision_number SET NOT NULL;

ALTER TABLE report_imports
  DROP CONSTRAINT IF EXISTS report_imports_inspection_id_key;

CREATE UNIQUE INDEX idx_report_imports_inspection_package
  ON report_imports (inspection_id, package_sha256);

CREATE UNIQUE INDEX idx_report_imports_inspection_revision
  ON report_imports (inspection_id, revision_number);

CREATE INDEX idx_report_imports_scope_created
  ON report_imports (tenant_id, workspace_id, created_at_iso DESC);

ALTER TABLE report_imports
  ADD CONSTRAINT report_imports_source_storage_check
  CHECK (
    source_storage_status IN ('legacy', 'stored')
    AND (
      source_storage_status = 'legacy'
      OR (
        source_object_key IS NOT NULL
        AND source_byte_size IS NOT NULL
        AND source_sha256 IS NOT NULL
        AND source_media_type IS NOT NULL
      )
    )
  );

ALTER TABLE report_jobs
  DROP CONSTRAINT IF EXISTS report_jobs_inspection_id_key;

CREATE UNIQUE INDEX idx_report_jobs_import
  ON report_jobs (import_id);

CREATE INDEX idx_report_jobs_inspection_revision
  ON report_jobs (inspection_id, created_at_iso DESC);

ALTER TABLE report_object_upload_sessions
  ADD COLUMN source_export_package_json JSONB;

UPDATE report_object_upload_sessions
SET source_export_package_json = export_package_json
WHERE source_export_package_json IS NULL;

ALTER TABLE report_object_upload_sessions
  ALTER COLUMN source_export_package_json SET NOT NULL;
