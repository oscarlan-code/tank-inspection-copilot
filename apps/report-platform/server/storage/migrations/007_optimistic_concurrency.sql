ALTER TABLE report_jobs
  ADD COLUMN manual_inputs_revision INTEGER NOT NULL DEFAULT 0;

ALTER TABLE report_layout_overrides
  ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

