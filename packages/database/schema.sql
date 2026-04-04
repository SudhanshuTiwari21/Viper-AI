-- Lightweight metadata only (no AST, embeddings, or dependency graphs).
-- Run this against your PostgreSQL database before using the persistence layer.

CREATE TYPE file_type AS ENUM (
  'source',
  'test',
  'config',
  'documentation',
  'generated',
  'other'
);

CREATE TABLE IF NOT EXISTS repositories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_url TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  branch TEXT NOT NULL,
  local_path TEXT NOT NULL,
  last_scanned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS repository_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  language TEXT NOT NULL,
  module TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('source', 'test', 'config', 'documentation', 'generated', 'other')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (repo_id, file_path)
);

CREATE INDEX IF NOT EXISTS idx_repository_files_repo_id ON repository_files(repo_id);

-- D.20: per-conversation model tier (see migrations/006_create_conversation_model_preferences.sql)
CREATE TABLE IF NOT EXISTS conversation_model_preferences (
  workspace_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  model_tier TEXT NOT NULL CHECK (model_tier IN ('auto', 'premium')),
  preferred_premium_model_id TEXT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, conversation_id)
);

-- D.21: quality feedback (see migrations/007_create_chat_feedback.sql)
CREATE TABLE IF NOT EXISTS chat_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  message_id TEXT,
  rating TEXT NOT NULL CHECK (rating IN ('up', 'down')),
  tags TEXT[] NOT NULL DEFAULT '{}',
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_feedback_workspace_created ON chat_feedback(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_feedback_request_id ON chat_feedback(request_id);

-- E.23: media objects for multimodal attachments (see migrations/008_create_chat_media.sql)
CREATE TABLE IF NOT EXISTS chat_media (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_chat_media_workspace_created ON chat_media(workspace_id, created_at);

-- F.29: auth core — users, workspaces, workspace_memberships
-- (see migrations/009_create_auth_core.sql)
--
-- workspace_id TEXT in the tables above is a path-derived key used by the
-- agentic pipeline today. workspaces.id UUID is the F.30+ identity anchor.
-- The mapping between the two is deferred to F.30; these tables are additive.

CREATE TABLE IF NOT EXISTS users (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT        NOT NULL,
  display_name     TEXT,
  auth_provider    TEXT,
  external_subject TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower
  ON users (lower(trim(email)));

CREATE TABLE IF NOT EXISTS workspaces (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   TEXT        NOT NULL,
  slug                   TEXT        UNIQUE,
  -- F.30: 16-hex path-derived key matching deriveWorkspaceId(workspacePath)
  path_key               TEXT        UNIQUE,
  -- F.34: Stripe billing linkage (nullable until linked)
  stripe_customer_id     TEXT        UNIQUE NULL,
  stripe_subscription_id TEXT        UNIQUE NULL,
  created_by_user_id UUID           REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_memberships (
  workspace_id UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
  role         TEXT        NOT NULL DEFAULT 'member'
                           CHECK (role IN ('owner', 'admin', 'member')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_memberships_user_id
  ON workspace_memberships (user_id);

CREATE INDEX IF NOT EXISTS idx_workspace_memberships_workspace_id
  ON workspace_memberships (workspace_id);

-- F.30: path_key bridges workspaces.id UUID ↔ path-derived workspace_id TEXT keys
-- (see migrations/010_add_workspace_path_key.sql)
-- Already included in the CREATE TABLE above (greenfield installs get path_key directly).
-- For existing databases upgraded from F.29, the ALTER migration is idempotent.

-- F.30: workspace_entitlements — per-workspace capability plan
-- (see migrations/011_create_workspace_entitlements.sql)
CREATE TABLE IF NOT EXISTS workspace_entitlements (
  workspace_id        UUID        PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  allowed_modes       JSONB,
  allowed_model_tiers JSONB,
  flags               JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- F.31: usage_events — append-only billing-grade record per chat HTTP request
-- (see migrations/012_create_usage_events.sql)
CREATE TABLE IF NOT EXISTS usage_events (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_id          TEXT        NOT NULL,
  workspace_path_key  TEXT        NOT NULL,
  workspace_uuid      UUID        NULL,
  user_uuid           UUID        NULL,
  conversation_id     TEXT        NULL,
  mode                TEXT        NOT NULL,
  intent              TEXT        NOT NULL,
  provider            TEXT        NOT NULL,
  primary_model_id    TEXT        NOT NULL,
  final_model_id      TEXT        NOT NULL,
  route_mode          TEXT        NOT NULL,
  effective_model_tier TEXT       NOT NULL,
  tier_downgraded     BOOLEAN     NOT NULL,
  fallback_count      INT         NOT NULL,
  latency_ms          INT         NOT NULL,
  input_tokens        INT         NULL,
  output_tokens       INT         NULL,
  total_tokens        INT         NULL,
  tool_call_count     INT         NULL,
  metadata            JSONB       NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT usage_events_request_id_uq UNIQUE (request_id)
);

CREATE INDEX IF NOT EXISTS idx_usage_events_workspace_occurred
  ON usage_events (workspace_path_key, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_usage_events_occurred
  ON usage_events (occurred_at DESC);

-- F.32: usage_rollups_daily — daily aggregates per workspace for billing queries
-- (see migrations/013_create_usage_rollups.sql)
CREATE TABLE IF NOT EXISTS usage_rollups_daily (
  bucket_date            DATE    NOT NULL,
  workspace_path_key     TEXT    NOT NULL,
  request_count          BIGINT  NOT NULL DEFAULT 0,
  stream_request_count   BIGINT  NOT NULL DEFAULT 0,
  total_latency_ms       BIGINT  NOT NULL DEFAULT 0,
  sum_input_tokens       BIGINT  NULL,
  sum_output_tokens      BIGINT  NULL,
  sum_total_tokens       BIGINT  NULL,
  tier_downgraded_count  BIGINT  NOT NULL DEFAULT 0,
  sum_fallback_count     BIGINT  NOT NULL DEFAULT 0,
  mode_breakdown         JSONB   NOT NULL DEFAULT '{}'::jsonb,
  model_breakdown        JSONB   NOT NULL DEFAULT '{}'::jsonb,
  last_aggregated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket_date, workspace_path_key)
);

CREATE INDEX IF NOT EXISTS idx_usage_rollups_daily_bucket
  ON usage_rollups_daily (bucket_date DESC);

-- F.32: watermark cursor for incremental aggregation job
CREATE TABLE IF NOT EXISTS usage_aggregation_cursor (
  job_name           TEXT        PRIMARY KEY,
  last_closed_day    DATE        NULL,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO usage_aggregation_cursor (job_name, last_closed_day)
VALUES ('daily', NULL)
ON CONFLICT (job_name) DO NOTHING;

-- F.34: billing_webhook_events — idempotency log for Stripe webhooks
-- (see migrations/014_create_billing_tables.sql)
CREATE TABLE IF NOT EXISTS billing_webhook_events (
  stripe_event_id    TEXT        PRIMARY KEY,
  event_type         TEXT        NOT NULL,
  workspace_id       UUID        NULL REFERENCES workspaces(id) ON DELETE SET NULL,
  processing_status  TEXT        NOT NULL DEFAULT 'applied'
                     CHECK (processing_status IN ('applied', 'ignored', 'error', 'duplicate')),
  received_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  error_message      TEXT        NULL
);

CREATE INDEX IF NOT EXISTS idx_billing_webhook_events_workspace
  ON billing_webhook_events (workspace_id)
  WHERE workspace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_billing_webhook_events_received
  ON billing_webhook_events (received_at DESC);
