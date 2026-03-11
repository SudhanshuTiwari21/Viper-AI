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
