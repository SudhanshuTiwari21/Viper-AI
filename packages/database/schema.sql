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
  model_tier TEXT NOT NULL CHECK (model_tier IN ('auto', 'premium', 'fast')),
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
