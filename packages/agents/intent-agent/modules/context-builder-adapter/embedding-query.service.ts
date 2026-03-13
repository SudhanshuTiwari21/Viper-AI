import type { EmbeddingMatch } from "./context-builder.types";

// In production this would query the vector database.
// For now it is a thin, easily-mockable abstraction.
export async function searchEmbeddings(term: string): Promise<EmbeddingMatch[]> {
  void term;
  return [];
}

