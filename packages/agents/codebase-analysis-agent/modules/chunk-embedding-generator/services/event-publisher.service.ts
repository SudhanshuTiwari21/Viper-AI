import Redis from "ioredis";

export const INDEX_UPDATED_CHANNEL = "index.updated";
export const DEFAULT_EMBEDDING_GENERATE_QUEUE_NAME = "embedding_generate.queue";
export interface IndexUpdatedEvent {
  repo_id: string;
  indexed_chunks: number;
}

export interface EmbeddingEventPublisherOptions {
  url?: string;
  host?: string;
  port?: number;
}

/**
 * Publish index.updated after storing vectors. Context Builder Engine can subscribe to query embeddings.
 */
export class EmbeddingEventPublisherService {
  private redis: Redis | null = null;

  constructor(options: EmbeddingEventPublisherOptions = {}) {
    if (options.url || options.host) {
      this.redis =
        options.url !== undefined
          ? new Redis(options.url)
          : new Redis(options.port ?? 6379, options.host ?? "localhost");
    }
  }

  setClient(client: Redis): void {
    this.redis = client;
  }

  private getClient(): Redis {
    if (!this.redis) {
      throw new Error(
        "Redis not configured: provide url or host in options, or setClient()"
      );
    }
    return this.redis;
  }

  async publishIndexUpdated(event: IndexUpdatedEvent): Promise<void> {
    const client = this.getClient();
    await client.publish(INDEX_UPDATED_CHANNEL, JSON.stringify(event));
  }

  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
  }
}
