CREATE TABLE report_evaluation_cases (
  evaluation_case_id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants (tenant_id) ON DELETE CASCADE,
  workspace_id TEXT REFERENCES workspaces (workspace_id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  report_family TEXT NOT NULL,
  input_inspection_id TEXT NOT NULL,
  gold_document_id TEXT,
  gold_source_report_name TEXT NOT NULL,
  dataset_split TEXT NOT NULL CHECK (dataset_split IN ('training', 'validation', 'hidden_test')),
  label_status TEXT NOT NULL CHECK (label_status IN ('machine_proposed', 'human_reviewed', 'approved')),
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id TEXT REFERENCES platform_users (user_id) ON DELETE SET NULL,
  created_at_iso TIMESTAMPTZ NOT NULL,
  updated_at_iso TIMESTAMPTZ NOT NULL,
  UNIQUE (input_inspection_id, gold_source_report_name)
);

CREATE INDEX idx_report_evaluation_cases_scope
  ON report_evaluation_cases (tenant_id, workspace_id, dataset_split, label_status);

CREATE TABLE report_evaluation_case_sections (
  evaluation_case_id TEXT NOT NULL REFERENCES report_evaluation_cases (evaluation_case_id) ON DELETE CASCADE,
  section_id TEXT NOT NULL,
  gold_section_key TEXT NOT NULL,
  evaluation_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (evaluation_case_id, section_id)
);

CREATE TABLE report_evaluation_relevance_labels (
  evaluation_case_id TEXT NOT NULL,
  section_id TEXT NOT NULL,
  chunk_id TEXT NOT NULL,
  relevance_grade INTEGER NOT NULL CHECK (relevance_grade BETWEEN 0 AND 3),
  confidence DOUBLE PRECISION NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  label_source TEXT NOT NULL CHECK (label_source IN ('gold_section_weak_supervision', 'human', 'imported_qrels')),
  review_status TEXT NOT NULL CHECK (review_status IN ('machine_proposed', 'human_reviewed', 'approved')),
  reviewed_by_user_id TEXT REFERENCES platform_users (user_id) ON DELETE SET NULL,
  reviewed_at_iso TIMESTAMPTZ,
  rationale TEXT,
  created_at_iso TIMESTAMPTZ NOT NULL,
  updated_at_iso TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (evaluation_case_id, section_id, chunk_id),
  FOREIGN KEY (evaluation_case_id, section_id)
    REFERENCES report_evaluation_case_sections (evaluation_case_id, section_id)
    ON DELETE CASCADE
);

CREATE INDEX idx_report_eval_relevance_labels_section
  ON report_evaluation_relevance_labels (
    evaluation_case_id,
    section_id,
    review_status,
    relevance_grade DESC
  );

CREATE TABLE report_evaluation_required_fact_labels (
  evaluation_case_id TEXT NOT NULL,
  section_id TEXT NOT NULL,
  fact_key TEXT NOT NULL,
  source_class TEXT NOT NULL CHECK (source_class IN ('app_capture', 'report_side_input', 'gold_concept')),
  matcher_json JSONB NOT NULL,
  confidence DOUBLE PRECISION NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  review_status TEXT NOT NULL CHECK (review_status IN ('machine_proposed', 'human_reviewed', 'approved')),
  reviewed_by_user_id TEXT REFERENCES platform_users (user_id) ON DELETE SET NULL,
  reviewed_at_iso TIMESTAMPTZ,
  created_at_iso TIMESTAMPTZ NOT NULL,
  updated_at_iso TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (evaluation_case_id, section_id, fact_key),
  FOREIGN KEY (evaluation_case_id, section_id)
    REFERENCES report_evaluation_case_sections (evaluation_case_id, section_id)
    ON DELETE CASCADE
);

INSERT INTO report_evaluation_cases (
  evaluation_case_id,
  tenant_id,
  workspace_id,
  display_name,
  report_family,
  input_inspection_id,
  gold_document_id,
  gold_source_report_name,
  dataset_split,
  label_status,
  config_json,
  created_by_user_id,
  created_at_iso,
  updated_at_iso
) VALUES (
  'eval_case_v10_api653_internal_external_v1',
  NULL,
  NULL,
  'V10 API 653 internal and external inspection',
  'api_653_internal_external',
  'inspection-demo-api653-training-20220722',
  NULL,
  '22PE1-4 TK V10 Internal & External Inspection Report',
  'validation',
  'machine_proposed',
  '{"goldFirewall":true,"retrievalLabelMode":"gold_section_weak_supervision","literalGoldFactComparison":false}'::jsonb,
  NULL,
  '2026-08-04T00:00:00.000Z',
  '2026-08-04T00:00:00.000Z'
) ON CONFLICT (evaluation_case_id) DO NOTHING;

INSERT INTO report_evaluation_case_sections (
  evaluation_case_id,
  section_id,
  gold_section_key,
  evaluation_enabled,
  config_json
) VALUES
  ('eval_case_v10_api653_internal_external_v1', 'scope-of-inspection', 'scope-of-inspection', TRUE, '{}'::jsonb),
  ('eval_case_v10_api653_internal_external_v1', 'inspection-maintenance-regime', 'inspection-maintenance-regime', TRUE, '{}'::jsonb),
  ('eval_case_v10_api653_internal_external_v1', 'general-tank-information', 'general-tank-information', TRUE, '{}'::jsonb),
  ('eval_case_v10_api653_internal_external_v1', 'inspection-report', 'inspection-report', TRUE, '{}'::jsonb),
  ('eval_case_v10_api653_internal_external_v1', 'repair-recommendations', 'repair-recommendations', TRUE, '{}'::jsonb),
  ('eval_case_v10_api653_internal_external_v1', 'test-information', 'test-information', TRUE, '{}'::jsonb),
  ('eval_case_v10_api653_internal_external_v1', 'tank-inspection-checklist', 'tank-inspection-checklist', TRUE, '{}'::jsonb),
  ('eval_case_v10_api653_internal_external_v1', 'roof-plate-thickness-measurements', 'roof-plate-thickness-measurements', TRUE, '{}'::jsonb),
  ('eval_case_v10_api653_internal_external_v1', 'roof-plate-layout', 'roof-plate-layout', TRUE, '{}'::jsonb),
  ('eval_case_v10_api653_internal_external_v1', 'roof-nozzle-reinforcement-pad-thickness-measurements', 'roof-nozzle-reinforcement-pad-thickness-measurements', TRUE, '{}'::jsonb),
  ('eval_case_v10_api653_internal_external_v1', 'minimum-shell-thickness-calculations', 'minimum-shell-thickness-calculations', TRUE, '{}'::jsonb),
  ('eval_case_v10_api653_internal_external_v1', 'shell-plate-thickness-measurements', 'shell-plate-thickness-measurements', TRUE, '{}'::jsonb),
  ('eval_case_v10_api653_internal_external_v1', 'shell-plate-layout', 'shell-plate-layout', TRUE, '{}'::jsonb),
  ('eval_case_v10_api653_internal_external_v1', 'shell-external-additional-ndt-selected-areas', 'shell-external-additional-ndt-selected-areas', TRUE, '{}'::jsonb),
  ('eval_case_v10_api653_internal_external_v1', 'shell-external-area-1-ut-scanning-findings', 'shell-external-area-1-ut-scanning-findings', TRUE, '{}'::jsonb),
  ('eval_case_v10_api653_internal_external_v1', 'shell-external-area-2-ut-scanning-findings', 'shell-external-area-2-ut-scanning-findings', TRUE, '{}'::jsonb),
  ('eval_case_v10_api653_internal_external_v1', 'shell-external-area-3-ut-scanning-findings', 'shell-external-area-3-ut-scanning-findings', TRUE, '{}'::jsonb),
  ('eval_case_v10_api653_internal_external_v1', 'shell-external-area-4-ut-scanning-findings', 'shell-external-area-4-ut-scanning-findings', TRUE, '{}'::jsonb),
  ('eval_case_v10_api653_internal_external_v1', 'shell-external-area-5-ut-scanning-findings', 'shell-external-area-5-ut-scanning-findings', TRUE, '{}'::jsonb),
  ('eval_case_v10_api653_internal_external_v1', 'shell-external-mpi-selected-areas', 'shell-external-mpi-selected-areas', TRUE, '{}'::jsonb),
  ('eval_case_v10_api653_internal_external_v1', 'shell-internal-mpi-selected-areas', 'shell-internal-mpi-selected-areas', TRUE, '{}'::jsonb),
  ('eval_case_v10_api653_internal_external_v1', 'shell-internal-mpi-findings', 'shell-internal-mpi-findings', TRUE, '{}'::jsonb),
  ('eval_case_v10_api653_internal_external_v1', 'shell-internal-recommended-repairs', 'shell-internal-recommended-repairs', TRUE, '{}'::jsonb),
  ('eval_case_v10_api653_internal_external_v1', 'shell-nozzle-reinforcement-pad-thickness-measurements', 'shell-nozzle-reinforcement-pad-thickness-measurements', TRUE, '{}'::jsonb),
  ('eval_case_v10_api653_internal_external_v1', 'shell-settlement-survey-results-external', 'shell-settlement-survey-results-external', TRUE, '{}'::jsonb),
  ('eval_case_v10_api653_internal_external_v1', 'shell-settlement-survey-graphs', 'shell-settlement-survey-graphs', TRUE, '{}'::jsonb),
  ('eval_case_v10_api653_internal_external_v1', 'photographs', 'photographs', TRUE, '{}'::jsonb),
  ('eval_case_v10_api653_internal_external_v1', 'floor-plate-layout-platemaps-numbering-system', 'floor-plate-layout-platemaps-numbering-system', TRUE, '{}'::jsonb),
  ('eval_case_v10_api653_internal_external_v1', 'guidelines-interpretation-tru-flux-data-sheets', 'guidelines-interpretation-tru-flux-data-sheets', TRUE, '{}'::jsonb),
  ('eval_case_v10_api653_internal_external_v1', 'floor-plate-corrosion-plan', 'floor-plate-corrosion-plan', TRUE, '{}'::jsonb),
  ('eval_case_v10_api653_internal_external_v1', 'magnetic-flux-leakage-platemaps', 'magnetic-flux-leakage-platemaps', TRUE, '{}'::jsonb),
  ('eval_case_v10_api653_internal_external_v1', 'appendix-a-engineering-assessment-summary', 'appendix-a-engineering-assessment-summary', TRUE, '{}'::jsonb)
ON CONFLICT (evaluation_case_id, section_id) DO NOTHING;

UPDATE system_rl_policy_versions
SET config_json = config_json || '{
  "minimumHumanReviewedEpisodes": 12,
  "metricPromotionGates": {
    "retrievalPrecisionAtK": 0.50,
    "retrievalRecallAtK": 0.25,
    "claimPrecision": 0.90,
    "requiredFactRecall": 0.70
  }
}'::jsonb
WHERE policy_version_id = 'rl_policy_report_generation_v2_candidate';
