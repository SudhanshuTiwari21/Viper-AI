import type { Chunk } from "../types/chunk.types";
import type { VectorRecord } from "../types/chunk.types";

/**
 * Convert chunks and their embeddings into vector records for storage.
 */
export function formatVectors(
  chunks: Chunk[],
  embeddings: number[][]
): VectorRecord[] {
  if (chunks.length !== embeddings.length) {
    throw new Error(
      `Chunk count (${chunks.length}) does not match embedding count (${embeddings.length})`
    );
  }

  return chunks.map((chunk, i) => {
    const vector = embeddings[i];
    if (!vector || !Array.isArray(vector)) {
      throw new Error(`Missing or invalid embedding at index ${i} for chunk ${chunk.chunk_id}`);
    }
    return {
      id: chunk.chunk_id,
      vector,
      repo_id: chunk.repo_id,
      file: chunk.file,
      module: chunk.module,
      symbol: chunk.symbol,
      metadata: {
        type: chunk.type,
        file: chunk.file,
        module: chunk.module,
        ...(chunk.symbol && { symbol: chunk.symbol }),
      },
    };
  });
}
