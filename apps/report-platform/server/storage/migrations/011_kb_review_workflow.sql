ALTER TABLE kb_documents
  ADD COLUMN review_notes TEXT NOT NULL DEFAULT '',
  ADD COLUMN reviewed_by_user_id TEXT REFERENCES platform_users (user_id) ON DELETE SET NULL,
  ADD COLUMN reviewed_at_iso TIMESTAMPTZ,
  ADD COLUMN approved_by_user_id TEXT REFERENCES platform_users (user_id) ON DELETE SET NULL,
  ADD COLUMN approved_at_iso TIMESTAMPTZ;

ALTER TABLE kb_sections
  ADD COLUMN lane_code TEXT NOT NULL DEFAULT 'quarantine',
  ADD COLUMN include_in_retrieval BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN review_notes TEXT NOT NULL DEFAULT '',
  ADD COLUMN reviewed_by_user_id TEXT REFERENCES platform_users (user_id) ON DELETE SET NULL,
  ADD COLUMN reviewed_at_iso TIMESTAMPTZ;

ALTER TABLE kb_sections
  ADD CONSTRAINT kb_sections_lane_code_check CHECK (
    lane_code IN (
      'template_library',
      'wording_precedent',
      'historical_case_memory',
      'fact_recommendation',
      'standards_guidance',
      'specialist_evidence',
      'evaluation_gold',
      'quarantine'
    )
  ),
  ADD CONSTRAINT kb_sections_retrieval_review_check CHECK (
    NOT include_in_retrieval OR review_status IN ('reviewed', 'approved')
  );

CREATE TABLE kb_review_decisions (
  decision_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES kb_cases (case_id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES kb_documents (document_id) ON DELETE CASCADE,
  section_id TEXT REFERENCES kb_sections (section_id) ON DELETE CASCADE,
  actor_user_id TEXT REFERENCES platform_users (user_id) ON DELETE SET NULL,
  action_code TEXT NOT NULL CHECK (
    action_code IN (
      'metadata_saved',
      'section_classified',
      'approved',
      'rejected',
      'quarantined',
      'reopened'
    )
  ),
  previous_state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  next_state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT NOT NULL DEFAULT '',
  created_at_iso TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_kb_review_decisions_document
  ON kb_review_decisions (document_id, created_at_iso DESC);

CREATE INDEX idx_kb_sections_review_queue
  ON kb_sections (document_id, review_status, include_in_retrieval, stable_order);
