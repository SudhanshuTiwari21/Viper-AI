/**
 * Full Codebase Analysis pipeline: scan → optional persist → push jobs to Redis → start workers.
 * Single entry point for "Analyse the Codebase"; backend (or CLI) only calls this.
 */
import { runRepoScanner } from "../modules/repo-scanner/pipeline/scan-repo.pipeline.js";
import type { RunRepoScannerInput, RunRepoScannerOptions, RepoScanPipelineResult } from "../modules/repo-scanner/types/repo-scanner.types.js";
import { RedisQueueService } from "../modules/repo-scanner/services/redis-queue.service.js";
import { startASTParserWorkers } from "../modules/ast-parser/pipeline/run-ast-parser.js";
import { DEFAULT_AST_PARSE_QUEUE_NAME } from "../modules/ast-parser/services/redis-consumer.service.js";
import { startMetadataExtractionWorkers } from "../modules/metadata-extractor/pipeline/run-metadata-extraction.js";
import { startGraphBuilderWorkers } from "../modules/dependency-graph-builder/pipeline/run-graph-builder.js";
import type { GraphStoreService } from "../modules/dependency-graph-builder/services/graph-store.service.js";
import {
  startEmbeddingWorkers,
  EmbeddingModelService,
  createOpenAIEmbeddingAdapter,
} from "../modules/chunk-embedding-generator/index.js";
import type { VectorStoreService } from "../modules/chunk-embedding-generator/services/vector-store.service.js";

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
    const queue = new RedisQueueService(redisConfig);
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
