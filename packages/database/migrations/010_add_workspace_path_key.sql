-- F.30: Add path_key to workspaces to bridge the gap between the UUID identity
-- anchor (workspaces.id) and the path-derived TEXT key used today in
-- chat_feedback, chat_media, conversation_model_preferences, etc.
--
-- path_key is the same 16-hex string produced by deriveWorkspaceId():
--   SHA-256(normalizePath(workspacePath)).slice(0, 16)
--
-- Nullable initially (old rows have no path; backfill via upsertWorkspaceByPathKey).
-- UNIQUE so lookups are O(log n); partial index on non-null values is equivalent
-- but the full unique index is simpler here.
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS path_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_path_key ON workspaces (path_key)
  WHERE path_key IS NOT NULL;
