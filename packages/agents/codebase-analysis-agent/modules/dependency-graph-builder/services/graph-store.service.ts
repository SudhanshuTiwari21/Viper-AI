import type { GraphNode } from "../types/graph.types";
import type { GraphEdge } from "../types/graph.types";

/**
 * Adapter for persisting the knowledge graph (e.g. PostgreSQL).
 * Tables: graph_nodes, graph_edges. Implementors should use batch inserts.
 */
export interface GraphStoreAdapter {
  saveNodes(nodes: GraphNode[]): Promise<void>;
  saveEdges(edges: GraphEdge[]): Promise<void>;
}

/**
 * Service that delegates to an adapter. When no adapter is set, operations are no-ops (MVP).
 */
export class GraphStoreService {
  private adapter: GraphStoreAdapter | null = null;

  setAdapter(adapter: GraphStoreAdapter): void {
    this.adapter = adapter;
  }

  async saveNodes(nodes: GraphNode[]): Promise<void> {
    if (nodes.length === 0) return;
    if (this.adapter) await this.adapter.saveNodes(nodes);
  }

  async saveEdges(edges: GraphEdge[]): Promise<void> {
    if (edges.length === 0) return;
    if (this.adapter) await this.adapter.saveEdges(edges);
  }
}
