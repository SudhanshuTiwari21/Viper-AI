import type { GraphStoreAdapter } from "../services/graph-store.service";
import type { GraphNode, GraphEdge } from "../types/graph.types";

/**
 * Minimal client for running SQL. Use a pg Pool in production:
 *   const pool = new Pool({ connectionString: process.env.DATABASE_URL });
 *   const adapter = new PostgresGraphStoreAdapter(pool);
 */
export interface PgQueryClient {
  query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
}

/**
 * Postgres adapter for GraphStoreService. Persists to graph_nodes and graph_edges.
 * Tables (create in your DB):
 *
 *   CREATE TABLE IF NOT EXISTS graph_nodes (
 *     id TEXT PRIMARY KEY,
 *     type TEXT NOT NULL,
 *     file TEXT NOT NULL,
 *     module TEXT NOT NULL,
 *     repo_id TEXT NOT NULL,
 *     name TEXT
 *   );
 *
 *   CREATE TABLE IF NOT EXISTS graph_edges (
 *     from_node TEXT NOT NULL,
 *     to_node TEXT NOT NULL,
 *     type TEXT NOT NULL,
 *     repo_id TEXT NOT NULL,
 *     file TEXT,
 *     module TEXT,
 *     PRIMARY KEY (from_node, to_node, type)
 *   );
 */
export class PostgresGraphStoreAdapter implements GraphStoreAdapter {
  constructor(private readonly client: PgQueryClient) {}

  async saveNodes(nodes: GraphNode[]): Promise<void> {
    if (nodes.length === 0) return;
    const values: unknown[] = [];
    const placeholders: string[] = [];
    nodes.forEach((node, i) => {
      const o = i * 6;
      placeholders.push(`($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6})`);
      values.push(node.id, node.type, node.file, node.module, node.repo_id, node.name ?? null);
    });
    await this.client.query(
      `INSERT INTO graph_nodes (id, type, file, module, repo_id, name)
       VALUES ${placeholders.join(", ")}
       ON CONFLICT (id) DO UPDATE SET
         type = EXCLUDED.type,
         file = EXCLUDED.file,
         module = EXCLUDED.module,
         repo_id = EXCLUDED.repo_id,
         name = EXCLUDED.name`,
      values
    );
  }

  async saveEdges(edges: GraphEdge[]): Promise<void> {
    if (edges.length === 0) return;
    const values: unknown[] = [];
    const placeholders: string[] = [];
    edges.forEach((edge, i) => {
      const o = i * 6;
      placeholders.push(`($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6})`);
      values.push(
        edge.from,
        edge.to,
        edge.type,
        edge.repo_id,
        edge.file ?? null,
        edge.module ?? null
      );
    });
    await this.client.query(
      `INSERT INTO graph_edges (from_node, to_node, type, repo_id, file, module)
       VALUES ${placeholders.join(", ")}
       ON CONFLICT (from_node, to_node, type) DO NOTHING`,
      values
    );
  }
}
