import type { EmbeddingGenerateJob } from "../types/embedding-job.types";
import type { Chunk, ChunkType } from "../types/chunk.types";

/**
 * Build chunk_id in canonical form: repo_id:module:symbol or repo_id:module:file.
 */
function buildChunkId(
  repo_id: string,
  module: string,
  symbolOrFile: string,
  type: ChunkType
): string {
  const safe = symbolOrFile.replace(/[/\\:]/g, "_");
  return `${repo_id}:${module}:${safe}`;
}

/**
 * Infer chunk type from job (symbol present → function/class; otherwise file_summary).
 */
function inferChunkType(job: EmbeddingGenerateJob): ChunkType {
  if (job.symbol) return "function";
  return "file_summary";
}

/**
 * Extract logical code chunks from an embedding job.
 * Produces one chunk per job (function, class, file_summary, or module_summary).
 */
export function extractChunks(job: EmbeddingGenerateJob): Chunk[] {
  const type = inferChunkType(job);
  const symbol = job.symbol ?? job.file;
  const chunk_id = buildChunkId(job.repo_id, job.module, symbol, type);

  const chunk: Chunk = {
    chunk_id,
    file: job.file,
    module: job.module,
    type,
    content: job.content,
    repo_id: job.repo_id,
  };
  if (job.symbol) chunk.symbol = job.symbol;

  return [chunk];
}
