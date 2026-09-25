ALTER TABLE report_baseline_capture_variations
  ADD COLUMN cohort_id TEXT REFERENCES report_baseline_pilot_cohorts (cohort_id) ON DELETE RESTRICT,
  ADD COLUMN match_group_number INTEGER CHECK (match_group_number IS NULL OR match_group_number > 0);

CREATE INDEX idx_baseline_capture_variations_cohort
  ON report_baseline_capture_variations (cohort_id, match_group_number, profile_version_id);

CREATE OR REPLACE FUNCTION validate_baseline_capture_variation()
RETURNS TRIGGER AS $$
DECLARE
  baseline_split TEXT;
  baseline_status TEXT;
  cohort_member_count INTEGER;
BEGIN
  SELECT dataset_split,status_code INTO baseline_split,baseline_status
  FROM report_baseline_gold_pairs WHERE baseline_pair_id=NEW.baseline_pair_id;
  IF baseline_split <> 'training' OR baseline_status <> 'ready' OR NEW.dataset_split <> baseline_split THEN
    RAISE EXCEPTION 'Capture variations require a ready training baseline pair'
      USING ERRCODE='check_violation';
  END IF;
  IF NEW.cohort_id IS NOT NULL THEN
    SELECT COUNT(*)::int INTO cohort_member_count
    FROM report_baseline_pilot_cohort_members
    WHERE cohort_id=NEW.cohort_id AND match_group_number=NEW.match_group_number
      AND dataset_split='training' AND baseline_pair_id=NEW.baseline_pair_id;
    IF cohort_member_count <> 1 THEN
      RAISE EXCEPTION 'Capture variation baseline must be the training member of its matched cohort group'
        USING ERRCODE='check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
