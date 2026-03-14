/**
 * Raw Context Bundle types.
 * This layer does NOT perform ranking, filtering, or limiting.
 * Types represent the normalized, merged, deduplicated candidate pool.
 */

export interface FileContext {
  file: string;
  module?: string;
  language?: string;
}

export interface FunctionContext {
  name: string;
  file: string;
  module?: string;
}

export interface ClassContext {
  name: string;
  file: string;
  module?: string;
}

export interface EmbeddingMatch {
  file: string;
  symbol?: string;
  content: string;
  score: number;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: string;
}

export interface RawContextBundle {
  repo_id: string;
  files: FileContext[];
  functions: FunctionContext[];
  classes: ClassContext[];
  embeddings: EmbeddingMatch[];
  dependencies: DependencyEdge[];
}

/**
 * Request shape for building raw context.
 * Matches the fields produced by Context Request Builder.
 */
export interface ContextRequest {
  symbolSearch?: string[];
  fileSearch?: string[];
  moduleSearch?: string[];
  embeddingSearch?: string[];
  dependencyLookup?: boolean;
}

/**
 * Adapter return types (from Context Builder Adapter).
 * Used to type the adapter interface; actual adapters may return these shapes.
 */
export interface AdapterSymbolSearchResult {
  filePath: string;
  symbolName: string;
  kind: "function" | "class";
}

export interface AdapterEmbeddingMatch {
  text: string;
  score: number;
  file?: string;
  symbol?: string;
}

export interface AdapterDependencyEdge {
  from: string;
  to: string;
  type?: string;
}

/**
 * Adapter interface that this module wraps.
 * Callers (e.g. intent-agent) provide an implementation that talks to the real stores.
 */
export interface ContextBuilderAdapter {
  searchSymbols(term: string): Promise<AdapterSymbolSearchResult[]>;
  searchEmbeddings(term: string): Promise<AdapterEmbeddingMatch[]>;
  getDependencies(symbol: string): Promise<AdapterDependencyEdge[]>;
}
