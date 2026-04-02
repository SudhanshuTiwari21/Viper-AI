-- D.21: quality feedback loop — thumbs up/down per assistant message.
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
