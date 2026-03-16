CREATE TABLE IF NOT EXISTS repository_files (
  id SERIAL PRIMARY KEY,
  repo_id TEXT,
  file_path TEXT,
  language TEXT,
  module TEXT
);
