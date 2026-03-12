import type { GraphBuildJob } from "../types/graph-job.types";
import { validateGraphBuildJob } from "../validators/graph-job-validator";
import { normalizeMetadata } from "../normalizers/metadata-normalizer";
import { generateNodes } from "../generators/node-generator";
import { generateEdges } from "../generators/edge-generator";
import { resolveReferences } from "../resolvers/reference-resolver";
import { SymbolIndexService } from "../services/symbol-index.service";
import { GraphStoreService } from "../services/graph-store.service";
import { GraphEventPublisherService } from "../services/event-publisher.service";
import { GraphRedisConsumerService } from "../services/redis-consumer.service";

export interface GraphBuilderPipelineOptions {
  graphStore: GraphStoreService;
  eventPublisher: GraphEventPublisherService;
  symbolIndex?: SymbolIndexService;
}

/**
 * Run the full pipeline for one job:
 * Validator → Normalizer → Node Generator → Symbol Index → Reference Resolver → Edge Generator → Store → Publish.
 */
export async function runGraphBuilderPipeline(
  job: GraphBuildJob,
  options: GraphBuilderPipelineOptions
): Promise<void> {
  const { graphStore, eventPublisher } = options;
  const symbolIndex = options.symbolIndex ?? new SymbolIndexService();

  const validation = validateGraphBuildJob(job);
  if (!validation.valid) {
    console.error("[GraphBuilder] Validation failed, skipping:", validation.errors);
    return;
  }

  const normalized = normalizeMetadata(job);
  const nodes = generateNodes(normalized);
  symbolIndex.buildFromNodeIds(nodes);

  const edges = generateEdges(job);
  const resolvedEdges = resolveReferences(edges, symbolIndex);

  await graphStore.saveNodes(nodes);
  await graphStore.saveEdges(resolvedEdges);

  await eventPublisher.publishGraphUpdated({
    repo_id: job.repo_id,
    updated_nodes: nodes.length,
    updated_edges: resolvedEdges.length,
  });
}

export interface StartGraphBuilderWorkersOptions {
  redis?: { url?: string; host?: string; port?: number };
  graphStore?: GraphStoreService;
  eventPublisher?: GraphEventPublisherService;
}

/**
 * Start the graph builder worker: subscribe to dependency_graph.build, run pipeline per message.
 */
export async function startGraphBuilderWorkers(
  options: StartGraphBuilderWorkersOptions = {}
): Promise<{ consumer: GraphRedisConsumerService }> {
  const consumer =
    options.redis && (options.redis.url || options.redis.host)
      ? new GraphRedisConsumerService(options.redis)
      : new GraphRedisConsumerService();

  const graphStore = options.graphStore ?? new GraphStoreService();
  const eventPublisher =
    options.eventPublisher ?? new GraphEventPublisherService(options.redis);

  const run = (job: GraphBuildJob) =>
    runGraphBuilderPipeline(job, {
      graphStore,
      eventPublisher,
    });

  void consumer.consumeJobs(run);
  return { consumer };
}
