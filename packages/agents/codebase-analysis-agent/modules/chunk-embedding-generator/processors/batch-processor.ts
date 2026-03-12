import type { Chunk } from "../types/chunk.types";

export interface BatchProcessorOptions {
  /** Min batch size (default 16). */
  minBatchSize?: number;
  /** Max batch size (default 64). */
  maxBatchSize?: number;
}

const DEFAULT_MIN = 16;
const DEFAULT_MAX = 64;

/**
 * Batch chunks for embedding generation. Returns array of chunk batches.
 * Batch size between 16–64 chunks by default.
 */
export function batchChunks(
  chunks: Chunk[],
  options: BatchProcessorOptions = {}
): Chunk[][] {
  const min = options.minBatchSize ?? DEFAULT_MIN;
  const max = options.maxBatchSize ?? DEFAULT_MAX;
  const size = Math.min(Math.max(chunks.length, min), max);

  if (chunks.length === 0) return [];
  if (chunks.length <= size) return [chunks];

  const batches: Chunk[][] = [];
  for (let i = 0; i < chunks.length; i += size) {
    batches.push(chunks.slice(i, i + size));
  }
  return batches;
}
