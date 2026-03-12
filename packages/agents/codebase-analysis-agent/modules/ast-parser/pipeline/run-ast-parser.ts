import { RedisConsumerService } from "../services/redis-consumer.service";
import { WorkerScheduler } from "../services/worker-scheduler.service";
import { MetadataPublisherService } from "../services/metadata-publisher.service";

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
}

/**
 * Start the AST parser workers: create Redis consumer and worker scheduler, then start the loop.
 */
export function startASTParserWorkers(
  options: StartASTParserWorkersOptions = {}
): WorkerScheduler {
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
  });

  scheduler.start();
  return scheduler;
}
