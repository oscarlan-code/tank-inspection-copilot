CREATE TABLE canonical_report_review_decisions (
  group_key TEXT PRIMARY KEY,
  selected_asset_id TEXT NOT NULL,
  selected_relative_path TEXT NOT NULL,
  report_family TEXT NOT NULL,
  dataset_split TEXT NOT NULL CHECK (dataset_split IN ('training', 'validation', 'hidden_test', 'unassigned')),
  asset_lineage_key TEXT,
  status_code TEXT NOT NULL CHECK (status_code IN ('pending_review', 'approved_for_ingestion', 'quarantined')),
  review_notes TEXT NOT NULL DEFAULT '',
  reviewed_by_user_id TEXT REFERENCES platform_users(user_id) ON DELETE SET NULL,
  reviewed_at_iso TIMESTAMPTZ NOT NULL,
  updated_at_iso TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_canonical_report_review_status
  ON canonical_report_review_decisions (status_code, updated_at_iso DESC);
