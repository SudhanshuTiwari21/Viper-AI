CREATE TABLE IF NOT EXISTS repositories (
  id TEXT PRIMARY KEY,
  path TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
