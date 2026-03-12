export { startMetadataExtractionWorkers } from "./pipeline/run-metadata-extraction";
export type {
  StartMetadataExtractionWorkersOptions,
} from "./pipeline/run-metadata-extraction";
export { runMetadataPipeline } from "./pipeline/run-metadata-extraction";
export type { MetadataJob, SerializedASTNode } from "./types/metadata-job.types";
export type {
  NormalizedNode,
  NormalizedNodeType,
  FunctionMetadata,
  ClassMetadata,
  ImportMetadata,
  RelationshipEdge,
  ResolvedSymbol,
} from "./types/metadata.types";
export { MetadataRedisConsumerService } from "./services/redis-consumer.service";
export { MetadataStoreService } from "./services/metadata-store.service";
export { EventPublisherService } from "./services/event-publisher.service";
export { DEFAULT_METADATA_EXTRACT_QUEUE_NAME } from "./services/redis-consumer.service";
export { DEPENDENCY_GRAPH_BUILD_CHANNEL } from "./services/event-publisher.service";
