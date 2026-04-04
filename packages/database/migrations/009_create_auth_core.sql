-- F.29: auth core — users, workspaces, workspace_memberships.
--
-- Design notes:
--   • Additive only — existing tables (chat_feedback, chat_media, etc.) are
--     untouched. Their workspace_id TEXT column is a path-derived or client-
--     supplied string; the mapping to workspaces.id UUID is deferred to F.30.
--   • auth_provider + external_subject are nullable placeholders for F.30
--     OAuth/JWT integration; no provider logic is required in F.29.
--   • Membership role is an inline CHECK to avoid a separate ENUM type (easier
--     to extend in a future migration without ALTER TYPE).
--   • ON DELETE CASCADE on workspace_memberships means removing a user or
--     workspace automatically removes memberships. Documents explicitly chosen
--     over RESTRICT because orphaned memberships have no value.

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT        NOT NULL,
  display_name     TEXT,
  -- F.30 OAuth/JWT placeholders (no provider logic in F.29)
  auth_provider    TEXT,
  external_subject TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Normalise email on insert via a unique functional index
-- (lower(trim(email))) so lookups are case-insensitive.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower
  ON users (lower(trim(email)));

-- ---------------------------------------------------------------------------
-- workspaces
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workspaces (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL,
  -- Optional short identifier, e.g. "my-org/my-project"
  slug            TEXT        UNIQUE,
  created_by_user_id UUID     REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- workspace_memberships
-- ---------------------------------------------------------------------------
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
