import type { ContextRequest } from "../context-request-builder/context-request.types";

export interface DependencyEdge {
  from: string;
  to: string;
}

export interface EmbeddingMatch {
  text: string;
  score: number;
}

export interface SymbolSearchResult {
  filePath: string;
  symbolName: string;
  kind: "function" | "class";
}

export interface ContextBundle {
  files?: string[];
  functions?: string[];
  classes?: string[];
  dependencies?: DependencyEdge[];
  embeddingMatches?: EmbeddingMatch[];
}

export type { ContextRequest };

