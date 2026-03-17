/**
 * Full Codebase Analysis pipeline: scan → optional persist → push jobs to Redis → start workers.
 * Single entry point for "Analyse the Codebase"; backend (or CLI) only calls this.
 */
import {runRepoScanner} from "../modules/repo-scanner/pipeline/scan-repo.pipeline";
import type { RunRepoScannerInput, RunRepoScannerOptions, RepoScanPipelineResult } from "../modules/repo-scanner/types/repo-scanner.types";
import { startASTParserWorkers } from "../modules/ast-parser/pipeline/run-ast-parser";
import { DEFAULT_AST_PARSE_QUEUE_NAME } from "../modules/ast-parser/services/redis-consumer.service";
import { startMetadataExtractionWorkers } from "../modules/metadata-extractor/pipeline/run-metadata-extraction";
import { startGraphBuilderWorkers } from "../modules/dependency-graph-builder/pipeline/run-graph-builder";
import type { GraphStoreService } from "../modules/dependency-graph-builder/services/graph-store.service";
import {
  startEmbeddingWorkers,
  EmbeddingModelService,
  createOpenAIEmbeddingAdapter,
} from "../modules/chunk-embedding-generator";
import type { VectorStoreService } from "../modules/chunk-embedding-generator/services/vector-store.service";
interface RedisQueueOptions {
  url?: string;
  host?: string;
  port?: number;
}

class InlineRedisQueueService {
  private redis: import("ioredis").Redis | null = null;
  private readonly options: RedisQueueOptions;

  constructor(options: RedisQueueOptions = {}) {
    this.options = options;
    if (options.url || options.host) {
      const { default: Redis } = require("ioredis") as typeof import("ioredis");
      this.redis =
        options.url !== undefined
          ? new Redis(options.url)
          : new Redis(options.port ?? 6379, options.host ?? "localhost");
    }
  }

  private getClient(): import("ioredis").Redis {
    if (!this.redis) {
      throw new Error("Redis not configured: provide url or host in options");
    }
    return this.redis;
  }

  async pushMany(queueName: string, jobs: unknown[]): Promise<void> {
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

export interface RunFullAnalysisOptions {
  /** Redis URL or host/port. If provided, scan jobs are pushed and workers are started. */
  redis?: { url?: string; host?: string; port?: number };
  /** If provided, repo + file metadata are persisted (e.g. to Postgres). */
  persistMetadata?: RunRepoScannerOptions["persistMetadata"];
  /** If provided, dependency graph is persisted (e.g. to Postgres). */
  graphStore?: GraphStoreService;
  /** If provided, embeddings are persisted (e.g. to Qdrant). */
  vectorStore?: VectorStoreService;
  /** Resolve repo_id to workspace path for AST workers (read file contents). */
  getRepoRoot?: (repo: string) => string;
  /** Embedding model. If not set, a default OpenAI adapter is used (requires OPENAI_API_KEY). */
  embeddingModel?: EmbeddingModelService;
}

export interface RunFullAnalysisResult {
  status: "started";
  scan: RepoScanPipelineResult;
}

/**
 * Run the full pipeline: Repo Scanner → (optional persist) → push jobs to Redis → start all workers.
 * Call this from the backend for "Analyse the Codebase". Workers run in the background.
 */
export async function runFullAnalysis(
  input: RunRepoScannerInput,
  options: RunFullAnalysisOptions = {}
): Promise<RunFullAnalysisResult> {
  const scanResult = await runRepoScanner(input, {
    persistMetadata: options.persistMetadata,
  });

  const redisConfig =
    options.redis && (options.redis.url || options.redis.host) ? options.redis : undefined;

  if (redisConfig) {
    const queue = new InlineRedisQueueService(redisConfig);
    await queue.pushMany(DEFAULT_AST_PARSE_QUEUE_NAME, scanResult.jobs);
    await queue.disconnect();

    const getRepoRoot = options.getRepoRoot ?? (() => input.workspacePath);
    startASTParserWorkers({ redis: redisConfig, getRepoRoot });
    startMetadataExtractionWorkers({ redis: redisConfig });
    startGraphBuilderWorkers({ redis: redisConfig, graphStore: options.graphStore });

    const embeddingModel =
      options.embeddingModel ??
      (() => {
        const svc = new EmbeddingModelService();
        svc.setAdapter(createOpenAIEmbeddingAdapter());
        return svc;
      })();
    startEmbeddingWorkers({
      redis: redisConfig,
      embeddingModel,
      vectorStore: options.vectorStore,
    });
  }

  return { status: "started", scan: scanResult };
}
