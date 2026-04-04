import type { ASTParseJob } from "../types/ast-job.types";
import type { SerializedAST } from "../types/ast-parser.types";
import { RedisConsumerService } from "./redis-consumer.service";
import { ASTWorker } from "../workers/ast-worker";
import type { MetadataPublisherService } from "./metadata-publisher.service";
import type { AstStoreService } from "./ast-store.service";
import type { EmbeddingRequestJob } from "../workers/ast-worker";

export interface WorkerSchedulerOptions {
  redisConsumer: RedisConsumerService;
  /** Number of worker slots (concurrent jobs). */
  workerPoolSize?: number;
  /** Max concurrent parsing tasks (defaults to workerPoolSize). */
  maxConcurrency?: number;
  /** Retry attempts for a failed job before giving up. */
  retryAttempts?: number;
  /** Resolve repo name to filesystem root (e.g. for reading file content). */
  getRepoRoot?: (repo: string) => string;
  /** If set, worker publishes extracted metadata + serialized AST to next stage. */
  metadataPublisher?: MetadataPublisherService;
  /** If set, worker publishes one embedding job per file to embedding_generate.request. */
  onEmbeddingRequest?: (job: EmbeddingRequestJob) => Promise<void>;
  /** If set, worker stores serialized AST (file_asts). */
  astStore?: AstStoreService;
}

/**
 * Consumes jobs from Redis, enforces concurrency via a worker pool,
 * and dispatches to AST workers. Handles retries on failure.
 */
export class WorkerScheduler {
  private readonly redisConsumer: RedisConsumerService;
  private readonly workerPoolSize: number;
  private readonly maxConcurrency: number;
  private readonly retryAttempts: number;
  private readonly getRepoRoot: (repo: string) => string;
  private running = 0;
  private stopped = false;
  private worker: ASTWorker;

  constructor(options: WorkerSchedulerOptions) {
    this.redisConsumer = options.redisConsumer;
    this.workerPoolSize = options.workerPoolSize ?? 4;
    this.maxConcurrency = options.maxConcurrency ?? this.workerPoolSize;
    this.retryAttempts = options.retryAttempts ?? 3;
    this.getRepoRoot =
      options.getRepoRoot ?? ((repo: string) => `/repos/${repo}`);
    this.worker = new ASTWorker({
      getRepoRoot: this.getRepoRoot,
      metadataPublisher: options.metadataPublisher,
      onEmbeddingRequest: options.onEmbeddingRequest,
      astStore: options.astStore,
    });
  }

  /**
   * Start the scheduler loop: pull from Redis, assign to pool, process.
   */
  start(): void {
    this.stopped = false;
    this.runLoop();
  }

  stop(): void {
    this.stopped = true;
  }

  /**
   * Main loop: pull job from Redis, add to effective queue, process if worker available.
   */
  private async runLoop(): Promise<void> {
    while (!this.stopped) {
      if (this.running >= this.maxConcurrency) {
        await this.sleep(100);
        continue;
      }
      const job = await this.redisConsumer.pull();
      if (!job) continue;
      this.scheduleJob(job);
    }
  }

  /**
   * Schedule a job for processing (non-blocking). Concurrency is enforced by runLoop.
   */
  private scheduleJob(job: ASTParseJob): void {
    if (this.running >= this.maxConcurrency) {
      this.redisConsumer.pushBack(job).catch(() => {});
      return;
    }
    this.running += 1;
    this.processJob(job, 0);
  }

  /**
   * Execute one job via the worker pool. On failure, retry or push back.
   */
  private async processJob(job: ASTParseJob, attempt: number): Promise<void> {
    try {
      const result = await this.worker.run(job);
      this.onJobSuccess(job, result);
    } catch (err) {
      this.handleFailure(job, attempt, err);
    } finally {
      this.running = Math.max(0, this.running - 1);
    }
  }

  private onJobSuccess(
    _job: ASTParseJob,
    _result: SerializedAST | SerializedAST[]
  ): void {
    // Acknowledged by not re-pushing. Downstream can persist result here.
  }

  /**
   * On failure: retry up to retryAttempts, then drop (or push to DLQ in future).
   */
  private handleFailure(
    job: ASTParseJob,
    attempt: number,
    err: unknown
  ): void {
    if (attempt < this.retryAttempts) {
      this.redisConsumer.pushBack(job).catch(() => {});
      return;
    }
    // Optional: log or send to dead-letter
    if (err instanceof Error) {
      console.error(`[WorkerScheduler] Job failed after ${attempt + 1} attempts:`, job, err.message);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
