/**
 * Chunk type for embedding (function, class, file_summary, module_summary).
 */
export type ChunkType = "function" | "class" | "file_summary" | "module_summary";

/**
 * Logical code chunk extracted for embedding.
 */
export interface Chunk {
  chunk_id: string;
  file: string;
  module: string;
  symbol?: string;
  type: ChunkType;
  content: string;
  repo_id: string;
}

/**
 * Vector record for storage in vector DB (e.g. Qdrant).
 */
export interface VectorRecord {
  id: string;
  vector: number[];
  repo_id: string;
  file: string;
  module: string;
  symbol?: string;
  metadata?: Record<string, unknown>;
}
