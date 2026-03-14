/**
 * Simple heuristic: tokens ≈ characters / 4.
 * Sufficient for packing; can be replaced with tiktoken later.
 */
export function estimateTokens(text: string): number {
  if (!text || text.length === 0) return 0;
  return Math.ceil(text.length / 4);
}
