CREATE TABLE system_rl_policy_versions (
  policy_version_id TEXT PRIMARY KEY,
  policy_key TEXT NOT NULL,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  display_name TEXT NOT NULL,
  status_code TEXT NOT NULL CHECK (status_code IN ('training', 'production', 'archived')),
  algorithm_code TEXT NOT NULL CHECK (algorithm_code IN ('contextual_ucb_v1', 'fixed_v1')),
  exploration_coefficient DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (exploration_coefficient >= 0),
  minimum_promotion_episodes INTEGER NOT NULL DEFAULT 12 CHECK (minimum_promotion_episodes >= 1),
  minimum_mean_reward DOUBLE PRECISION NOT NULL DEFAULT 0.72 CHECK (minimum_mean_reward BETWEEN 0 AND 1),
  maximum_hard_failures INTEGER NOT NULL DEFAULT 0 CHECK (maximum_hard_failures >= 0),
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id TEXT REFERENCES platform_users (user_id) ON DELETE SET NULL,
  created_at_iso TIMESTAMPTZ NOT NULL,
  promoted_at_iso TIMESTAMPTZ,
  archived_at_iso TIMESTAMPTZ,
  UNIQUE (policy_key, version_number)
);

CREATE UNIQUE INDEX idx_system_rl_single_production_policy
  ON system_rl_policy_versions (policy_key)
  WHERE status_code = 'production';

CREATE INDEX idx_system_rl_policy_status
  ON system_rl_policy_versions (status_code, created_at_iso DESC);

CREATE TABLE system_rl_policy_arms (
  arm_id TEXT PRIMARY KEY,
  policy_version_id TEXT NOT NULL REFERENCES system_rl_policy_versions (policy_version_id) ON DELETE CASCADE,
  arm_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  config_json JSONB NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  stable_order INTEGER NOT NULL DEFAULT 0,
  created_at_iso TIMESTAMPTZ NOT NULL,
  UNIQUE (policy_version_id, arm_key)
);

CREATE INDEX idx_system_rl_policy_arms_enabled
  ON system_rl_policy_arms (policy_version_id, is_enabled, stable_order);

CREATE TABLE system_rl_policy_decisions (
  decision_id TEXT PRIMARY KEY,
  policy_version_id TEXT NOT NULL REFERENCES system_rl_policy_versions (policy_version_id),
  arm_id TEXT NOT NULL REFERENCES system_rl_policy_arms (arm_id),
  run_id TEXT NOT NULL UNIQUE REFERENCES report_generation_runs (run_id) ON DELETE CASCADE,
  report_job_id TEXT NOT NULL REFERENCES report_jobs (report_job_id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants (tenant_id),
  workspace_id TEXT NOT NULL REFERENCES workspaces (workspace_id),
  section_id TEXT NOT NULL,
  mode_code TEXT NOT NULL CHECK (mode_code IN ('live_generation', 'offline_evaluation')),
  context_key TEXT NOT NULL,
  context_json JSONB NOT NULL,
  selection_score DOUBLE PRECISION,
  selection_reason TEXT NOT NULL,
  config_snapshot_json JSONB NOT NULL,
  created_at_iso TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_system_rl_decisions_policy_context
  ON system_rl_policy_decisions (policy_version_id, context_key, created_at_iso DESC);

CREATE INDEX idx_system_rl_decisions_report
  ON system_rl_policy_decisions (report_job_id, created_at_iso DESC);

CREATE TABLE system_rl_policy_rewards (
  reward_id TEXT PRIMARY KEY,
  decision_id TEXT NOT NULL UNIQUE REFERENCES system_rl_policy_decisions (decision_id) ON DELETE CASCADE,
  eval_run_id TEXT NOT NULL UNIQUE REFERENCES report_eval_runs (eval_run_id) ON DELETE CASCADE,
  reward_value DOUBLE PRECISION CHECK (reward_value BETWEEN 0 AND 1),
  learning_eligible BOOLEAN NOT NULL,
  hard_failure BOOLEAN NOT NULL,
  hard_failure_reasons_json JSONB NOT NULL,
  metrics_json JSONB NOT NULL,
  created_at_iso TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_system_rl_rewards_eligibility
  ON system_rl_policy_rewards (learning_eligible, hard_failure, created_at_iso DESC);

CREATE TABLE system_rl_context_arm_stats (
  policy_version_id TEXT NOT NULL REFERENCES system_rl_policy_versions (policy_version_id) ON DELETE CASCADE,
  arm_id TEXT NOT NULL REFERENCES system_rl_policy_arms (arm_id) ON DELETE CASCADE,
  context_key TEXT NOT NULL,
  eligible_episode_count INTEGER NOT NULL DEFAULT 0 CHECK (eligible_episode_count >= 0),
  reward_sum DOUBLE PRECISION NOT NULL DEFAULT 0,
  reward_squared_sum DOUBLE PRECISION NOT NULL DEFAULT 0,
  hard_failure_count INTEGER NOT NULL DEFAULT 0 CHECK (hard_failure_count >= 0),
  last_reward DOUBLE PRECISION,
  updated_at_iso TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (policy_version_id, arm_id, context_key)
);

CREATE TABLE system_rl_policy_events (
  event_id TEXT PRIMARY KEY,
  policy_version_id TEXT NOT NULL REFERENCES system_rl_policy_versions (policy_version_id),
  actor_user_id TEXT NOT NULL REFERENCES platform_users (user_id),
  event_code TEXT NOT NULL CHECK (event_code IN ('promoted', 'rolled_back', 'archived')),
  previous_production_policy_version_id TEXT REFERENCES system_rl_policy_versions (policy_version_id),
  reason TEXT NOT NULL,
  evidence_json JSONB NOT NULL,
  created_at_iso TIMESTAMPTZ NOT NULL
);

INSERT INTO system_rl_policy_versions (
  policy_version_id,
  policy_key,
  version_number,
  display_name,
  status_code,
  algorithm_code,
  exploration_coefficient,
  minimum_promotion_episodes,
  minimum_mean_reward,
  maximum_hard_failures,
  config_json,
  created_at_iso,
  promoted_at_iso
) VALUES (
  'rl_policy_report_generation_v1',
  'report_generation',
  1,
  'Product baseline',
  'production',
  'fixed_v1',
  0,
  12,
  0.72,
  0,
  '{"goldFirewall":true,"tenantIsolation":true,"learningMode":"frozen"}'::jsonb,
  '2026-08-04T00:00:00.000Z',
  '2026-08-04T00:00:00.000Z'
) ON CONFLICT (policy_version_id) DO NOTHING;

INSERT INTO system_rl_policy_versions (
  policy_version_id,
  policy_key,
  version_number,
  display_name,
  status_code,
  algorithm_code,
  exploration_coefficient,
  minimum_promotion_episodes,
  minimum_mean_reward,
  maximum_hard_failures,
  config_json,
  created_at_iso
) VALUES (
  'rl_policy_report_generation_v2_candidate',
  'report_generation',
  2,
  'Reward-trained candidate',
  'training',
  'contextual_ucb_v1',
  0.35,
  12,
  0.72,
  0,
  '{"goldFirewall":true,"tenantIsolation":true,"learningMode":"offline_only"}'::jsonb,
  '2026-08-04T00:00:00.000Z'
) ON CONFLICT (policy_version_id) DO NOTHING;

INSERT INTO system_rl_policy_arms (
  arm_id,
  policy_version_id,
  arm_key,
  display_name,
  description,
  config_json,
  is_enabled,
  stable_order,
  created_at_iso
) VALUES
  (
    'rl_arm_v1_balanced',
    'rl_policy_report_generation_v1',
    'balanced',
    'Balanced baseline',
    'Current V1 Beta retrieval and generation behavior.',
    '{"precedentMinimumScore":45,"precedentCandidateMultiplier":4,"precedentLimit":5,"wordingLimit":3,"standardsLimit":3,"factRecommendationLimit":24,"promptVariant":"baseline_v1","agentRoute":"default"}'::jsonb,
    TRUE,
    1,
    '2026-08-04T00:00:00.000Z'
  ),
  (
    'rl_arm_v2_conservative',
    'rl_policy_report_generation_v2_candidate',
    'conservative',
    'Grounded conservative',
    'Higher retrieval threshold and smaller context for strict factual grounding.',
    '{"precedentMinimumScore":60,"precedentCandidateMultiplier":3,"precedentLimit":3,"wordingLimit":2,"standardsLimit":2,"factRecommendationLimit":12,"promptVariant":"grounded_concise_v1","agentRoute":"deterministic_first"}'::jsonb,
    TRUE,
    1,
    '2026-08-04T00:00:00.000Z'
  ),
  (
    'rl_arm_v2_balanced',
    'rl_policy_report_generation_v2_candidate',
    'balanced',
    'Balanced',
    'Balanced precedent coverage and grounding.',
    '{"precedentMinimumScore":45,"precedentCandidateMultiplier":4,"precedentLimit":5,"wordingLimit":3,"standardsLimit":3,"factRecommendationLimit":24,"promptVariant":"baseline_v1","agentRoute":"default"}'::jsonb,
    TRUE,
    2,
    '2026-08-04T00:00:00.000Z'
  ),
  (
    'rl_arm_v2_broad',
    'rl_policy_report_generation_v2_candidate',
    'broader_recall',
    'Broader recall',
    'Wider precedent and recommendation context for sparse evidence cases.',
    '{"precedentMinimumScore":35,"precedentCandidateMultiplier":5,"precedentLimit":8,"wordingLimit":4,"standardsLimit":3,"factRecommendationLimit":32,"promptVariant":"evidence_recovery_v1","agentRoute":"context_enriched"}'::jsonb,
    TRUE,
    3,
    '2026-08-04T00:00:00.000Z'
  )
ON CONFLICT (arm_id) DO NOTHING;
