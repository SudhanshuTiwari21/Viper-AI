import Redis from "ioredis";

export const GRAPH_UPDATED_CHANNEL = "graph.updated";

export interface GraphUpdatedEvent {
  repo_id: string;
  updated_nodes: number;
  updated_edges: number;
}

export interface GraphEventPublisherOptions {
  url?: string;
  host?: string;
  port?: number;
}

/**
 * Publish graph.updated after storing nodes and edges.
 */
export class GraphEventPublisherService {
  private redis: Redis | null = null;

  constructor(options: GraphEventPublisherOptions = {}) {
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

  async publishGraphUpdated(event: GraphUpdatedEvent): Promise<void> {
    const client = this.getClient();
    await client.publish(GRAPH_UPDATED_CHANNEL, JSON.stringify(event));
  }

  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
  }
}
