import type { EmbeddingGenerateJob } from "../types/embedding-job.types";
import { validateEmbeddingJob } from "../validators/embedding-job-validator";
import { extractChunks } from "../extractors/chunk-extractor";
import { batchChunks } from "../processors/batch-processor";
import { formatVectors } from "../processors/vector-formatter";
import { EmbeddingModelService } from "../services/embedding-model.service";
import { VectorStoreService } from "../services/vector-store.service";
import { EmbeddingEventPublisherService } from "../services/event-publisher.service";
import { EmbeddingRedisConsumerService } from "../services/redis-consumer.service";

export interface EmbeddingPipelineOptions {
  embeddingModel: EmbeddingModelService;
  vectorStore: VectorStoreService;
  eventPublisher: EmbeddingEventPublisherService;
  /** Batch size range (default 16–64). */
  batchSize?: { min?: number; max?: number };
}

/**
 * Run the full pipeline for one job:
 * Validator → Chunk Extractor → Batch Processor → Embedding Model → Vector Formatter → Vector Storage → Index Update Publisher.
 */
export async function runEmbeddingPipeline(
  job: EmbeddingGenerateJob,
  options: EmbeddingPipelineOptions
): Promise<void> {
  const validation = validateEmbeddingJob(job);
  if (!validation.valid) {
    console.error("[ChunkEmbedding] Validation failed, skipping:", validation.errors);
    return;
  }

  const chunks = extractChunks(job);
  if (chunks.length === 0) return;

  const batches = batchChunks(chunks, {
    minBatchSize: options.batchSize?.min ?? 16,
    maxBatchSize: options.batchSize?.max ?? 64,
  });

  let totalIndexed = 0;

  for (const batch of batches) {
    const texts = batch.map((c) => c.content);
    const embeddings = await options.embeddingModel.generateEmbeddings(texts);
    const records = formatVectors(batch, embeddings);
    await options.vectorStore.upsertVectors(records);
    totalIndexed += records.length;
  }

  await options.eventPublisher.publishIndexUpdated({
    repo_id: job.repo_id,
    indexed_chunks: totalIndexed,
  });
}

export interface StartEmbeddingWorkersOptions {
  redis?: { url?: string; host?: string; port?: number };
  embeddingModel?: EmbeddingModelService;
  vectorStore?: VectorStoreService;
  eventPublisher?: EmbeddingEventPublisherService;
  batchSize?: { min?: number; max?: number };
}

/**
 * Start embedding workers: subscribe to embedding_generate.request, run pipeline per message.
 */
export async function startEmbeddingWorkers(
  options: StartEmbeddingWorkersOptions = {}
): Promise<{ consumer: EmbeddingRedisConsumerService }> {
  const consumer =
    options.redis && (options.redis.url || options.redis.host)
      ? new EmbeddingRedisConsumerService(options.redis)
      : new EmbeddingRedisConsumerService();

  const embeddingModel = options.embeddingModel ?? new EmbeddingModelService();
  const vectorStore = options.vectorStore ?? new VectorStoreService();
  const eventPublisher =
    options.eventPublisher ??
    new EmbeddingEventPublisherService(options.redis);

  const run = (job: EmbeddingGenerateJob) =>
    runEmbeddingPipeline(job, {
      embeddingModel,
      vectorStore,
      eventPublisher,
      batchSize: options.batchSize,
    });

  void consumer.consumeJobs(run);
  return { consumer };
}
