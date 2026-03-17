import type { ContextCandidate } from "../candidate-generator/candidate.types.js";

export interface ScoredCandidate {
  candidate: ContextCandidate;
  symbolScore: number;
  embeddingScore: number;
  dependencyScore: number;
  fileImportanceScore: number;
  recencyScore: number;
}

export interface ScoringContext {
  query: string;
  entities: string[];
  rawContext: {
    dependencies?: Array<{ from: string; to: string; type: string }>;
  };
  openedFiles?: string[];
}
