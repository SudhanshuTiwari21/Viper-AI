import type { ContextCandidate } from "../candidate-generator/candidate.types.js";
import type { ScoringContext } from "./scoring.types.js";

/**
 * Placeholder semantic similarity: string overlap (query words vs content).
 * Only for type = "chunk". Returns 0–1.
 * Later: cosineSimilarity(queryVector, chunkVector).
 */
export function computeEmbeddingScore(
  candidate: ContextCandidate,
  context: ScoringContext,
): number {
  if (candidate.type !== "chunk") return 0;
  const content = candidate.content ?? "";
  const query = (context.query ?? "").trim();
  if (!query) return 0;

  const queryWords = new Set(
    query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 0),
  );
  if (queryWords.size === 0) return 0;

  const contentLower = content.toLowerCase();
  let overlapping = 0;
  for (const word of queryWords) {
    if (contentLower.includes(word)) overlapping += 1;
  }
  return Math.min(1, Math.max(0, overlapping / queryWords.size));
}
