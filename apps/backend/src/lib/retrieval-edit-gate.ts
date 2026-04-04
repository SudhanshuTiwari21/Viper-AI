/**
 * B.7 — Pure predicate for retrieval-confidence edit gating.
 * When `threshold <= 0`, the feature is off (no block).
 */
export function shouldBlockEditForRetrievalConfidence(
  overall: number,
  threshold: number,
): boolean {
  return threshold > 0 && overall < threshold;
}
