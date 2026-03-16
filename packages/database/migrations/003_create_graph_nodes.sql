CREATE TABLE IF NOT EXISTS graph_nodes (
  id TEXT PRIMARY KEY,
  repo_id TEXT,
  type TEXT,
  name TEXT,
  file TEXT,
  module TEXT
);
