import type { VectorRecord } from "../types/chunk.types";

/**
 * Adapter for vector DB (e.g. Qdrant). Each vector includes metadata.
 */
export interface VectorStoreAdapter {
  upsertVectors(records: VectorRecord[]): Promise<void>;
}

/**
 * Service that delegates to an adapter. When no adapter is set, operations are no-ops (MVP).
 */
export class VectorStoreService {
  private adapter: VectorStoreAdapter | null = null;

  setAdapter(adapter: VectorStoreAdapter): void {
    this.adapter = adapter;
  }

  async upsertVectors(records: VectorRecord[]): Promise<void> {
    if (records.length === 0) return;
    if (this.adapter) await this.adapter.upsertVectors(records);
  }
}
