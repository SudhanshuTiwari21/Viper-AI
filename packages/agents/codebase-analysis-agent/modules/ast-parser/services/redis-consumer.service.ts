import Redis from "ioredis";
import type { ASTParseJob } from "../types/ast-job.types";

export const DEFAULT_AST_PARSE_QUEUE_NAME = "ast_parse_queue";

export interface RedisConsumerOptions {
  url?: string;
  host?: string;
  port?: number;
  /** Queue name to consume from. */
  queueName?: string;
  /** Block timeout in seconds when waiting for a job. */
  blockTimeoutSeconds?: number;
}

/**
 * Consumes AST parse jobs from a Redis list via BLPOP.
 * No explicit ack: job is removed when popped; on processing failure caller may re-push for retry.
 */
export class RedisConsumerService {
  private redis: Redis | null = null;
  private readonly options: Required<
    Pick<RedisConsumerOptions, "queueName" | "blockTimeoutSeconds">
  > & RedisConsumerOptions;

  constructor(options: RedisConsumerOptions = {}) {
    this.options = {
      queueName: options.queueName ?? DEFAULT_AST_PARSE_QUEUE_NAME,
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
   * Block until a job is available, then return it. Returns null if timeout is reached.
   */
  async pull(): Promise<ASTParseJob | null> {
    const client = this.getClient();
    const result = await client.blpop(
      this.options.queueName,
      this.options.blockTimeoutSeconds
    );
    if (!result || result.length < 2) return null;
    const [, payload] = result;
    try {
      return JSON.parse(payload) as ASTParseJob;
    } catch {
      return null;
    }
  }

  /**
   * Re-push a job to the front of the queue (e.g. for retry).
   */
  async pushBack(job: ASTParseJob): Promise<void> {
    const client = this.getClient();
    await client.lpush(this.options.queueName, JSON.stringify(job));
  }

  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
  }
}
