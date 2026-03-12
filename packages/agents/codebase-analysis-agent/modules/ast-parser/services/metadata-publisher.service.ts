import Redis from "ioredis";
import type { MetadataExtractRequest } from "../types/ast-parser.types";

export const DEFAULT_METADATA_EXTRACT_QUEUE_NAME = "metadata.extract.request";

export interface MetadataPublisherOptions {
  url?: string;
  host?: string;
  port?: number;
  queueName?: string;
}

/**
 * Publish extracted metadata (and optional serialized AST) to the next stage.
 * Feeds the Metadata Extraction Worker via Redis list (same pattern as Repo Scanner → AST queue).
 */
export class MetadataPublisherService {
  private redis: Redis | null = null;
  private readonly queueName: string;

  constructor(options: MetadataPublisherOptions = {}) {
    this.queueName = options.queueName ?? DEFAULT_METADATA_EXTRACT_QUEUE_NAME;
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
   * Publish one metadata extract request to the queue (RPUSH for FIFO consumption).
   */
  async publish(payload: MetadataExtractRequest): Promise<void> {
    const client = this.getClient();
    await client.rpush(this.queueName, JSON.stringify(payload));
  }

  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
  }
}
