import type { ContextCandidate } from "../candidate-generator/candidate.types.js";
import type { ScoringContext } from "./scoring.types.js";

const RECENCY_BOOST = 0.2;

/**
 * Boost for files recently opened in the IDE. Returns 0 or 0.2.
 */
export function computeRecencyScore(
  candidate: ContextCandidate,
  context: ScoringContext,
): number {
  const file = candidate.file ?? "";
  if (!file) return 0;
  const opened = context.openedFiles ?? [];
  const fileNorm = file.replace(/\\/g, "/");
  for (const o of opened) {
    const oNorm = o.replace(/\\/g, "/");
    if (oNorm === fileNorm) return RECENCY_BOOST;
  }
  return 0;
}
