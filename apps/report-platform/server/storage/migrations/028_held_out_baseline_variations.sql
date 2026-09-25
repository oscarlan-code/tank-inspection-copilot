ALTER TABLE report_baseline_capture_variations
  DROP CONSTRAINT report_baseline_capture_variations_dataset_split_check;

ALTER TABLE report_baseline_capture_variations
  ADD CONSTRAINT report_baseline_capture_variations_dataset_split_check
  CHECK (dataset_split IN ('training','validation','hidden_test'));

CREATE OR REPLACE FUNCTION validate_baseline_capture_variation()
RETURNS TRIGGER AS $$
DECLARE
  baseline_split TEXT;
  baseline_status TEXT;
  cohort_member_count INTEGER;
BEGIN
  SELECT dataset_split,status_code INTO baseline_split,baseline_status
  FROM report_baseline_gold_pairs WHERE baseline_pair_id=NEW.baseline_pair_id;
  IF baseline_status <> 'ready' OR NEW.dataset_split IS DISTINCT FROM baseline_split THEN
    RAISE EXCEPTION 'Capture variations require a ready baseline pair from the declared split'
      USING ERRCODE='check_violation';
  END IF;
  IF NEW.cohort_id IS NOT NULL THEN
    SELECT COUNT(*)::int INTO cohort_member_count
    FROM report_baseline_pilot_cohort_members
    WHERE cohort_id=NEW.cohort_id AND match_group_number=NEW.match_group_number
      AND dataset_split=NEW.dataset_split AND baseline_pair_id=NEW.baseline_pair_id;
    IF cohort_member_count <> 1 THEN
      RAISE EXCEPTION 'Capture variation baseline must match its declared cohort member'
        USING ERRCODE='check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
