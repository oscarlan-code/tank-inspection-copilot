ALTER TABLE report_baseline_capture_variations
  ADD COLUMN app_export_object_key TEXT,
  ADD COLUMN app_export_sha256 TEXT CHECK (app_export_sha256 IS NULL OR app_export_sha256 ~ '^[a-f0-9]{64}$'),
  ADD COLUMN round_trip_completed_at_iso TIMESTAMPTZ;

CREATE INDEX idx_baseline_capture_variations_round_trip
  ON report_baseline_capture_variations (cohort_id, status_code, match_group_number);

ALTER TABLE report_baseline_capture_variations
  ADD CONSTRAINT baseline_variation_materialized_contract CHECK (
    status_code <> 'materialized'
    OR (
      app_report_job_id IS NOT NULL
      AND app_export_object_key IS NOT NULL
      AND app_export_sha256 IS NOT NULL
      AND round_trip_completed_at_iso IS NOT NULL
    )
  );
