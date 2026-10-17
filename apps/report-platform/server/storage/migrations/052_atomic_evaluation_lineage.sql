CREATE TABLE report_agent_execution_configurations (
  configuration_id TEXT PRIMARY KEY,
  contract_version TEXT NOT NULL CHECK (contract_version = 'agent_execution_configuration_v1'),
  agent_role TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  release_id TEXT NOT NULL,
  release_manifest_sha256 TEXT NOT NULL CHECK (release_manifest_sha256 ~ '^[a-f0-9]{64}$'),
  model_mode TEXT NOT NULL CHECK (model_mode IN ('disabled', 'pinned')),
  model_provider TEXT,
  model_id TEXT,
  model_version TEXT,
  prompt_mode TEXT NOT NULL CHECK (prompt_mode IN ('disabled', 'pinned')),
  prompt_id TEXT,
  prompt_version TEXT,
  prompt_sha256 TEXT CHECK (prompt_sha256 IS NULL OR prompt_sha256 ~ '^[a-f0-9]{64}$'),
  configuration_json JSONB NOT NULL CHECK (jsonb_typeof(configuration_json) = 'object'),
  configuration_sha256 TEXT NOT NULL UNIQUE CHECK (configuration_sha256 ~ '^[a-f0-9]{64}$'),
  created_at_iso TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (model_mode = 'disabled' AND model_provider IS NULL AND model_id IS NULL AND model_version IS NULL)
    OR
    (model_mode = 'pinned' AND model_provider IS NOT NULL AND model_id IS NOT NULL AND model_version IS NOT NULL)
  ),
  CHECK (
    (prompt_mode = 'disabled' AND prompt_id IS NULL AND prompt_version IS NULL AND prompt_sha256 IS NULL)
    OR
    (prompt_mode = 'pinned' AND prompt_id IS NOT NULL AND prompt_version IS NOT NULL AND prompt_sha256 IS NOT NULL)
  )
);

CREATE TABLE report_atomic_evaluation_cases (
  atomic_case_id TEXT PRIMARY KEY,
  evaluation_case_id TEXT REFERENCES report_evaluation_cases(evaluation_case_id) ON DELETE CASCADE,
  lineage_id TEXT NOT NULL,
  dataset_split TEXT NOT NULL CHECK (dataset_split IN ('development', 'validation', 'hidden_test')),
  report_profile_id TEXT NOT NULL,
  section_id TEXT NOT NULL,
  contract_version TEXT NOT NULL CHECK (contract_version = 'atomic_report_evaluation_case_v1'),
  segmentation_policy TEXT NOT NULL CHECK (segmentation_policy = 'semantic_obligation_v1'),
  case_json JSONB NOT NULL CHECK (jsonb_typeof(case_json) = 'object'),
  case_sha256 TEXT NOT NULL UNIQUE CHECK (case_sha256 ~ '^[a-f0-9]{64}$'),
  created_at_iso TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_atomic_evaluation_case_split_section
  ON report_atomic_evaluation_cases(dataset_split, section_id, lineage_id);

CREATE TABLE report_atomic_evaluation_units (
  atomic_case_id TEXT NOT NULL REFERENCES report_atomic_evaluation_cases(atomic_case_id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL,
  unit_layer TEXT NOT NULL CHECK (unit_layer IN ('source', 'evidence', 'generated')),
  section_id TEXT NOT NULL,
  outline_block_id TEXT NOT NULL,
  semantic_unit_type TEXT NOT NULL CHECK (
    semantic_unit_type IN (
      'structured_field', 'measurement_set', 'observation', 'limitation',
      'recommendation', 'scope_item', 'deterministic_block',
      'format_obligation', 'cross_reference'
    )
  ),
  semantic_key TEXT NOT NULL,
  criticality TEXT NOT NULL CHECK (criticality IN ('critical', 'required', 'optional')),
  content_sha256 TEXT NOT NULL CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  unit_json JSONB NOT NULL CHECK (jsonb_typeof(unit_json) = 'object'),
  PRIMARY KEY (atomic_case_id, unit_id)
);

CREATE INDEX idx_atomic_evaluation_unit_layer
  ON report_atomic_evaluation_units(atomic_case_id, unit_layer, section_id);

CREATE TABLE report_atomic_evaluation_links (
  atomic_case_id TEXT NOT NULL REFERENCES report_atomic_evaluation_cases(atomic_case_id) ON DELETE CASCADE,
  link_id TEXT NOT NULL,
  link_stage TEXT NOT NULL CHECK (link_stage IN ('source_to_mock', 'mock_to_generation')),
  relation_code TEXT NOT NULL CHECK (
    relation_code IN (
      'preserves', 'splits', 'combines', 'excluded', 'supports',
      'partially_supports', 'contradicts', 'unused', 'unsupported_output'
    )
  ),
  verdict_code TEXT NOT NULL CHECK (verdict_code IN ('pass', 'fail', 'not_available', 'not_applicable')),
  from_unit_ids_json JSONB NOT NULL CHECK (jsonb_typeof(from_unit_ids_json) = 'array'),
  to_unit_ids_json JSONB NOT NULL CHECK (jsonb_typeof(to_unit_ids_json) = 'array'),
  grader_configuration_sha256 TEXT NOT NULL CHECK (grader_configuration_sha256 ~ '^[a-f0-9]{64}$'),
  link_json JSONB NOT NULL CHECK (jsonb_typeof(link_json) = 'object'),
  PRIMARY KEY (atomic_case_id, link_id)
);

CREATE TABLE report_atomic_evaluation_run_bindings (
  eval_run_id TEXT NOT NULL REFERENCES report_eval_runs(eval_run_id) ON DELETE CASCADE,
  atomic_case_id TEXT NOT NULL REFERENCES report_atomic_evaluation_cases(atomic_case_id) ON DELETE RESTRICT,
  agent_role TEXT NOT NULL,
  configuration_id TEXT NOT NULL REFERENCES report_agent_execution_configurations(configuration_id) ON DELETE RESTRICT,
  created_at_iso TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (eval_run_id, agent_role)
);

CREATE FUNCTION reject_atomic_evaluation_revision_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Agent configurations and atomic evaluation lineage are immutable';
END;
$$;

CREATE TRIGGER agent_execution_configuration_immutable
BEFORE UPDATE ON report_agent_execution_configurations
FOR EACH ROW EXECUTE FUNCTION reject_atomic_evaluation_revision_update();

CREATE TRIGGER atomic_evaluation_case_immutable
BEFORE UPDATE ON report_atomic_evaluation_cases
FOR EACH ROW EXECUTE FUNCTION reject_atomic_evaluation_revision_update();

CREATE TRIGGER atomic_evaluation_unit_immutable
BEFORE UPDATE ON report_atomic_evaluation_units
FOR EACH ROW EXECUTE FUNCTION reject_atomic_evaluation_revision_update();

CREATE TRIGGER atomic_evaluation_link_immutable
BEFORE UPDATE ON report_atomic_evaluation_links
FOR EACH ROW EXECUTE FUNCTION reject_atomic_evaluation_revision_update();

CREATE TRIGGER atomic_evaluation_run_binding_immutable
BEFORE UPDATE ON report_atomic_evaluation_run_bindings
FOR EACH ROW EXECUTE FUNCTION reject_atomic_evaluation_revision_update();
