-- Derived planning artifacts never overwrite the imported package or old drafts.
CREATE TABLE report_section_plan_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  report_job_id TEXT NOT NULL REFERENCES report_jobs(report_job_id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id),
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id),
  import_id TEXT NOT NULL REFERENCES report_imports(import_id),
  manual_inputs_revision INTEGER NOT NULL,
  contract_version TEXT NOT NULL,
  input_package_hash TEXT NOT NULL,
  snapshot_json JSONB NOT NULL,
  created_at_iso TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX report_section_plan_snapshot_job ON report_section_plan_snapshots(report_job_id,created_at_iso DESC);
CREATE TABLE report_section_classification_decisions (
  decision_id TEXT PRIMARY KEY,
  report_job_id TEXT NOT NULL REFERENCES report_jobs(report_job_id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id),
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id),
  import_id TEXT NOT NULL REFERENCES report_imports(import_id),
  actor_user_id TEXT NOT NULL REFERENCES platform_users(user_id),
  evidence_id TEXT NOT NULL,
  decision_json JSONB NOT NULL,
  created_at_iso TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX report_section_decision_job ON report_section_classification_decisions(report_job_id,import_id,created_at_iso);
CREATE TABLE report_section_planning_jobs (
  job_id TEXT PRIMARY KEY,
  report_job_id TEXT NOT NULL REFERENCES report_jobs(report_job_id) ON DELETE CASCADE,
  import_id TEXT NOT NULL REFERENCES report_imports(import_id),
  status_code TEXT NOT NULL CHECK(status_code IN ('queued','running','completed','failed')),
  snapshot_id TEXT REFERENCES report_section_plan_snapshots(snapshot_id),
  error_message TEXT,
  created_at_iso TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at_iso TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE report_jobs ADD COLUMN section_plan_snapshot_id TEXT REFERENCES report_section_plan_snapshots(snapshot_id) ON DELETE SET NULL;
ALTER TABLE report_section_drafts ADD COLUMN section_plan_snapshot_id TEXT REFERENCES report_section_plan_snapshots(snapshot_id) ON DELETE SET NULL;
ALTER TABLE report_section_drafts ADD COLUMN report_document_json JSONB;
CREATE TABLE report_section_document_snapshots (
  document_id TEXT PRIMARY KEY,
  report_job_id TEXT NOT NULL REFERENCES report_jobs(report_job_id) ON DELETE CASCADE,
  section_id TEXT NOT NULL,
  draft_version INTEGER NOT NULL,
  plan_snapshot_id TEXT REFERENCES report_section_plan_snapshots(snapshot_id),
  document_json JSONB NOT NULL,
  created_at_iso TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Revisions may be deleted with their owning report, but never rewritten.
CREATE FUNCTION reject_report_planning_revision_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Report planning and document revisions are immutable';
END;
$$;
CREATE TRIGGER report_plan_snapshot_immutable BEFORE UPDATE ON report_section_plan_snapshots
FOR EACH ROW EXECUTE FUNCTION reject_report_planning_revision_update();
CREATE TRIGGER report_classification_decision_immutable BEFORE UPDATE ON report_section_classification_decisions
FOR EACH ROW EXECUTE FUNCTION reject_report_planning_revision_update();
CREATE TRIGGER report_document_snapshot_immutable BEFORE UPDATE ON report_section_document_snapshots
FOR EACH ROW EXECUTE FUNCTION reject_report_planning_revision_update();
