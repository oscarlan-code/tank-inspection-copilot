CREATE TABLE kb_warning_reviews (
  warning_review_id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES kb_documents (document_id) ON DELETE CASCADE,
  ingestion_run_id TEXT NOT NULL REFERENCES kb_ingestion_runs (ingestion_run_id) ON DELETE CASCADE,
  issue_key TEXT NOT NULL,
  resolution_code TEXT NOT NULL CHECK (
    resolution_code IN ('accepted', 'not_applicable', 'needs_correction')
  ),
  issue_snapshot_json JSONB NOT NULL,
  reviewer_notes TEXT NOT NULL DEFAULT '',
  actor_user_id TEXT REFERENCES platform_users (user_id) ON DELETE SET NULL,
  reviewed_at_iso TIMESTAMPTZ NOT NULL,
  created_at_iso TIMESTAMPTZ NOT NULL,
  updated_at_iso TIMESTAMPTZ NOT NULL,
  UNIQUE (document_id, ingestion_run_id, issue_key)
);

CREATE INDEX idx_kb_warning_reviews_document_run
  ON kb_warning_reviews (document_id, ingestion_run_id, resolution_code, reviewed_at_iso DESC);

ALTER TABLE kb_review_decisions
  DROP CONSTRAINT IF EXISTS kb_review_decisions_action_code_check;

ALTER TABLE kb_review_decisions
  ADD CONSTRAINT kb_review_decisions_action_code_check CHECK (
    action_code IN (
      'metadata_saved',
      'section_classified',
      'warning_reviewed',
      'approved',
      'rejected',
      'quarantined',
      'reopened'
    )
  );
