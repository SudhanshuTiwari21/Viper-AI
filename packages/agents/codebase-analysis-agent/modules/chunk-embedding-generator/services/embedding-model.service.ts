/**
 * Pluggable embedding provider (OpenAI, Cohere, local models).
 */
export interface EmbeddingModelAdapter {
  generateEmbeddings(texts: string[]): Promise<number[][]>;
}

// chunk-embedding-generator/services/redis-consumer.service.ts
export const DEFAULT_EMBEDDING_GENERATE_QUEUE_NAME = "embedding_generate.queue";
/**
 * Service that delegates to an adapter. When no adapter is set, generateEmbeddings throws.
 */
export class EmbeddingModelService {
  private adapter: EmbeddingModelAdapter | null = null;

  setAdapter(adapter: EmbeddingModelAdapter): void {
    this.adapter = adapter;
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (!this.adapter) {
      throw new Error(
        "EmbeddingModelService: no adapter set. Use setAdapter(openaiAdapter | cohereAdapter | localAdapter)."
      );
    }
    return this.adapter.generateEmbeddings(texts);
  }
}
