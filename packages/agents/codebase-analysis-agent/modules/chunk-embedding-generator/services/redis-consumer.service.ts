import Redis from "ioredis";
import type { EmbeddingGenerateJob } from "../types/embedding-job.types";

export const EMBEDDING_GENERATE_REQUEST_CHANNEL = "embedding_generate.request";

export interface EmbeddingRedisConsumerOptions {
  url?: string;
  host?: string;
  port?: number;
}

/**
 * Subscribe to embedding_generate.request, receive jobs, parse JSON, send to pipeline.
 */
export class EmbeddingRedisConsumerService {
  private redis: Redis | null = null;
  private readonly options: EmbeddingRedisConsumerOptions;

  constructor(options: EmbeddingRedisConsumerOptions = {}) {
    this.options = options;
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

  /**
   * Subscribe to embedding_generate.request and run handler for each message.
   */
  async consumeJobs(
    handler: (job: EmbeddingGenerateJob) => Promise<void>
  ): Promise<void> {
    const client = this.getClient();
    await client.subscribe(EMBEDDING_GENERATE_REQUEST_CHANNEL);

    client.on("message", async (_channel: string, message: string) => {
      try {
        const job = JSON.parse(message) as EmbeddingGenerateJob;
        await handler(job);
      } catch (err) {
        if (err instanceof Error) {
          console.error("[ChunkEmbedding] Job handler error:", err.message);
        }
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
  }
}
