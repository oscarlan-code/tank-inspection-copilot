DELETE FROM report_evaluation_cases
WHERE evaluation_case_id = 'eval_case_v10_api653_internal_external_v1'
  AND gold_document_id IS NULL
  AND created_by_user_id IS NULL;

ALTER TABLE report_evaluation_cases
  ADD CONSTRAINT report_evaluation_cases_gold_document_fk
  FOREIGN KEY (gold_document_id)
  REFERENCES kb_documents (document_id)
  ON DELETE CASCADE;

ALTER TABLE report_eval_runs
  ADD COLUMN evaluation_case_id TEXT
  REFERENCES report_evaluation_cases (evaluation_case_id)
  ON DELETE CASCADE;

CREATE INDEX idx_report_eval_runs_evaluation_case_created
  ON report_eval_runs (evaluation_case_id, created_at_iso DESC)
  WHERE evaluation_case_id IS NOT NULL;
