import Redis from "ioredis";
import type { RelationshipEdge } from "../types/metadata.types";

export const DEPENDENCY_GRAPH_BUILD_CHANNEL = "dependency_graph.build";

/**
 * Event payload includes file and module so the graph builder can update incrementally.
 */
export interface DependencyGraphBuildEvent {
  repo_id: string;
  file: string;
  module: string;
  edges: RelationshipEdge[];
}

export interface EventPublisherOptions {
  url?: string;
  host?: string;
  port?: number;
}

/**
 * Publish events for downstream (e.g. Dependency Graph Builder).
 * MVP: Redis pub/sub. Payload includes file and module for incremental updates.
 */
export class EventPublisherService {
  private redis: Redis | null = null;

  constructor(options: EventPublisherOptions = {}) {
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
   * Publish dependency_graph.build event (Redis PUBLISH).
   */
  async publishDependencyGraphBuild(event: DependencyGraphBuildEvent): Promise<void> {
    const client = this.getClient();
    await client.publish(
      DEPENDENCY_GRAPH_BUILD_CHANNEL,
      JSON.stringify(event)
    );
  }

  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
  }
}
