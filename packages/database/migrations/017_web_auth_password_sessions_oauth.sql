-- Web auth: password (email), refresh sessions, OAuth state & one-time exchange codes.
-- Argon2id hashes stored in password_hash; never log or return this column.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash TEXT NULL,
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN users.password_hash IS 'Argon2id-encoded password; NULL for OAuth-only accounts.';
COMMENT ON COLUMN users.email_verified_at IS 'NULL until email is verified (OAuth sets on first login).';

-- One row per OAuth identity (e.g. Google sub). Email/password users use auth_provider=email and external_subject NULL.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_oauth_provider_subject
  ON users (auth_provider, external_subject)
  WHERE external_subject IS NOT NULL;

CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash      TEXT        NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at      TIMESTAMPTZ NULL,
  user_agent      TEXT        NULL,
  ip_inferred     TEXT        NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_user_id ON auth_refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_expires ON auth_refresh_tokens (expires_at);

CREATE TABLE IF NOT EXISTS auth_oauth_states (
  state_hash      TEXT        PRIMARY KEY,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_oauth_exchange_codes (
  code_hash       TEXT        PRIMARY KEY,
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at      TIMESTAMPTZ NOT NULL,
  consumed_at     TIMESTAMPTZ NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_oauth_exchange_expires ON auth_oauth_exchange_codes (expires_at);

CREATE TABLE IF NOT EXISTS auth_email_verification_tokens (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash      TEXT        NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_email_verify_user ON auth_email_verification_tokens (user_id);
