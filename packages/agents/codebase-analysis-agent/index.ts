/**
 * Codebase Analysis Agent — public API.
 * Orchestrates repo scanning, AST parsing, metadata extraction, dependency graph, and embeddings.
 */

// Repo Scanner: scan workspace, classify files, produce parse jobs
export {
  runRepoScanner,
  repoMetadataStoreService,
  resolveWorkspace,
  RepoMetadataStoreService,
  WorkspaceNotFoundError,
} from "./modules/repo-scanner";
export type {
  RepoMetadataStoreAdapter,
  RepoScanWorkspaceResult,
  RepoScanResult,
  RepoScanPipelineResult,
  ScannedFileEntry,
  ParseJob,
  PersistMetadataAdapter,
  RunRepoScannerInput,
  RunRepoScannerOptions,
  WorkspaceInput,
} from "./modules/repo-scanner";

// AST Parser: parse source files, extract structure, publish metadata jobs
export {
  startASTParserWorkers,
  WorkerScheduler,
  RedisConsumerService,
  MetadataPublisherService,
  AstStoreService,
  SUPPORTED_LANGUAGES,
  isTreeSitterSupported,
  getParserForLanguage,
  DEFAULT_AST_PARSE_QUEUE_NAME,
  DEFAULT_METADATA_EXTRACT_QUEUE_NAME,
} from "./modules/ast-parser";
export type {
  StartASTParserWorkersOptions,
  ASTParseJob,
  ASTNode,
  ParsedFile,
  SerializedAST,
  ExtractedMetadata,
  FunctionMetadata,
  MetadataExtractRequest,
  SupportedLanguageKey,
} from "./modules/ast-parser";

// Metadata Extractor: normalize AST, build relationships, emit graph build events
export {
  startMetadataExtractionWorkers,
  runMetadataPipeline,
  MetadataRedisConsumerService,
  MetadataStoreService,
  EventPublisherService,
  toCanonicalId,
  DEPENDENCY_GRAPH_BUILD_CHANNEL,
} from "./modules/metadata-extractor";
export type {
  StartMetadataExtractionWorkersOptions,
  MetadataJob,
  SerializedASTNode,
  NormalizedNode,
  NormalizedNodeType,
  RelationshipType,
  ClassMetadata,
  ImportMetadata,
  RelationshipEdge,
  ResolvedSymbol,
  DependencyGraphBuildEvent,
} from "./modules/metadata-extractor";
export type { FunctionMetadata as MetadataFunctionMetadata } from "./modules/metadata-extractor/types/metadata.types";

// Dependency Graph Builder: consume metadata events, build graph, persist
export {
  startGraphBuilderWorkers,
  runGraphBuilderPipeline,
  GraphRedisConsumerService,
  GraphStoreService,
  GraphEventPublisherService,
  SymbolIndexService,
  PostgresGraphStoreAdapter,
  GRAPH_UPDATED_CHANNEL,
} from "./modules/dependency-graph-builder";
export type {
  StartGraphBuilderWorkersOptions,
  GraphBuilderPipelineOptions,
  GraphBuildJob,
  IncomingRelationshipEdge,
  GraphNode,
  GraphEdge,
  GraphNodeType,
  GraphEdgeType,
  NormalizedGraphNode,
  GraphStoreAdapter,
  PgQueryClient,
} from "./modules/dependency-graph-builder";

// Chunk Embedding Generator: chunk code, compute embeddings, index
export {
  startEmbeddingWorkers,
  runEmbeddingPipeline,
  EmbeddingRedisConsumerService,
  EmbeddingModelService,
  VectorStoreService,
  EmbeddingEventPublisherService,
  EMBEDDING_GENERATE_REQUEST_CHANNEL,
  INDEX_UPDATED_CHANNEL,
} from "./modules/chunk-embedding-generator";
export type {
  StartEmbeddingWorkersOptions,
  EmbeddingPipelineOptions,
  EmbeddingGenerateJob,
  Chunk,
  ChunkType,
  VectorRecord,
  EmbeddingModelAdapter,
  VectorStoreAdapter,
  IndexUpdatedEvent,
} from "./modules/chunk-embedding-generator";

// Tools
export {
  cloneRepository,
  pullRepository,
  checkoutBranch,
} from "./tools/git-tool";
