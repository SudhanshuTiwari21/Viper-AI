import type { ContextCandidate } from "../candidate-generator/candidate.types.js";
import type { ScoredCandidate, ScoringContext } from "./scoring.types.js";
import { computeSymbolScore } from "./symbol-score.js";
import { computeEmbeddingScore } from "./embedding-score.js";
import { computeDependencyScore } from "./dependency-score.js";
import { computeFileImportanceScore } from "./file-importance-score.js";
import { computeRecencyScore } from "./recency-score.js";

/**
 * Compute all signal scores for each candidate. No ranking or filtering.
 * Score aggregation happens in a later module.
 */
export function computeCandidateScores(
  candidates: ContextCandidate[],
  context: ScoringContext,
): ScoredCandidate[] {
  const out: ScoredCandidate[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i]!;
    out.push({
      candidate,
      symbolScore: clamp(computeSymbolScore(candidate, context)),
      embeddingScore: clamp(computeEmbeddingScore(candidate, context)),
      dependencyScore: clamp(computeDependencyScore(candidate, context)),
      fileImportanceScore: clamp(computeFileImportanceScore(candidate, context)),
      recencyScore: clamp(computeRecencyScore(candidate, context)),
    });
  }
  return out;
}

function clamp(x: number): number {
  return Math.min(1, Math.max(0, x));
}
