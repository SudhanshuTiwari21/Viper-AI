import type { SymbolSearchResult } from "./context-builder.types";

// In production this would query the symbol metadata store (e.g. Postgres).
// For now it is a thin, easily-mockable abstraction.
export async function searchSymbols(term: string): Promise<SymbolSearchResult[]> {
  void term;
  return [];
}

