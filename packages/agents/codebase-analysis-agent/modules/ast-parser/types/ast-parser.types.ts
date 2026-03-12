/**
 * Generic AST node shape (parser-agnostic).
 */
export interface ASTNode {
  type: string;
  name?: string;
  start: number;
  end: number;
  children?: ASTNode[];
  /** Optional: names of called symbols (e.g. function calls). */
  calls?: string[];
  [key: string]: unknown;
}

/**
 * Result of parsing a single file.
 */
export interface ParsedFile {
  repo: string;
  file: string;
  language: string;
  module: string;
  ast: ASTNode | ASTNode[];
  /** Raw parser output before normalization (optional). */
  raw?: unknown;
}

/**
 * Portable serialized AST for storage or downstream pipelines.
 */
export interface SerializedAST {
  type: string;
  name?: string;
  start: number;
  end: number;
  calls?: string[];
  [key: string]: unknown;
}

/**
 * Extracted function metadata (feeds Metadata Extraction / downstream).
 */
export interface FunctionMetadata {
  name: string;
  line_start: number;
  line_end: number;
  calls: string[];
}

/**
 * Extracted metadata for one file (Structure Extractor output).
 */
export interface ExtractedMetadata {
  repo_id: string;
  file: string;
  functions: FunctionMetadata[];
  imports: string[];
  /** Optional: class names for OOP languages */
  classes?: string[];
}

/**
 * Event published to next stage (metadata.extract.request).
 */
export interface MetadataExtractRequest {
  repo_id: string;
  file: string;
  functions: FunctionMetadata[];
  imports: string[];
  /** Serialized AST in portable format */
  serialized_ast?: SerializedAST | SerializedAST[];
}
