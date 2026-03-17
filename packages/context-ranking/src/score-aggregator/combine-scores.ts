import type { ScoredCandidate } from "../scoring-engine/scoring.types.js";
import type { RankedCandidate } from "./score-aggregator.types.js";

export const SCORE_WEIGHTS = {
  embedding: 0.35,
  symbol: 0.25,
  dependency: 0.25,
  fileImportance: 0.1,
  recency: 0.05,
} as const;

/** Sum of weights must be 1.0 */
const WEIGHT_SUM =
  SCORE_WEIGHTS.embedding +
  SCORE_WEIGHTS.symbol +
  SCORE_WEIGHTS.dependency +
  SCORE_WEIGHTS.fileImportance +
  SCORE_WEIGHTS.recency;
if (Math.abs(WEIGHT_SUM - 1) > 1e-9) {
  throw new Error(`SCORE_WEIGHTS must sum to 1.0, got ${WEIGHT_SUM}`);
}

/**
 * Combine signal scores into a single finalScore per candidate.
 * Pure, no mutation, no sorting, no filtering.
 */
export function combineScores(
  candidates: ScoredCandidate[],
  options?: { debug?: boolean },
): RankedCandidate[] {
  const debug = options?.debug ?? false;
  const out: RankedCandidate[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const s = candidates[i]!;
    const finalScore = Math.max(
      0,
      Math.min(
        1,
        SCORE_WEIGHTS.embedding * s.embeddingScore +
          SCORE_WEIGHTS.symbol * s.symbolScore +
          SCORE_WEIGHTS.dependency * s.dependencyScore +
          SCORE_WEIGHTS.fileImportance * s.fileImportanceScore +
          SCORE_WEIGHTS.recency * s.recencyScore,
      ),
    );
    const ranked: RankedCandidate = {
      ...s,
      finalScore,
    };
    if (debug) {
      ranked.debug = {
        embedding: s.embeddingScore,
        symbol: s.symbolScore,
        dependency: s.dependencyScore,
        fileImportance: s.fileImportanceScore,
        recency: s.recencyScore,
      };
    }
    out.push(ranked);
  }
  return out;
}
