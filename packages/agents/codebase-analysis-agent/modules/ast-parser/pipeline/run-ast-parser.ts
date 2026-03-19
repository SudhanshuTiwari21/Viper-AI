import { RedisConsumerService } from "../services/redis-consumer.service";
import { WorkerScheduler } from "../services/worker-scheduler.service";
import { MetadataPublisherService } from "../services/metadata-publisher.service";
import type { AstStoreService } from "../services/ast-store.service";
import type { EmbeddingRequestJob } from "../workers/ast-worker";

export interface StartASTParserWorkersOptions {
  /** Redis connection. */
  redis?:
    | { url?: string; host?: string; port?: number }
    | RedisConsumerService;
  /** Worker pool size / max concurrency. */
  workerPoolSize?: number;
  /** Retry attempts per job. */
  retryAttempts?: number;
  /** Resolve repo name to filesystem root. */
  getRepoRoot?: (repo: string) => string;
  /** Queue name to consume from. */
  queueName?: string;
  /** If set, workers publish to this queue (metadata.extract.request). Pass Redis config or a MetadataPublisherService instance. */
  metadataPublish?:
    | { url?: string; host?: string; port?: number; queueName?: string }
    | MetadataPublisherService;
  /** If set, workers publish one embedding job per parsed file to embedding_generate.request channel. */
  onEmbeddingRequest?: (job: EmbeddingRequestJob) => Promise<void>;
  /** If set, workers store serialized AST (file_asts). Storage happens inside AST module. */
  astStore?: AstStoreService;
}

/**
 * Start the AST parser workers: create Redis consumer and worker scheduler, then start the loop.
 */
export function startASTParserWorkers(
  options: StartASTParserWorkersOptions = {}
): WorkerScheduler {
  console.log("[Viper] AST: startASTParserWorkers called", {
    redis: options.redis,
    queueName: options.queueName,
    workerPoolSize: options.workerPoolSize,
    retryAttempts: options.retryAttempts,
  });

  const redisConsumer =
    options.redis instanceof RedisConsumerService
      ? options.redis
      : new RedisConsumerService({
          ...(typeof options.redis === "object" && options.redis !== null
            ? options.redis
            : {}),
          queueName: options.queueName,
        });

  const metadataPublisher =
    options.metadataPublish instanceof MetadataPublisherService
      ? options.metadataPublish
      : options.metadataPublish
        ? new MetadataPublisherService(
            typeof options.metadataPublish === "object"
              ? options.metadataPublish
              : {}
          )
        : undefined;

  const scheduler = new WorkerScheduler({
    redisConsumer,
    workerPoolSize: options.workerPoolSize ?? 4,
    maxConcurrency: options.workerPoolSize ?? 4,
    retryAttempts: options.retryAttempts ?? 3,
    getRepoRoot: options.getRepoRoot,
    metadataPublisher,
    onEmbeddingRequest: options.onEmbeddingRequest,
    astStore: options.astStore,
  });

  try {
    console.log("[Viper] AST: starting WorkerScheduler");
    scheduler.start();
    console.log("[Viper] AST: WorkerScheduler started");
  } catch (err) {
    console.error("[Viper] AST: failed to start WorkerScheduler", err);
  }

  return scheduler;
}