import type { ContextCandidate } from "../candidate-generator/candidate.types.js";
import type { ScoringContext } from "./scoring.types.js";

/**
 * Boost candidates close to relevant symbols in the dependency graph.
 * dependencyScore = 1 / (distance + 1). Returns 0 if no path.
 */
export function computeDependencyScore(
  candidate: ContextCandidate,
  context: ScoringContext,
): number {
  const deps = context.rawContext?.dependencies ?? [];
  if (deps.length === 0) return 0;

  const node = candidate.symbol ?? candidate.file ?? "";
  if (!node) return 0;

  const entities = context.entities ?? [];
  if (entities.length === 0) return 0;

  const distance = graphDistance(node, entities, deps);
  if (distance === -1) return 0;
  return 1 / (distance + 1);
}

function graphDistance(
  target: string,
  sources: string[],
  edges: Array<{ from: string; to: string }>,
): number {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from)!.push(e.to);
    if (!adj.has(e.to)) adj.set(e.to, []);
    adj.get(e.to)!.push(e.from);
  }

  const visited = new Set<string>();
  const queue: Array<{ node: string; dist: number }> = [];
  for (const s of sources) {
    if (s) queue.push({ node: s, dist: 0 });
  }
  while (queue.length > 0) {
    const { node, dist } = queue.shift()!;
    if (node === target) return dist;
    if (visited.has(node)) continue;
    visited.add(node);
    for (const next of adj.get(node) ?? []) {
      if (!visited.has(next)) queue.push({ node: next, dist: dist + 1 });
    }
  }
  return -1;
}
