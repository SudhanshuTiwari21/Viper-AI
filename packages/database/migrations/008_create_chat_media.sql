-- E.23: media objects for multimodal attachments (image upload / media reference system).
-- mediaId is a server-issued opaque TEXT key (e.g. "med_" + 24 hex chars).
-- storage_key is the opaque path/key used by the storage driver (e.g. the mediaId itself
--   for local-disk mode; a cloud object key for S3/GCS in later steps).
-- expires_at: set when VIPER_MEDIA_TTL_HOURS is configured; NULL = never expires.
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
