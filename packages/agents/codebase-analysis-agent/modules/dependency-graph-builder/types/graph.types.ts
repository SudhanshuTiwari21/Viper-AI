/**
 * Graph node type in the repository knowledge graph.
 */
export type GraphNodeType = "function" | "class" | "file" | "module";

/**
 * Node in the knowledge graph. Id is canonical: repo_id:file:symbol or repo_id:file:file.
 */
export interface GraphNode {
  id: string;
  type: GraphNodeType;
  file: string;
  module: string;
  repo_id: string;
  /** Symbol name for function/class nodes (e.g. loginUser). */
  name?: string;
}

/**
 * Edge type in the knowledge graph.
 */
export type GraphEdgeType =
  | "CALLS"
  | "IMPORTS"
  | "EXTENDS"
  | "IMPLEMENTS"
  | "DEPENDS_ON";

/**
 * Directed edge between two graph nodes.
 */
export interface GraphEdge {
  from: string;
  to: string;
  type: GraphEdgeType;
  repo_id: string;
  /** Optional: source file for context. */
  file?: string;
  module?: string;
}

/**
 * Normalized metadata node (unified schema after normalizer).
 */
export interface NormalizedGraphNode {
  id: string;
  type: GraphNodeType;
  file: string;
  module: string;
  repo_id: string;
  name?: string;
}
