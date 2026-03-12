import Redis from "ioredis";
import type { GraphBuildJob } from "../types/graph-job.types";

export const DEPENDENCY_GRAPH_BUILD_CHANNEL = "dependency_graph.build";

export interface GraphRedisConsumerOptions {
  url?: string;
  host?: string;
  port?: number;
}

/**
 * Subscribe to dependency_graph.build channel and pass each message to the pipeline.
 * Uses Redis SUBSCRIBE (pub/sub); messages are pushed by Metadata Extractor.
 */
export class GraphRedisConsumerService {
  private redis: Redis | null = null;
  private readonly options: GraphRedisConsumerOptions;

  constructor(options: GraphRedisConsumerOptions = {}) {
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
   * Subscribe to dependency_graph.build and run handler for each message.
   * Runs until unsubscribe or disconnect.
   */
  async consumeJobs(handler: (job: GraphBuildJob) => Promise<void>): Promise<void> {
    const client = this.getClient();
    await client.subscribe(DEPENDENCY_GRAPH_BUILD_CHANNEL);

    client.on("message", async (_channel: string, message: string) => {
      try {
        const job = JSON.parse(message) as GraphBuildJob;
        await handler(job);
      } catch (err) {
        if (err instanceof Error) {
          console.error("[GraphBuilder] Job handler error:", err.message);
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
