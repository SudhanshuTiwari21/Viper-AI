import type { ContextRequest } from "../context-request-builder/context-request.types";
import type {
  ContextBundle,
  DependencyEdge,
  EmbeddingMatch,
  SymbolSearchResult,
} from "./context-builder.types";
import { searchSymbols } from "./symbol-query.service";
import { searchEmbeddings } from "./embedding-query.service";
import { getDependencies } from "./dependency-query.service";

export async function buildContext(
  request: ContextRequest,
): Promise<ContextBundle> {
  const files = new Set<string>();
  const functions = new Set<string>();
  const classes = new Set<string>();
  const dependencies: DependencyEdge[] = [];
  const embeddingMatches: EmbeddingMatch[] = [];

  const symbolTerms = request.symbolSearch ?? [];
  const embeddingTerms = request.embeddingSearch ?? [];

  const symbolPromises = symbolTerms.map((term) => searchSymbols(term));
  const embeddingPromises = embeddingTerms.map((term) => searchEmbeddings(term));

  const dependencyPromises: Promise<DependencyEdge[]>[] = [];
  if (request.dependencyLookup) {
    for (const term of symbolTerms) {
      dependencyPromises.push(getDependencies(term));
    }
  }

  const [symbolResultsNested, embeddingResultsNested, dependencyResultsNested] =
    await Promise.all([
      Promise.all(symbolPromises),
      Promise.all(embeddingPromises),
      Promise.all(dependencyPromises),
    ]);

  for (const symbolResults of symbolResultsNested) {
    collectSymbolResults(symbolResults, files, functions, classes);
  }

  for (const embeddingResults of embeddingResultsNested) {
    for (const match of embeddingResults) {
      embeddingMatches.push(match);
    }
  }

  for (const deps of dependencyResultsNested) {
    for (const edge of deps) {
      dependencies.push(edge);
    }
  }

  const bundle: ContextBundle = {};

  if (files.size) bundle.files = [...files];
  if (functions.size) bundle.functions = [...functions];
  if (classes.size) bundle.classes = [...classes];
  if (dependencies.length) bundle.dependencies = dependencies;
  if (embeddingMatches.length) bundle.embeddingMatches = embeddingMatches;

  return bundle;
}

function collectSymbolResults(
  results: SymbolSearchResult[],
  files: Set<string>,
  functions: Set<string>,
  classes: Set<string>,
): void {
  for (const result of results) {
    if (result.filePath) {
      files.add(result.filePath);
    }
    if (result.kind === "function") {
      functions.add(result.symbolName);
    } else if (result.kind === "class") {
      classes.add(result.symbolName);
    }
  }
}

