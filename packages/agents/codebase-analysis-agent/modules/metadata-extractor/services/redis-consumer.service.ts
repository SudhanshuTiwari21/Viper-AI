import Redis from "ioredis";
import type { MetadataJob } from "../types/metadata-job.types";

export const DEFAULT_METADATA_EXTRACT_QUEUE_NAME = "metadata_extract_queue";

export interface MetadataRedisConsumerOptions {
  url?: string;
  host?: string;
  port?: number;
  queueName?: string;
  blockTimeoutSeconds?: number;
}

/**
 * Consumes metadata extraction jobs from a Redis list via BLPOP.
 * Passes each job to the handler; job is removed when popped (ack by successful processing).
 */
export class MetadataRedisConsumerService {
  private redis: Redis | null = null;
  private readonly options: Required<
    Pick<MetadataRedisConsumerOptions, "queueName" | "blockTimeoutSeconds">
  > & MetadataRedisConsumerOptions;

  constructor(options: MetadataRedisConsumerOptions = {}) {
    this.options = {
      queueName: options.queueName ?? DEFAULT_METADATA_EXTRACT_QUEUE_NAME,
      blockTimeoutSeconds: options.blockTimeoutSeconds ?? 5,
      ...options,
    };
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

  getQueueName(): string {
    return this.options.queueName;
  }

  /**
   * Pull one job from the queue. Returns null on timeout.
   */
  async pull(): Promise<MetadataJob | null> {
    const client = this.getClient();
    const result = await client.blpop(
      this.options.queueName,
      this.options.blockTimeoutSeconds
    );
    if (!result || result.length < 2) return null;
    const [, payload] = result;
    try {
      return JSON.parse(payload) as MetadataJob;
    } catch {
      return null;
    }
  }

  /**
   * Consume jobs in a loop and pass each to the handler. Runs until stopped.
   */
  async consumeJobs(
    handler: (job: MetadataJob) => Promise<void>
  ): Promise<void> {
    while (true) {
      const job = await this.pull();
      if (!job) continue;
      try {
        await handler(job);
      } catch (err) {
        if (err instanceof Error) {
          console.error("[MetadataRedisConsumer] Job failed:", err.message);
        }
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
  }
}
