CREATE TABLE auth_password_credentials (
  user_id TEXT PRIMARY KEY REFERENCES platform_users (user_id) ON DELETE CASCADE,
  username_normalized TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_changed_at_iso TIMESTAMPTZ NOT NULL,
  created_at_iso TIMESTAMPTZ NOT NULL,
  updated_at_iso TIMESTAMPTZ NOT NULL
);

CREATE TABLE auth_sessions (
  session_token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES platform_users (user_id) ON DELETE CASCADE,
  expires_at_iso TIMESTAMPTZ NOT NULL,
  last_seen_at_iso TIMESTAMPTZ NOT NULL,
  created_at_iso TIMESTAMPTZ NOT NULL,
  revoked_at_iso TIMESTAMPTZ
);

CREATE INDEX idx_auth_sessions_user_expiry
  ON auth_sessions (user_id, expires_at_iso DESC)
  WHERE revoked_at_iso IS NULL;

CREATE TABLE auth_login_throttles (
  throttle_key_hash TEXT PRIMARY KEY,
  failure_count INTEGER NOT NULL,
  window_started_at_iso TIMESTAMPTZ NOT NULL,
  locked_until_iso TIMESTAMPTZ,
  updated_at_iso TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_auth_login_throttles_cleanup
  ON auth_login_throttles (updated_at_iso);
