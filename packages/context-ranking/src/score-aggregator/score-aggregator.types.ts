import type { ScoredCandidate } from "../scoring-engine/scoring.types.js";

export interface RankedCandidate extends ScoredCandidate {
  finalScore: number;
  /** Optional breakdown for debugging ranking in developer tools. */
  debug?: {
    embedding: number;
    symbol: number;
    dependency: number;
    fileImportance: number;
    recency: number;
  };
}
