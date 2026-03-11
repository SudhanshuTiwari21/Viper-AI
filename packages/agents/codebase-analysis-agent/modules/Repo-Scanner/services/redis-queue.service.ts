import Redis from "ioredis";
import type { ParseJob } from "../types/repo-scanner.types";

export const DEFAULT_PARSE_QUEUE_NAME = "file.parse.request";

export interface RedisQueueOptions {
  /** Redis URL (e.g. "redis://localhost:6379") or connection options */
  url?: string;
  host?: string;
  port?: number;
}

/**
 * Pushes parse jobs to a Redis list. AST workers consume via BLPOP/BRPOP.
 * Queue name matches the conceptual topic "file.parse.request".
 */
export class RedisQueueService {
  private redis: Redis | null = null;
  private readonly options: RedisQueueOptions;

  constructor(options: RedisQueueOptions = {}) {
    this.options = options;
    if (options.url || options.host) {
      this.redis =
        options.url !== undefined
          ? new Redis(options.url)
          : new Redis(options.port ?? 6379, options.host ?? "localhost");
    }
  }

  /** Use an existing Redis client (e.g. from app context). */
  setClient(client: Redis): void {
    this.redis = client;
  }

  private getClient(): Redis {
    if (!this.redis) {
      throw new Error("Redis not configured: provide url or host in options, or setClient()");
    }
    return this.redis;
  }

  /** Push one job to the queue (RPUSH for FIFO: first in, first out for workers). */
  async push(queueName: string, job: ParseJob): Promise<void> {
    const client = this.getClient();
    await client.rpush(queueName, JSON.stringify(job));
  }

  /** Push many jobs to the queue. Preserves order (first job = first consumed). */
  async pushMany(queueName: string, jobs: ParseJob[]): Promise<void> {
    if (jobs.length === 0) return;
    const client = this.getClient();
    const payloads = jobs.map((job) => JSON.stringify(job));
    await client.rpush(queueName, ...payloads);
  }

  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
  }
}
