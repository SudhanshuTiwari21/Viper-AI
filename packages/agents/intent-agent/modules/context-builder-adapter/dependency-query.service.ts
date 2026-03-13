import type { DependencyEdge } from "./context-builder.types";

// In production this would query the dependency graph store.
// For now it is a thin, easily-mockable abstraction.
export async function getDependencies(symbol: string): Promise<DependencyEdge[]> {
  void symbol;
  return [];
}

