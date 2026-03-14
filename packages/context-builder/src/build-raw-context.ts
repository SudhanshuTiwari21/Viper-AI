/**
 * Builds a RawContextBundle by calling the Context Builder Adapter and
 * aggregating, normalizing, merging, and deduplicating results.
 * No ranking, filtering, or limiting.
 */

import type {
  ContextRequest,
  RawContextBundle,
  ContextBuilderAdapter,
  AdapterDependencyEdge,
} from "./raw-context.types.js";
import {
  normalizeSymbolResults,
  normalizeEmbeddingResults,
  normalizeDependencyEdges,
  mergeRawContext,
} from "./context-merge.service.js";

/**
 * Build raw context from repo_id, ContextRequest, and adapter.
 * Returns a unified RawContextBundle (no ranking, filtering, or limiting).
 */
export async function buildRawContext(
  repo_id: string,
  request: ContextRequest,
  adapter: ContextBuilderAdapter,
): Promise<RawContextBundle> {
  const symbolTerms = request.symbolSearch ?? [];
  const embeddingTerms = request.embeddingSearch ?? [];
  const dependencyLookup = request.dependencyLookup === true;

  const symbolPromises = symbolTerms.map((term) => adapter.searchSymbols(term));
  const embeddingPromises = embeddingTerms.map((term) =>
    adapter.searchEmbeddings(term),
  );

  const dependencyPromises: Promise<AdapterDependencyEdge[]>[] = [];
  if (dependencyLookup) {
    for (const term of symbolTerms) {
      dependencyPromises.push(adapter.getDependencies(term));
    }
  }

  const [symbolResultsNested, embeddingResultsNested, dependencyResultsNested] =
    await Promise.all([
      Promise.all(symbolPromises),
      Promise.all(embeddingPromises),
      Promise.all(dependencyPromises),
    ]);

  const symbolResultsFlat = symbolResultsNested.flat();
  const embeddingResultsFlat = embeddingResultsNested.flat();
  const dependencyResultsFlat = dependencyResultsNested.flat();

  const { files: filesFromSymbols, functions, classes } =
    normalizeSymbolResults(symbolResultsFlat);
  const embeddings = normalizeEmbeddingResults(embeddingResultsFlat);
  const dependencies = normalizeDependencyEdges(dependencyResultsFlat);

  const bundle = mergeRawContext(repo_id, [
    { files: filesFromSymbols, functions, classes },
    { embeddings },
    { dependencies },
  ]);

  return bundle;
}
