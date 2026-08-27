CREATE TABLE report_baseline_capture_variations (
  variation_id TEXT PRIMARY KEY,
  baseline_pair_id TEXT NOT NULL REFERENCES report_baseline_gold_pairs (baseline_pair_id) ON DELETE RESTRICT,
  profile_version_id TEXT NOT NULL REFERENCES report_capture_profile_versions (profile_version_id) ON DELETE RESTRICT,
  deterministic_seed INTEGER NOT NULL CHECK (deterministic_seed > 0),
  dataset_split TEXT NOT NULL CHECK (dataset_split = 'training'),
  status_code TEXT NOT NULL CHECK (status_code IN ('scenario_ready', 'round_trip_ready', 'materialized', 'quarantined')),
  manifest_json JSONB NOT NULL,
  validation_json JSONB NOT NULL,
  included_fact_count INTEGER NOT NULL CHECK (included_fact_count >= 0),
  withheld_fact_count INTEGER NOT NULL CHECK (withheld_fact_count >= 0),
  scenario_object_key TEXT,
  scenario_sha256 TEXT CHECK (scenario_sha256 IS NULL OR scenario_sha256 ~ '^[a-f0-9]{64}$'),
  app_report_job_id TEXT REFERENCES report_jobs (report_job_id) ON DELETE SET NULL,
  created_at_iso TIMESTAMPTZ NOT NULL,
  updated_at_iso TIMESTAMPTZ NOT NULL,
  UNIQUE (baseline_pair_id, profile_version_id, deterministic_seed),
  CHECK (jsonb_typeof(manifest_json) = 'object'),
  CHECK (jsonb_typeof(validation_json) = 'object'),
  CHECK (
    status_code = 'quarantined'
    OR (scenario_object_key IS NOT NULL AND scenario_sha256 IS NOT NULL)
  )
);

CREATE INDEX idx_baseline_capture_variations_status
  ON report_baseline_capture_variations (dataset_split, status_code, profile_version_id);

CREATE OR REPLACE FUNCTION validate_baseline_capture_variation()
RETURNS TRIGGER AS $$
DECLARE
  baseline_split TEXT;
  baseline_status TEXT;
BEGIN
  SELECT dataset_split,status_code INTO baseline_split,baseline_status
  FROM report_baseline_gold_pairs WHERE baseline_pair_id=NEW.baseline_pair_id;
  IF baseline_split <> 'training' OR baseline_status <> 'ready' OR NEW.dataset_split <> baseline_split THEN
    RAISE EXCEPTION 'Capture variations require a ready training baseline pair'
      USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER baseline_capture_variation_guard
BEFORE INSERT OR UPDATE ON report_baseline_capture_variations
FOR EACH ROW EXECUTE FUNCTION validate_baseline_capture_variation();
