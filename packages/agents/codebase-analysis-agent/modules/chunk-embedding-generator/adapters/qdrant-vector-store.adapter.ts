import { createHash } from "node:crypto";
import { QdrantClient } from "@qdrant/js-client-rest";
import type { VectorStoreAdapter } from "../services/vector-store.service";
import type { VectorRecord } from "../types/chunk.types";

const COLLECTION = process.env.QDRANT_COLLECTION ?? "viper_code";

/** Qdrant expects point IDs to be UUID or integer; convert chunk_id to a deterministic UUID. */
function toPointId(chunkId: string): string {
  const hex = createHash("sha256").update(chunkId).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Qdrant vector store adapter. Persists code embeddings with metadata (repo_id, file, module, symbol).
 * Auto-creates collection on first use if it does not exist (cosine, vector size from first batch).
 */
export class QdrantVectorStoreAdapter implements VectorStoreAdapter {
  private client: QdrantClient;
  private collection: string;
  private ensureCollectionPromise: Promise<void> | null = null;

  constructor(options?: { url?: string; collection?: string }) {
    const url = options?.url ?? process.env.QDRANT_URL ?? "http://localhost:6333";
    this.client = new QdrantClient({ url });
    this.collection = options?.collection ?? COLLECTION;
  }

  private async ensureCollection(vectorSize: number): Promise<void> {
    if (this.ensureCollectionPromise) return this.ensureCollectionPromise;

    this.ensureCollectionPromise = (async () => {
      const list = await this.client.getCollections();
      const exists = list.collections?.some((c) => c.name === this.collection);
      if (!exists) {
        await this.client.createCollection(this.collection, {
          vectors: {
            size: vectorSize,
            distance: "Cosine",
          },
        });
      }
    })();
    await this.ensureCollectionPromise;
  }

  async upsertVectors(records: VectorRecord[]): Promise<void> {
    if (records.length === 0) return;

    const first = records[0];
    if (!first?.vector?.length) return;
    const vectorSize = first.vector.length;
    await this.ensureCollection(vectorSize);

    const points = records.map((r) => ({
      id: toPointId(r.id),
      vector: r.vector,
      payload: {
        chunk_id: r.id,
        repo_id: r.repo_id,
        file: r.file,
        module: r.module,
        ...(r.symbol != null && { symbol: r.symbol }),
        ...(r.metadata && typeof r.metadata === "object" && { ...r.metadata }),
      },
    }));

    try {
      await this.client.upsert(this.collection, { wait: true, points });
      console.log("[Viper] embeddings stored");
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      console.error("[Viper] Qdrant upsert error", {
        status: e?.status ?? e?.statusCode,
        message: e?.message,
        body: e?.body ?? e?.error,
      });
      throw err;
    }
  }

  /**
   * Search for similar vectors (e.g. for context engine embeddingSearch).
   */
  async searchVectors(params: {
    vector: number[];
    limit?: number;
    filter?: { repo_id?: string };
  }): Promise<Array<{ id: string; score: number; payload: Record<string, unknown> }>> {
    const list = await this.client.getCollections();
    const exists = list.collections?.some((c) => c.name === this.collection);
    if (!exists) return [];

    const filter = params.filter?.repo_id
      ? { must: [{ key: "repo_id", match: { value: params.filter.repo_id } }] }
      : undefined;

    const results = await this.client.search(this.collection, {
      vector: params.vector,
      limit: params.limit ?? 10,
      with_payload: true,
      with_vector: false,
      filter,
    });

    return (results ?? []).map((p) => {
      const payload = (p.payload ?? {}) as Record<string, unknown>;
      const id = (payload.chunk_id as string) ?? String(p.id);
      return { id, score: p.score ?? 0, payload };
    });
  }
}
