-- D.20: per-conversation model tier preference (server-side persistence).
CREATE TABLE IF NOT EXISTS conversation_model_preferences (
  workspace_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  model_tier TEXT NOT NULL CHECK (model_tier IN ('auto', 'premium', 'fast')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, conversation_id)
);
