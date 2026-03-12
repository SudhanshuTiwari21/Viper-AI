/**
 * Serialized AST node shape (from AST Parsing Layer).
 */
export interface SerializedASTNode {
  type: string;
  name?: string;
  start: number;
  end: number;
  calls?: string[];
  children?: SerializedASTNode[];
  [key: string]: unknown;
}

/**
 * Job consumed from metadata_extract_queue (produced by AST / orchestrator).
 */
export interface MetadataJob {
  repo_id: string;
  file: string;
  module: string;
  language: string;
  ast: SerializedASTNode | SerializedASTNode[];
}
