CREATE OR REPLACE FUNCTION guard_approved_capture_variant()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.status_code IN ('approved', 'round_trip_ready', 'materialized') THEN
    RAISE EXCEPTION 'Approved Capture Variant % is immutable', OLD.variant_id
      USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status_code IN ('approved', 'round_trip_ready', 'materialized') THEN
    IF NEW.variant_id IS DISTINCT FROM OLD.variant_id
      OR NEW.training_case_id IS DISTINCT FROM OLD.training_case_id
      OR NEW.profile_version_id IS DISTINCT FROM OLD.profile_version_id
      OR NEW.variant_version IS DISTINCT FROM OLD.variant_version
      OR NEW.random_seed IS DISTINCT FROM OLD.random_seed
      OR NEW.dataset_split IS DISTINCT FROM OLD.dataset_split
      OR NEW.lane_code IS DISTINCT FROM OLD.lane_code
      OR NEW.manifest_json IS DISTINCT FROM OLD.manifest_json
      OR NEW.included_fact_count IS DISTINCT FROM OLD.included_fact_count
      OR NEW.withheld_fact_count IS DISTINCT FROM OLD.withheld_fact_count
      OR NEW.transformed_fact_count IS DISTINCT FROM OLD.transformed_fact_count
      OR NEW.expected_missing_inputs_json IS DISTINCT FROM OLD.expected_missing_inputs_json
      OR NEW.scenario_object_key IS DISTINCT FROM OLD.scenario_object_key
      OR NEW.scenario_sha256 IS DISTINCT FROM OLD.scenario_sha256
      OR NEW.created_by_user_id IS DISTINCT FROM OLD.created_by_user_id
      OR NEW.approved_by_user_id IS DISTINCT FROM OLD.approved_by_user_id
      OR NEW.created_at_iso IS DISTINCT FROM OLD.created_at_iso
      OR NEW.approved_at_iso IS DISTINCT FROM OLD.approved_at_iso
    THEN
      RAISE EXCEPTION 'Approved Capture Variant % truth and scenario are immutable', OLD.variant_id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;
