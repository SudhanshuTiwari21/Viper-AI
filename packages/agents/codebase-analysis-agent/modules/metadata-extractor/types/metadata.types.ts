/**
 * Universal node types after language normalization.
 */
export type NormalizedNodeType = "function" | "class" | "call" | "import";

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
 * Relationship edge for dependency graph.
 */
export interface RelationshipEdge {
  from: string;
  to: string;
  type: "calls" | "imports" | "extends" | "depends_on";
  /** Optional: source file for context. */
  file?: string;
  repo_id?: string;
}

/**
 * Result of symbol resolution (caller → callee).
 */
export interface ResolvedSymbol {
  caller: string;
  callee: string;
  resolved: boolean;
  /** Location when resolved: same_file | imported | same_module. */
  location?: "same_file" | "imported" | "same_module";
}
