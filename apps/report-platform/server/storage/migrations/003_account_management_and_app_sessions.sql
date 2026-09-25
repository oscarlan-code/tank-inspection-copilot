ALTER TABLE auth_sessions
  ADD COLUMN client_type TEXT NOT NULL DEFAULT 'web',
  ADD COLUMN device_id TEXT;

CREATE INDEX idx_auth_sessions_client_user
  ON auth_sessions (client_type, user_id, expires_at_iso DESC)
  WHERE revoked_at_iso IS NULL;

CREATE TABLE platform_audit_events (
  audit_event_id TEXT PRIMARY KEY,
  actor_user_id TEXT NOT NULL REFERENCES platform_users (user_id),
  target_user_id TEXT REFERENCES platform_users (user_id),
  tenant_id TEXT REFERENCES tenants (tenant_id),
  workspace_id TEXT REFERENCES workspaces (workspace_id),
  event_code TEXT NOT NULL,
  event_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at_iso TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_platform_audit_events_created
  ON platform_audit_events (created_at_iso DESC);

CREATE INDEX idx_platform_audit_events_target
  ON platform_audit_events (target_user_id, created_at_iso DESC)
  WHERE target_user_id IS NOT NULL;
