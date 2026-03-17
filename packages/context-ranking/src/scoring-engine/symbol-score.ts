import type { ContextCandidate } from "../candidate-generator/candidate.types.js";
import type { ScoringContext } from "./scoring.types.js";

/**
 * Score similarity between entity names and candidate symbol.
 * Only for type = "function" or "class". Returns 0–1.
 */
export function computeSymbolScore(
  candidate: ContextCandidate,
  context: ScoringContext,
): number {
  if (candidate.type !== "function" && candidate.type !== "class") {
    return 0;
  }
  const symbol = candidate.symbol ?? "";
  if (!symbol) return 0;

  const entities = context.entities ?? [];
  if (entities.length === 0) return 0;

  let best = 0;
  const symbolLower = symbol.toLowerCase();
  for (const entity of entities) {
    const entityLower = entity.toLowerCase();
    if (symbolLower === entityLower) {
      best = Math.max(best, 1.0);
    } else if (symbolLower.includes(entityLower) || entityLower.includes(symbolLower)) {
      best = Math.max(best, 0.8);
    } else if (weakMatch(symbolLower, entityLower)) {
      best = Math.max(best, 0.4);
    }
  }
  return Math.min(1, Math.max(0, best));
}

function weakMatch(symbol: string, entity: string): boolean {
  if (!entity || !symbol) return false;
  const symWords = symbol.replace(/([A-Z])/g, " $1").trim().toLowerCase().split(/\s+/);
  const entityWords = entity.split(/\s+/).map((w) => w.toLowerCase());
  for (const ew of entityWords) {
    if (symWords.some((sw) => sw.includes(ew) || ew.includes(sw))) return true;
  }
  return false;
}
