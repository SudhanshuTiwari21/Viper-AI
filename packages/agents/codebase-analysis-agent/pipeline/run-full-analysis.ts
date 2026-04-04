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
  EMBEDDING_GENERATE_REQUEST_CHANNEL,
} from "../modules/chunk-embedding-generator";
import type { VectorStoreService } from "../modules/chunk-embedding-generator/services/vector-store.service";
import { DEFAULT_METADATA_EXTRACT_QUEUE_NAME } from "../modules/ast-parser/services/metadata-publisher.service";
interface RedisQueueOptions {
  url?: string;
  host?: string;
  port?: number;
}

/**
 * Single-flight init: concurrent chats used to race on `await createRedisClient()` and
 * `!analysisBackgroundWorkersStarted`, spawning duplicate worker pools + leaking Redis clients → SSE "Failed to fetch".
 */
let analysisBackgroundInit: Promise<void> | null = null;
let embeddingPublishRedis: import("ioredis").Redis | null = null;
/** repo_id → workspace root; updated each scan so long-lived workers resolve the correct folder. */
const repoRootById = new Map<string, string>();

async function createRedisClient(options: RedisQueueOptions) {
  const { default: Redis } = await import("ioredis");
  return options.url
    ? new Redis(options.url)
    : new Redis(options.port ?? 6379, options.host ?? "localhost");
}

class InlineRedisQueueService {
  private redis: import("ioredis").Redis | null = null;
  private readonly options: RedisQueueOptions;

  constructor(options: RedisQueueOptions = {}) {
    this.options = options;
  }

  private async getClient(): Promise<import("ioredis").Redis> {
    if (!this.redis) {
      if (!this.options.url && !this.options.host) {
        throw new Error("Redis not configured: provide url or host in options");
      }
      this.redis = await createRedisClient(this.options);
    }
    return this.redis;
  }

  async pushMany(queueName: string, jobs: unknown[]): Promise<void> {
    if (jobs.length === 0) return;
    const client = await this.getClient();
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

  repoRootById.set(input.repo_id, input.workspacePath);

  const redisConfig =
    options.redis && (options.redis.url || options.redis.host) ? options.redis : undefined;

  if (redisConfig) {
    console.log("[Viper] runFullAnalysis: pushing AST jobs", {
      jobs: scanResult.jobs.length,
      redis: redisConfig,
    });

    const queue = new InlineRedisQueueService(redisConfig);
    await queue.pushMany(DEFAULT_AST_PARSE_QUEUE_NAME, scanResult.jobs);
    console.log("[Viper] runFullAnalysis: pushed AST jobs to queue");
    await queue.disconnect();
    console.log("[Viper] runFullAnalysis: disconnected Redis queue client");

    /** True when this request joined an in-flight or completed init (not the creator). */
    const awaitedExistingInit = analysisBackgroundInit !== null;

    analysisBackgroundInit ??= (async () => {
      if (!embeddingPublishRedis) {
        embeddingPublishRedis = await createRedisClient(redisConfig);
      }

      const onEmbeddingRequest = async (job: {
        repo_id: string;
        file: string;
        module: string;
        content: string;
      }) => {
        await embeddingPublishRedis!.publish(
          EMBEDDING_GENERATE_REQUEST_CHANNEL,
          JSON.stringify(job),
        );
      };

      const getRepoRoot =
        options.getRepoRoot ??
        ((repo: string) => {
          const root = repoRootById.get(repo);
          if (root === undefined) {
            console.warn(
              "[Viper] runFullAnalysis: no workspace mapped for repo_id — AST jobs may fail",
              repo,
            );
          }
          return root ?? "";
        });

      console.log("[Viper] runFullAnalysis: starting AST parser workers");
      startASTParserWorkers({
        redis: redisConfig,
        getRepoRoot,
        queueName: DEFAULT_AST_PARSE_QUEUE_NAME,
        metadataPublish: { ...redisConfig, queueName: DEFAULT_METADATA_EXTRACT_QUEUE_NAME },
        onEmbeddingRequest,
      });

      console.log("[Viper] runFullAnalysis: starting metadata extraction workers");
      startMetadataExtractionWorkers({
        redis: redisConfig,
        queueName: DEFAULT_METADATA_EXTRACT_QUEUE_NAME,
      });

      console.log("[Viper] runFullAnalysis: starting graph builder workers");
      startGraphBuilderWorkers({ redis: redisConfig, graphStore: options.graphStore });

      const embeddingModel =
        options.embeddingModel ??
        (() => {
          const svc = new EmbeddingModelService();
          svc.setAdapter(createOpenAIEmbeddingAdapter());
          return svc;
        })();
      console.log("[Viper] runFullAnalysis: starting embedding workers");
      startEmbeddingWorkers({
        redis: redisConfig,
        embeddingModel,
        vectorStore: options.vectorStore,
      });
    })().catch((err) => {
      analysisBackgroundInit = null;
      embeddingPublishRedis = null;
      console.error("[Viper] runFullAnalysis: background worker init failed", err);
      throw err;
    });

    await analysisBackgroundInit;

    if (awaitedExistingInit) {
      console.log(
        "[Viper] runFullAnalysis: awaited shared worker init — skipped duplicate start (jobs were pushed)",
      );
    }
  }

  return { status: "started", scan: scanResult };
}
