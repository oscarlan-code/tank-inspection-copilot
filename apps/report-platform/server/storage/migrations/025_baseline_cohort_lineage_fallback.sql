CREATE OR REPLACE FUNCTION validate_baseline_pilot_cohort_member()
RETURNS TRIGGER AS $$
DECLARE
  pair_split TEXT;
  pair_status TEXT;
  pair_family TEXT;
  pair_section TEXT;
  pair_lineage TEXT;
BEGIN
  SELECT p.dataset_split,p.status_code,c.report_family,p.section_key,
    COALESCE(c.asset_lineage_key,c.gold_document_id,c.training_case_id)
    INTO pair_split,pair_status,pair_family,pair_section,pair_lineage
  FROM report_baseline_gold_pairs p
  JOIN report_training_cases c ON c.training_case_id=p.training_case_id
  WHERE p.baseline_pair_id=NEW.baseline_pair_id;
  IF pair_status <> 'ready' OR pair_split IS DISTINCT FROM NEW.dataset_split THEN
    RAISE EXCEPTION 'Pilot cohort members require a ready baseline from the declared split'
      USING ERRCODE='check_violation';
  END IF;
  IF pair_family IS DISTINCT FROM NEW.report_family
     OR pair_section IS DISTINCT FROM NEW.section_key
     OR pair_lineage IS DISTINCT FROM NEW.asset_lineage_key THEN
    RAISE EXCEPTION 'Pilot cohort member metadata must match its baseline lineage'
      USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
