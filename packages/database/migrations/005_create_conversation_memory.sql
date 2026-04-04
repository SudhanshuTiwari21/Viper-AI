CREATE TABLE IF NOT EXISTS conversation_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_path TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  entry_type TEXT NOT NULL,
  content TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}',
  weight INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conv_memory_session
  ON conversation_memory(workspace_path, conversation_id);

CREATE INDEX IF NOT EXISTS idx_conv_memory_type
  ON conversation_memory(conversation_id, entry_type);
