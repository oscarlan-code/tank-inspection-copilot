CREATE TABLE report_governed_validation_cohorts (
  cohort_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  dataset_split TEXT NOT NULL CHECK (dataset_split IN ('training','validation')),
  source_policy_version_id TEXT NOT NULL REFERENCES system_rl_policy_versions(policy_version_id) ON DELETE RESTRICT,
  created_at_iso TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE report_governed_validation_cohort_items (
  cohort_id TEXT NOT NULL REFERENCES report_governed_validation_cohorts(cohort_id) ON DELETE RESTRICT,
  stable_order INTEGER NOT NULL CHECK (stable_order > 0),
  corpus_report_id TEXT NOT NULL REFERENCES report_corpus_registry(corpus_report_id) ON DELETE RESTRICT,
  section_key TEXT NOT NULL,
  PRIMARY KEY (cohort_id, stable_order),
  UNIQUE (cohort_id, corpus_report_id, section_key)
);

CREATE INDEX idx_governed_validation_cohort_lookup
  ON report_governed_validation_cohort_items (cohort_id, corpus_report_id, section_key);
