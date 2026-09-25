CREATE TABLE report_capture_profile_versions (
  profile_version_id TEXT PRIMARY KEY,
  profile_code TEXT NOT NULL,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  lane_code TEXT NOT NULL CHECK (lane_code IN ('faithful_capture', 'fault_injection')),
  status_code TEXT NOT NULL CHECK (status_code IN ('active', 'retired')),
  config_json JSONB NOT NULL,
  created_at_iso TIMESTAMPTZ NOT NULL,
  retired_at_iso TIMESTAMPTZ,
  UNIQUE (profile_code, version_number)
);

CREATE UNIQUE INDEX idx_report_capture_profiles_active
  ON report_capture_profile_versions (profile_code)
  WHERE status_code = 'active';

CREATE TABLE report_capture_variants (
  variant_id TEXT PRIMARY KEY,
  training_case_id TEXT NOT NULL REFERENCES report_training_cases (training_case_id) ON DELETE RESTRICT,
  profile_version_id TEXT NOT NULL REFERENCES report_capture_profile_versions (profile_version_id) ON DELETE RESTRICT,
  variant_version INTEGER NOT NULL DEFAULT 1 CHECK (variant_version > 0),
  random_seed INTEGER NOT NULL CHECK (random_seed > 0),
  dataset_split TEXT NOT NULL CHECK (dataset_split IN ('training', 'validation', 'hidden_test')),
  lane_code TEXT NOT NULL CHECK (lane_code IN ('faithful_capture', 'fault_injection')),
  status_code TEXT NOT NULL CHECK (
    status_code IN (
      'review_required',
      'approved',
      'round_trip_ready',
      'materialized',
      'rejected',
      'failed',
      'quarantined'
    )
  ),
  manifest_json JSONB NOT NULL,
  included_fact_count INTEGER NOT NULL DEFAULT 0 CHECK (included_fact_count >= 0),
  withheld_fact_count INTEGER NOT NULL DEFAULT 0 CHECK (withheld_fact_count >= 0),
  transformed_fact_count INTEGER NOT NULL DEFAULT 0 CHECK (transformed_fact_count >= 0),
  expected_missing_inputs_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  scenario_object_key TEXT,
  scenario_sha256 TEXT,
  app_report_job_id TEXT REFERENCES report_jobs (report_job_id) ON DELETE SET NULL,
  app_source_object_key TEXT,
  app_source_sha256 TEXT,
  app_package_sha256 TEXT,
  validation_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id TEXT REFERENCES platform_users (user_id) ON DELETE SET NULL,
  approved_by_user_id TEXT REFERENCES platform_users (user_id) ON DELETE SET NULL,
  created_at_iso TIMESTAMPTZ NOT NULL,
  updated_at_iso TIMESTAMPTZ NOT NULL,
  approved_at_iso TIMESTAMPTZ,
  UNIQUE (training_case_id, profile_version_id, random_seed, variant_version),
  CHECK (jsonb_typeof(expected_missing_inputs_json) = 'array'),
  CHECK (
    status_code NOT IN ('approved', 'round_trip_ready', 'materialized')
    OR (
      scenario_object_key IS NOT NULL
      AND scenario_sha256 ~ '^[a-f0-9]{64}$'
      AND approved_at_iso IS NOT NULL
    )
  ),
  CHECK (
    status_code <> 'materialized'
    OR (
      app_report_job_id IS NOT NULL
      AND app_source_object_key IS NOT NULL
      AND app_source_sha256 ~ '^[a-f0-9]{64}$'
      AND app_package_sha256 ~ '^[a-f0-9]{64}$'
    )
  )
);

CREATE INDEX idx_report_capture_variants_case_status
  ON report_capture_variants (training_case_id, status_code, profile_version_id, random_seed);

CREATE TABLE report_capture_variant_fact_links (
  variant_id TEXT NOT NULL REFERENCES report_capture_variants (variant_id) ON DELETE CASCADE,
  training_case_id TEXT NOT NULL,
  fact_id TEXT NOT NULL,
  disposition_code TEXT NOT NULL CHECK (
    disposition_code IN ('included', 'withheld', 'transformed', 'repeated')
  ),
  capture_channel TEXT NOT NULL CHECK (
    capture_channel IN ('structured_field', 'measurement', 'voice', 'note', 'photo', 'none')
  ),
  transformation_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  stable_order INTEGER NOT NULL CHECK (stable_order >= 0),
  created_at_iso TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (variant_id, fact_id),
  FOREIGN KEY (training_case_id, fact_id)
    REFERENCES report_training_case_facts (training_case_id, fact_id)
    ON DELETE RESTRICT
);

CREATE INDEX idx_report_capture_variant_facts_disposition
  ON report_capture_variant_fact_links (variant_id, disposition_code, capture_channel, stable_order);

CREATE OR REPLACE FUNCTION validate_capture_variant_truth()
RETURNS TRIGGER AS $$
DECLARE
  case_status TEXT;
  case_split TEXT;
  profile_lane TEXT;
BEGIN
  SELECT status_code, dataset_split INTO case_status, case_split
  FROM report_training_cases
  WHERE training_case_id = NEW.training_case_id;

  IF case_status <> 'case_approved' THEN
    RAISE EXCEPTION 'Capture variants require an approved Truth Case %', NEW.training_case_id
      USING ERRCODE = 'check_violation';
  END IF;
  IF case_split <> NEW.dataset_split THEN
    RAISE EXCEPTION 'Capture variant split must match its Truth Case split'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT lane_code INTO profile_lane
  FROM report_capture_profile_versions
  WHERE profile_version_id = NEW.profile_version_id AND status_code = 'active';
  IF profile_lane IS NULL OR profile_lane <> NEW.lane_code THEN
    RAISE EXCEPTION 'Capture variant requires an active matching profile version'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER report_capture_variants_truth_guard
BEFORE INSERT OR UPDATE ON report_capture_variants
FOR EACH ROW EXECUTE FUNCTION validate_capture_variant_truth();

CREATE OR REPLACE FUNCTION guard_approved_capture_variant()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status_code IN ('approved', 'round_trip_ready', 'materialized') THEN
    RAISE EXCEPTION 'Approved Capture Variant % is immutable', OLD.variant_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER report_capture_variants_immutable_guard
BEFORE UPDATE OR DELETE ON report_capture_variants
FOR EACH ROW EXECUTE FUNCTION guard_approved_capture_variant();

CREATE OR REPLACE FUNCTION guard_capture_variant_fact_links()
RETURNS TRIGGER AS $$
DECLARE
  target_variant_id TEXT;
  variant_status TEXT;
BEGIN
  target_variant_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.variant_id ELSE NEW.variant_id END;
  SELECT status_code INTO variant_status
  FROM report_capture_variants
  WHERE variant_id = target_variant_id;
  IF variant_status IN ('approved', 'round_trip_ready', 'materialized') THEN
    RAISE EXCEPTION 'Capture Variant facts are immutable after approval'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER report_capture_variant_facts_immutable_guard
BEFORE INSERT OR UPDATE OR DELETE ON report_capture_variant_fact_links
FOR EACH ROW EXECUTE FUNCTION guard_capture_variant_fact_links();

INSERT INTO report_capture_profile_versions (
  profile_version_id, profile_code, version_number, display_name, description,
  lane_code, status_code, config_json, created_at_iso
) VALUES
  ('capture_profile_structured_complete_v1', 'structured_complete', 1, 'Structured Complete', 'High field completion with concise supporting notes.', 'faithful_capture', 'active', '{"structuredCompleteness":1.0,"voiceCompleteness":0.35,"photoCompleteness":0.75,"structuredPreference":1.0,"noteStyle":"concise","orderMode":"section","asrNoise":0.0,"repetitionRate":0.0}'::jsonb, '2026-08-11T00:00:00.000Z'),
  ('capture_profile_voice_heavy_v1', 'voice_heavy', 1, 'Voice Heavy', 'Minimal optional fields with detailed inspector voice observations.', 'faithful_capture', 'active', '{"structuredCompleteness":0.68,"voiceCompleteness":1.0,"photoCompleteness":0.7,"structuredPreference":0.55,"noteStyle":"detailed_voice","orderMode":"capture","asrNoise":0.02,"repetitionRate":0.08}'::jsonb, '2026-08-11T00:00:00.000Z'),
  ('capture_profile_terse_expert_v1', 'terse_expert', 1, 'Terse Expert', 'Technical shorthand and compact expert observations.', 'faithful_capture', 'active', '{"structuredCompleteness":0.9,"voiceCompleteness":0.72,"photoCompleteness":0.65,"structuredPreference":0.82,"noteStyle":"technical_shorthand","orderMode":"section","asrNoise":0.01,"repetitionRate":0.0}'::jsonb, '2026-08-11T00:00:00.000Z'),
  ('capture_profile_interrupted_partial_v1', 'interrupted_partial', 1, 'Interrupted Partial', 'Correlated noncritical omissions and explicit pending evidence.', 'faithful_capture', 'active', '{"structuredCompleteness":0.66,"voiceCompleteness":0.58,"photoCompleteness":0.45,"structuredPreference":0.72,"noteStyle":"interrupted","orderMode":"capture","asrNoise":0.03,"repetitionRate":0.0}'::jsonb, '2026-08-11T00:00:00.000Z'),
  ('capture_profile_disordered_capture_v1', 'disordered_capture', 1, 'Disordered Capture', 'Correct facts recorded in non-report order.', 'faithful_capture', 'active', '{"structuredCompleteness":0.88,"voiceCompleteness":0.82,"photoCompleteness":0.65,"structuredPreference":0.75,"noteStyle":"normal","orderMode":"deterministic_shuffle","asrNoise":0.01,"repetitionRate":0.03}'::jsonb, '2026-08-11T00:00:00.000Z'),
  ('capture_profile_noisy_transcript_v1', 'noisy_transcript', 1, 'Noisy Transcript', 'Noncritical punctuation and ASR noise in voice evidence.', 'faithful_capture', 'active', '{"structuredCompleteness":0.84,"voiceCompleteness":0.9,"photoCompleteness":0.6,"structuredPreference":0.7,"noteStyle":"spoken","orderMode":"capture","asrNoise":0.12,"repetitionRate":0.03}'::jsonb, '2026-08-11T00:00:00.000Z'),
  ('capture_profile_evidence_rich_v1', 'evidence_rich', 1, 'Evidence Rich', 'Dense photos and repeated corroborating observations.', 'faithful_capture', 'active', '{"structuredCompleteness":0.96,"voiceCompleteness":0.95,"photoCompleteness":1.0,"structuredPreference":0.8,"noteStyle":"detailed","orderMode":"section","asrNoise":0.0,"repetitionRate":0.24}'::jsonb, '2026-08-11T00:00:00.000Z'),
  ('capture_profile_minimal_compliant_v1', 'minimal_compliant', 1, 'Minimal Compliant', 'Minimum required capture with optional evidence withheld.', 'faithful_capture', 'active', '{"structuredCompleteness":0.62,"voiceCompleteness":0.52,"photoCompleteness":0.4,"structuredPreference":0.78,"noteStyle":"minimal","orderMode":"section","asrNoise":0.01,"repetitionRate":0.0}'::jsonb, '2026-08-11T00:00:00.000Z')
ON CONFLICT (profile_version_id) DO NOTHING;
