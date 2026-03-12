import type { MetadataJob } from "../types/metadata-job.types";
import type {
  FunctionMetadata,
  ClassMetadata,
  ImportMetadata,
  RelationshipEdge,
} from "../types/metadata.types";
import { validateMetadataJob } from "../validators/metadata-validator";
import { normalizeAst } from "../normalizers/language-normalizer";
import { mapFileToModule } from "../mappers/module-mapper";
import { buildResolverContext } from "../resolvers/symbol-resolver";
import { extractRelationships } from "../extractors/relationship-extractor";
import { MetadataStoreService } from "../services/metadata-store.service";
import { EventPublisherService } from "../services/event-publisher.service";
import { MetadataRedisConsumerService } from "../services/redis-consumer.service";

export interface MetadataExtractionPipelineOptions {
  metadataStore: MetadataStoreService;
  eventPublisher: EventPublisherService;
}

/**
 * Run the full pipeline for one job:
 * Validator → Normalizer → Module Mapper → Symbol Resolver (index) → Relationship Extractor → Store → Publish.
 */
export async function runMetadataPipeline(
  job: MetadataJob,
  options: MetadataExtractionPipelineOptions
): Promise<void> {
  const { metadataStore, eventPublisher } = options;

  const validation = validateMetadataJob(job);
  if (!validation.valid) {
    console.error("[MetadataExtraction] Validation failed, skipping job:", validation.errors);
    return;
  }

  const { file, module: existingModule } = job;
  const { module } = mapFileToModule(file, existingModule);

  const normalized = normalizeAst(job.ast, file);

  const fileImports: string[] = [];
  for (const n of normalized) {
    if (n.type === "import" && n.name) fileImports.push(n.name);
  }
  const resolverContext = buildResolverContext(
    normalized,
    file,
    module,
    job.repo_id,
    fileImports,
    []
  );

  const edges: RelationshipEdge[] = extractRelationships(
    normalized,
    file,
    module,
    job.repo_id,
    resolverContext
  );

  const functions: FunctionMetadata[] = [];
  const classes: ClassMetadata[] = [];
  const imports: string[] = [];

  for (const n of normalized) {
    if (n.type === "function") {
      functions.push({
        function: n.name,
        file,
        module,
        repo_id: job.repo_id,
        calls: n.calls,
      });
    } else if (n.type === "class") {
      classes.push({
        class: n.name,
        file,
        module,
        repo_id: job.repo_id,
        extends: n.target,
      });
    } else if (n.type === "import" && n.name) {
      imports.push(n.name);
    }
  }

  const importRecord: ImportMetadata[] = imports.length
    ? [{ file, module, repo_id: job.repo_id, imports }]
    : [];

  await metadataStore.saveFunctions(functions);
  await metadataStore.saveClasses(classes);
  await metadataStore.saveImports(importRecord);
  await metadataStore.saveRelationships(edges);
  await metadataStore.saveModules([{ file, module, repo_id: job.repo_id }]);

  if (edges.length > 0) {
    await eventPublisher.publishDependencyGraphBuild({
      repo_id: job.repo_id,
      file,
      module,
      edges,
    });
  }
}

export interface StartMetadataExtractionWorkersOptions {
  redis?: { url?: string; host?: string; port?: number };
  queueName?: string;
  metadataStore?: MetadataStoreService;
  eventPublisher?: EventPublisherService;
}

/**
 * Start the metadata extraction worker: consume from Redis, run pipeline per job.
 */
export async function startMetadataExtractionWorkers(
  options: StartMetadataExtractionWorkersOptions = {}
): Promise<{ consumer: MetadataRedisConsumerService }> {
  const consumer =
    options.redis && (options.redis.url || options.redis.host)
      ? new MetadataRedisConsumerService({
          ...options.redis,
          queueName: options.queueName,
        })
      : new MetadataRedisConsumerService({
          queueName: options.queueName,
        });

  const metadataStore = options.metadataStore ?? new MetadataStoreService();
  const eventPublisher =
    options.eventPublisher ?? new EventPublisherService(options.redis);

  const run = (job: MetadataJob) =>
    runMetadataPipeline(job, { metadataStore, eventPublisher });

  void consumer.consumeJobs(run);
  return { consumer };
}
