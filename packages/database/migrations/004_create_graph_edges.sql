CREATE TABLE IF NOT EXISTS graph_edges (
  id SERIAL PRIMARY KEY,
  repo_id TEXT,
  from_node TEXT,
  to_node TEXT,
  type TEXT,
  file TEXT,
  module TEXT,
  UNIQUE(from_node, to_node, type)
);
