/**
 * OpenAI embeddings adapter for EmbeddingModelService.
 * Uses text-embedding-3-small by default. Includes per-chunk caching and batching.
 */
import OpenAI from "openai";
import { hashString, createMemoryCache, withRetry } from "@repo/shared";
import type { EmbeddingModelAdapter } from "../services/embedding-model.service";

const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_CACHE_TTL = Math.max(
  0,
  parseInt(process.env.EMBEDDING_CACHE_TTL ?? "604800", 10),
);
const EMBEDDING_BATCH_SIZE = Math.max(1, Math.min(256, parseInt(process.env.EMBEDDING_BATCH_SIZE ?? "64", 10)));

function getModel(): string {
  return process.env.OPENAI_EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL;
}

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Set it in .env to use the embedding provider.",
    );
  }
  return new OpenAI({ apiKey });
}

function isRetryableError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  return status === 429 || status === 503;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

const embeddingCache = createMemoryCache<number[]>();

/**
 * Create an EmbeddingModelAdapter that uses OpenAI embeddings API with caching and batching.
 */
export function createOpenAIEmbeddingAdapter(): EmbeddingModelAdapter {
  return {
    async generateEmbeddings(texts: string[]): Promise<number[][]> {
      if (texts.length === 0) return [];

      const keys = texts.map((t) => `embedding:${hashString(t)}`);
      const results: number[][] = new Array(texts.length);
      const missIndices: number[] = [];
      const missTexts: string[] = [];

      if (EMBEDDING_CACHE_TTL > 0) {
        let hitCount = 0;
        for (let i = 0; i < texts.length; i++) {
          const cached = await embeddingCache.get(keys[i]!);
          if (cached !== null) {
            results[i] = cached;
            hitCount++;
          } else {
            missIndices.push(i);
            missTexts.push(texts[i]!);
          }
        }
        if (process.env.NODE_ENV !== "test") {
          if (hitCount > 0) console.log("[Viper] Embedding cache hit", { count: hitCount });
          if (missTexts.length > 0) console.log("[Viper] Embedding cache miss", { count: missTexts.length });
        }
      } else {
        for (let i = 0; i < texts.length; i++) {
          missIndices.push(i);
          missTexts.push(texts[i]!);
        }
      }

      if (missTexts.length === 0) {
        return results;
      }

      if (process.env.NODE_ENV !== "test") {
        console.log("[Viper] Embedding batch size", { n: Math.min(EMBEDDING_BATCH_SIZE, missTexts.length) });
      }

      const client = getClient();
      const model = getModel();
      const batches = chunkArray(missTexts, EMBEDDING_BATCH_SIZE);
      let filled = 0;

      for (const batch of batches) {
        try {
          const response = await withRetry(
            () =>
              client.embeddings.create({
                model,
                input: batch,
              }),
            { maxRetries: 3, retryDelayMs: 500, isRetryable: isRetryableError },
          );
          const sorted = response.data.sort((a, b) => a.index - b.index);
          const embeddings = sorted.map((d) => d.embedding);
          for (let i = 0; i < batch.length; i++) {
            const globalIndex = missIndices[filled + i]!;
            results[globalIndex] = embeddings[i]!;
            if (EMBEDDING_CACHE_TTL > 0) {
              await embeddingCache.set(keys[globalIndex]!, embeddings[i]!, EMBEDDING_CACHE_TTL);
            }
          }
          filled += batch.length;
        } catch (error) {
          console.error("[Viper] Embedding provider error", error);
          throw new Error(
            "Embedding request failed. Check OPENAI_API_KEY and network.",
          );
        }
      }

      return results;
    },
  };
}
