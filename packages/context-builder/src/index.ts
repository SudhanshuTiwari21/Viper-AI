export { buildRawContext } from "./build-raw-context.js";
export {
  normalizeSymbolResults,
  normalizeEmbeddingResults,
  normalizeDependencyEdges,
  mergeRawContext,
} from "./context-merge.service.js";
export type {
  ContextRequest,
  ContextBuilderAdapter,
  RawContextBundle,
  FileContext,
  FunctionContext,
  ClassContext,
  EmbeddingMatch,
  DependencyEdge,
  AdapterSymbolSearchResult,
  AdapterEmbeddingMatch,
  AdapterDependencyEdge,
} from "./raw-context.types.js";
