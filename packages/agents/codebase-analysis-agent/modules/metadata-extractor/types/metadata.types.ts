/**
 * Universal node types after language normalization.
 */
export type NormalizedNodeType = "function" | "class" | "call" | "import";

/**
 * Relationship types for the dependency graph. Defined early to avoid schema migrations.
 * IMPLEMENTS, USES, DECORATES, INSTANTIATES can be wired in later.
 */
export type RelationshipType =
  | "CALLS"
  | "IMPORTS"
  | "EXTENDS"
  | "IMPLEMENTS"
  | "USES"
  | "DEPENDS_ON"
  | "DECORATES"
  | "INSTANTIATES";

/**
 * Normalized node used across the pipeline (single schema regardless of language).
 */
export interface NormalizedNode {
  type: NormalizedNodeType;
  name: string;
  file: string;
  /** Optional: for calls, the target symbol. */
  target?: string;
  /** Optional: line/range. */
  line_start?: number;
  line_end?: number;
  /** Optional: list of called symbols for function nodes. */
  calls?: string[];
}

/**
 * Function metadata record for storage and graph building.
 */
export interface FunctionMetadata {
  function: string;
  file: string;
  module: string;
  repo_id: string;
  line_start?: number;
  line_end?: number;
  calls?: string[];
}

/**
 * Class metadata record.
 */
export interface ClassMetadata {
  class: string;
  file: string;
  module: string;
  repo_id: string;
  extends?: string;
}

/**
 * Import metadata record.
 */
export interface ImportMetadata {
  file: string;
  module: string;
  repo_id: string;
  imports: string[];
}

/**
 * Relationship edge for dependency graph. Uses canonical node IDs to avoid name collisions.
 * Format: repo_id:file:symbol (e.g. backend-service:src/auth/login.ts:loginUser).
 */
export interface RelationshipEdge {
  /** Unique edge id for deduplication and updates. */
  id: string;
  repo_id: string;
  /** Caller or source node (canonical id). */
  from: string;
  /** Callee or target node (canonical id). */
  to: string;
  type: RelationshipType;
  /** Source file for context and incremental updates. */
  file: string;
  /** Logical module. */
  module: string;
}

/**
 * Build canonical node id: repo_id:file:symbol.
 */
export function toCanonicalId(repo_id: string, file: string, symbol: string): string {
  return `${repo_id}:${file}:${symbol}`;
}

/**
 * Result of symbol resolution (caller → callee).
 */
export interface ResolvedSymbol {
  caller: string;
  callee: string;
  resolved: boolean;
  /** Resolved canonical id when resolved (repo_id:file:callee). */
  resolvedTo?: string;
  /** Location when resolved: same_file | imported | same_module. */
  location?: "same_file" | "imported" | "same_module";
}
