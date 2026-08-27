CREATE TABLE report_benchmark_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants (tenant_id) ON DELETE CASCADE,
  workspace_id TEXT REFERENCES workspaces (workspace_id) ON DELETE CASCADE,
  snapshot_name TEXT NOT NULL,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  status_code TEXT NOT NULL CHECK (
    status_code IN ('draft', 'review', 'locked', 'retired')
  ),
  manifest_object_key TEXT,
  manifest_sha256 TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id TEXT REFERENCES platform_users (user_id) ON DELETE SET NULL,
  locked_by_user_id TEXT REFERENCES platform_users (user_id) ON DELETE SET NULL,
  created_at_iso TIMESTAMPTZ NOT NULL,
  updated_at_iso TIMESTAMPTZ NOT NULL,
  locked_at_iso TIMESTAMPTZ,
  UNIQUE (snapshot_name, version_number),
  CHECK (
    status_code NOT IN ('locked', 'retired')
    OR (
      manifest_object_key IS NOT NULL
      AND manifest_sha256 ~ '^[a-f0-9]{64}$'
      AND locked_at_iso IS NOT NULL
    )
  )
);

CREATE INDEX idx_report_benchmark_snapshots_scope_status
  ON report_benchmark_snapshots (tenant_id, workspace_id, status_code, version_number DESC);

CREATE TABLE report_benchmark_documents (
  snapshot_id TEXT NOT NULL REFERENCES report_benchmark_snapshots (snapshot_id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES kb_documents (document_id) ON DELETE RESTRICT,
  benchmark_role TEXT NOT NULL CHECK (
    benchmark_role IN (
      'training_precedent',
      'training_gold',
      'validation_gold',
      'hidden_test_gold',
      'standards_guidance'
    )
  ),
  dataset_split TEXT NOT NULL CHECK (
    dataset_split IN ('training', 'validation', 'hidden_test', 'unassigned')
  ),
  source_case_id TEXT NOT NULL,
  source_rendition_id TEXT NOT NULL,
  source_sha256 TEXT NOT NULL CHECK (source_sha256 ~ '^[a-f0-9]{64}$'),
  source_object_key TEXT NOT NULL,
  evidence_issued_at TIMESTAMPTZ NOT NULL,
  asset_lineage_key TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at_iso TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (snapshot_id, document_id),
  CHECK (
    (benchmark_role IN ('training_precedent', 'training_gold') AND dataset_split = 'training')
    OR (benchmark_role = 'validation_gold' AND dataset_split = 'validation')
    OR (benchmark_role = 'hidden_test_gold' AND dataset_split = 'hidden_test')
    OR (benchmark_role = 'standards_guidance' AND dataset_split = 'unassigned')
  )
);

CREATE INDEX idx_report_benchmark_documents_retrieval
  ON report_benchmark_documents (
    snapshot_id,
    benchmark_role,
    dataset_split,
    evidence_issued_at
  );

CREATE INDEX idx_report_benchmark_documents_lineage
  ON report_benchmark_documents (snapshot_id, asset_lineage_key)
  WHERE asset_lineage_key IS NOT NULL;

CREATE TABLE report_training_cases (
  training_case_id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL,
  gold_document_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  report_family TEXT NOT NULL,
  dataset_split TEXT NOT NULL CHECK (
    dataset_split IN ('training', 'validation', 'hidden_test')
  ),
  benchmark_track TEXT NOT NULL CHECK (
    benchmark_track IN ('operational_history', 'asset_generalization')
  ),
  evidence_as_of TIMESTAMPTZ NOT NULL,
  asset_lineage_key TEXT,
  status_code TEXT NOT NULL CHECK (
    status_code IN (
      'source_approved',
      'truth_extracting',
      'truth_review_required',
      'case_approved',
      'retired',
      'quarantined'
    )
  ),
  truth_graph_version INTEGER NOT NULL DEFAULT 1 CHECK (truth_graph_version > 0),
  truth_graph_object_key TEXT,
  truth_graph_sha256 TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id TEXT REFERENCES platform_users (user_id) ON DELETE SET NULL,
  approved_by_user_id TEXT REFERENCES platform_users (user_id) ON DELETE SET NULL,
  created_at_iso TIMESTAMPTZ NOT NULL,
  updated_at_iso TIMESTAMPTZ NOT NULL,
  approved_at_iso TIMESTAMPTZ,
  FOREIGN KEY (snapshot_id, gold_document_id)
    REFERENCES report_benchmark_documents (snapshot_id, document_id)
    ON DELETE RESTRICT,
  UNIQUE (snapshot_id, gold_document_id, benchmark_track),
  CHECK (benchmark_track <> 'asset_generalization' OR asset_lineage_key IS NOT NULL),
  CHECK (
    status_code <> 'case_approved'
    OR (
      truth_graph_object_key IS NOT NULL
      AND truth_graph_sha256 ~ '^[a-f0-9]{64}$'
      AND approved_at_iso IS NOT NULL
    )
  )
);

CREATE INDEX idx_report_training_cases_snapshot_status
  ON report_training_cases (snapshot_id, dataset_split, status_code, updated_at_iso DESC);

CREATE TABLE report_training_case_sources (
  training_case_id TEXT NOT NULL REFERENCES report_training_cases (training_case_id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES kb_documents (document_id) ON DELETE RESTRICT,
  source_role TEXT NOT NULL CHECK (
    source_role IN ('gold_primary', 'gold_rendition', 'supporting_evidence', 'standards_reference')
  ),
  source_sha256 TEXT NOT NULL CHECK (source_sha256 ~ '^[a-f0-9]{64}$'),
  source_object_key TEXT NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at_iso TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (training_case_id, document_id)
);

CREATE TABLE report_training_case_facts (
  fact_id TEXT PRIMARY KEY,
  training_case_id TEXT NOT NULL REFERENCES report_training_cases (training_case_id) ON DELETE CASCADE,
  fact_type TEXT NOT NULL,
  section_key TEXT NOT NULL,
  normalized_value_json JSONB NOT NULL,
  unit_code TEXT,
  source_document_id TEXT NOT NULL,
  source_page_number INTEGER CHECK (source_page_number IS NULL OR source_page_number > 0),
  source_block_ids_json JSONB NOT NULL,
  source_bbox_json JSONB,
  source_confidence DOUBLE PRECISION NOT NULL CHECK (source_confidence BETWEEN 0 AND 1),
  evidence_class TEXT NOT NULL CHECK (
    evidence_class IN (
      'structured_field',
      'measurement',
      'finding',
      'voice_or_note',
      'photo_or_attachment',
      'layout_geometry',
      'report_narrative',
      'standard_rule'
    )
  ),
  capture_destination TEXT,
  safety_criticality TEXT NOT NULL CHECK (
    safety_criticality IN ('low', 'medium', 'high', 'critical')
  ),
  review_status TEXT NOT NULL CHECK (
    review_status IN ('machine_proposed', 'human_reviewed', 'approved', 'rejected')
  ),
  proposed_by_user_id TEXT REFERENCES platform_users (user_id) ON DELETE SET NULL,
  reviewed_by_user_id TEXT REFERENCES platform_users (user_id) ON DELETE SET NULL,
  reviewed_at_iso TIMESTAMPTZ,
  created_at_iso TIMESTAMPTZ NOT NULL,
  updated_at_iso TIMESTAMPTZ NOT NULL,
  UNIQUE (training_case_id, fact_id),
  FOREIGN KEY (training_case_id, source_document_id)
    REFERENCES report_training_case_sources (training_case_id, document_id)
    ON DELETE RESTRICT,
  CHECK (jsonb_typeof(source_block_ids_json) = 'array'),
  CHECK (jsonb_array_length(source_block_ids_json) > 0),
  CHECK (
    review_status NOT IN ('human_reviewed', 'approved')
    OR (reviewed_by_user_id IS NOT NULL AND reviewed_at_iso IS NOT NULL)
  )
);

CREATE INDEX idx_report_training_case_facts_section_review
  ON report_training_case_facts (training_case_id, section_key, review_status);

CREATE TABLE report_training_case_answerability (
  fact_id TEXT PRIMARY KEY REFERENCES report_training_case_facts (fact_id) ON DELETE CASCADE,
  training_case_id TEXT NOT NULL,
  answerability_class TEXT NOT NULL CHECK (
    answerability_class IN (
      'app_observable',
      'voice_observable',
      'report_side_input',
      'deterministic_derived',
      'precedent_template',
      'standards_guidance',
      'engineering_judgment',
      'gold_only_unobservable'
    )
  ),
  required_fact BOOLEAN NOT NULL DEFAULT FALSE,
  expected_generator_behavior TEXT NOT NULL,
  review_status TEXT NOT NULL CHECK (
    review_status IN ('machine_proposed', 'human_reviewed', 'approved', 'rejected')
  ),
  reviewed_by_user_id TEXT REFERENCES platform_users (user_id) ON DELETE SET NULL,
  reviewed_at_iso TIMESTAMPTZ,
  updated_at_iso TIMESTAMPTZ NOT NULL,
  FOREIGN KEY (training_case_id, fact_id)
    REFERENCES report_training_case_facts (training_case_id, fact_id)
    ON DELETE CASCADE,
  CHECK (
    answerability_class <> 'gold_only_unobservable'
    OR required_fact = FALSE
  ),
  CHECK (
    review_status NOT IN ('human_reviewed', 'approved')
    OR (reviewed_by_user_id IS NOT NULL AND reviewed_at_iso IS NOT NULL)
  )
);

CREATE INDEX idx_report_training_answerability_case_class
  ON report_training_case_answerability (
    training_case_id,
    answerability_class,
    required_fact
  );

CREATE OR REPLACE FUNCTION guard_locked_benchmark_children()
RETURNS TRIGGER AS $$
DECLARE
  target_snapshot_id TEXT;
  snapshot_status TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_snapshot_id := OLD.snapshot_id;
  ELSE
    target_snapshot_id := NEW.snapshot_id;
  END IF;
  SELECT status_code INTO snapshot_status
  FROM report_benchmark_snapshots
  WHERE snapshot_id = target_snapshot_id;

  IF snapshot_status IN ('locked', 'retired') THEN
    RAISE EXCEPTION 'Benchmark snapshot % is immutable while status is %',
      target_snapshot_id, snapshot_status
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER report_benchmark_documents_immutable_guard
BEFORE INSERT OR UPDATE OR DELETE ON report_benchmark_documents
FOR EACH ROW EXECUTE FUNCTION guard_locked_benchmark_children();

CREATE TRIGGER report_training_cases_immutable_guard
BEFORE INSERT OR UPDATE OR DELETE ON report_training_cases
FOR EACH ROW EXECUTE FUNCTION guard_locked_benchmark_children();

CREATE OR REPLACE FUNCTION guard_locked_training_case_children()
RETURNS TRIGGER AS $$
DECLARE
  target_training_case_id TEXT;
  snapshot_status TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_training_case_id := OLD.training_case_id;
  ELSE
    target_training_case_id := NEW.training_case_id;
  END IF;

  SELECT snapshots.status_code INTO snapshot_status
  FROM report_training_cases cases
  JOIN report_benchmark_snapshots snapshots
    ON snapshots.snapshot_id = cases.snapshot_id
  WHERE cases.training_case_id = target_training_case_id;

  IF snapshot_status IN ('locked', 'retired') THEN
    RAISE EXCEPTION 'Training case % is immutable because its benchmark snapshot is %',
      target_training_case_id, snapshot_status
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER report_training_case_sources_immutable_guard
BEFORE INSERT OR UPDATE OR DELETE ON report_training_case_sources
FOR EACH ROW EXECUTE FUNCTION guard_locked_training_case_children();

CREATE TRIGGER report_training_case_facts_immutable_guard
BEFORE INSERT OR UPDATE OR DELETE ON report_training_case_facts
FOR EACH ROW EXECUTE FUNCTION guard_locked_training_case_children();

CREATE TRIGGER report_training_case_answerability_immutable_guard
BEFORE INSERT OR UPDATE OR DELETE ON report_training_case_answerability
FOR EACH ROW EXECUTE FUNCTION guard_locked_training_case_children();

CREATE OR REPLACE FUNCTION guard_locked_benchmark_snapshot()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.status_code IN ('locked', 'retired') THEN
    RAISE EXCEPTION 'Locked benchmark snapshot % cannot be deleted', OLD.snapshot_id
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status_code IN ('locked', 'retired') THEN
    IF NOT (
      OLD.status_code = 'locked'
      AND NEW.status_code = 'retired'
      AND NEW.snapshot_id IS NOT DISTINCT FROM OLD.snapshot_id
      AND NEW.tenant_id IS NOT DISTINCT FROM OLD.tenant_id
      AND NEW.workspace_id IS NOT DISTINCT FROM OLD.workspace_id
      AND NEW.snapshot_name IS NOT DISTINCT FROM OLD.snapshot_name
      AND NEW.version_number IS NOT DISTINCT FROM OLD.version_number
      AND NEW.manifest_object_key IS NOT DISTINCT FROM OLD.manifest_object_key
      AND NEW.manifest_sha256 IS NOT DISTINCT FROM OLD.manifest_sha256
      AND NEW.metadata_json IS NOT DISTINCT FROM OLD.metadata_json
      AND NEW.created_by_user_id IS NOT DISTINCT FROM OLD.created_by_user_id
      AND NEW.locked_by_user_id IS NOT DISTINCT FROM OLD.locked_by_user_id
      AND NEW.created_at_iso IS NOT DISTINCT FROM OLD.created_at_iso
      AND NEW.locked_at_iso IS NOT DISTINCT FROM OLD.locked_at_iso
    ) THEN
      RAISE EXCEPTION 'Locked benchmark snapshot % is immutable', OLD.snapshot_id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER report_benchmark_snapshots_immutable_guard
BEFORE UPDATE OR DELETE ON report_benchmark_snapshots
FOR EACH ROW EXECUTE FUNCTION guard_locked_benchmark_snapshot();

CREATE OR REPLACE FUNCTION validate_training_case_gold_role()
RETURNS TRIGGER AS $$
DECLARE
  gold_role TEXT;
  gold_split TEXT;
BEGIN
  SELECT benchmark_role, dataset_split
  INTO gold_role, gold_split
  FROM report_benchmark_documents
  WHERE snapshot_id = NEW.snapshot_id
    AND document_id = NEW.gold_document_id;

  IF gold_role NOT IN ('training_gold', 'validation_gold', 'hidden_test_gold') THEN
    RAISE EXCEPTION 'Training case gold document must have a gold benchmark role'
      USING ERRCODE = 'check_violation';
  END IF;

  IF gold_split IS DISTINCT FROM NEW.dataset_split THEN
    RAISE EXCEPTION 'Training case split % does not match gold document split %',
      NEW.dataset_split, gold_split
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER report_training_cases_gold_role_guard
BEFORE INSERT OR UPDATE OF snapshot_id, gold_document_id, dataset_split
ON report_training_cases
FOR EACH ROW EXECUTE FUNCTION validate_training_case_gold_role();
