CREATE TABLE report_baseline_pilot_cohorts (
  cohort_id TEXT PRIMARY KEY,
  cohort_version INTEGER NOT NULL CHECK (cohort_version > 0),
  deterministic_seed INTEGER NOT NULL CHECK (deterministic_seed > 0),
  target_group_count INTEGER NOT NULL CHECK (target_group_count > 0),
  status_code TEXT NOT NULL CHECK (status_code IN ('active', 'superseded')),
  matching_contract_json JSONB NOT NULL,
  created_at_iso TIMESTAMPTZ NOT NULL,
  updated_at_iso TIMESTAMPTZ NOT NULL,
  CHECK (jsonb_typeof(matching_contract_json) = 'object')
);

CREATE TABLE report_baseline_pilot_cohort_members (
  cohort_id TEXT NOT NULL REFERENCES report_baseline_pilot_cohorts (cohort_id) ON DELETE RESTRICT,
  match_group_number INTEGER NOT NULL CHECK (match_group_number > 0),
  dataset_split TEXT NOT NULL CHECK (dataset_split IN ('training', 'validation', 'hidden_test')),
  baseline_pair_id TEXT NOT NULL REFERENCES report_baseline_gold_pairs (baseline_pair_id) ON DELETE RESTRICT,
  report_family TEXT NOT NULL,
  section_key TEXT NOT NULL,
  asset_lineage_key TEXT NOT NULL,
  feature_json JSONB NOT NULL,
  match_distance DOUBLE PRECISION NOT NULL CHECK (match_distance >= 0),
  created_at_iso TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (cohort_id, match_group_number, dataset_split),
  UNIQUE (cohort_id, dataset_split, baseline_pair_id),
  CHECK (jsonb_typeof(feature_json) = 'object')
);

CREATE INDEX idx_baseline_pilot_cohort_members_split
  ON report_baseline_pilot_cohort_members (cohort_id, dataset_split, report_family, section_key);

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

CREATE TRIGGER baseline_pilot_cohort_member_guard
BEFORE INSERT OR UPDATE ON report_baseline_pilot_cohort_members
FOR EACH ROW EXECUTE FUNCTION validate_baseline_pilot_cohort_member();
