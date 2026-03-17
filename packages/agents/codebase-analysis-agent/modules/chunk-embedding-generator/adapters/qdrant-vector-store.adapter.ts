import { QdrantClient } from "@qdrant/js-client-rest";
import type { VectorStoreAdapter } from "../services/vector-store.service.ts";
import type { VectorRecord } from "../types/chunk.types.ts";

const COLLECTION = process.env.QDRANT_COLLECTION ?? "viper_code";

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
      id: r.id,
      vector: r.vector,
      payload: {
        repo_id: r.repo_id,
        file: r.file,
        module: r.module,
        ...(r.symbol != null && { symbol: r.symbol }),
        ...(r.metadata && typeof r.metadata === "object" && { ...r.metadata }),
      },
    }));

    await this.client.upsert(this.collection, { wait: true, points });
    console.log("[Viper] embeddings stored");
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

    return (results ?? []).map((p) => ({
      id: String(p.id),
      score: p.score ?? 0,
      payload: (p.payload ?? {}) as Record<string, unknown>,
    }));
  }
}
