import type { NormalizedNode } from "../types/metadata.types";
import type { ResolvedSymbol } from "../types/metadata.types";

export interface SymbolResolverContext {
  /** Functions in the same file: name → true */
  sameFileFunctions: Set<string>;
  /** Imported symbols (from import metadata). */
  importedSymbols: Set<string>;
  /** Functions in the same module (other files). */
  sameModuleFunctions: Set<string>;
}

/**
 * Resolve references between symbols: same file, imported, or same module.
 * Returns resolved: true when callee can be located; false otherwise.
 */
export function resolveSymbol(
  caller: string,
  callee: string,
  context: SymbolResolverContext
): ResolvedSymbol {
  if (context.sameFileFunctions.has(callee)) {
    return { caller, callee, resolved: true, location: "same_file" };
  }
  if (context.importedSymbols.has(callee)) {
    return { caller, callee, resolved: true, location: "imported" };
  }
  if (context.sameModuleFunctions.has(callee)) {
    return { caller, callee, resolved: true, location: "same_module" };
  }
  return { caller, callee, resolved: false };
}

/**
 * Build context from normalized nodes and optional module-level function list.
 */
export function buildResolverContext(
  nodes: NormalizedNode[],
  fileImports: string[],
  sameModuleFunctionNames: string[] = []
): SymbolResolverContext {
  const sameFileFunctions = new Set<string>();
  for (const n of nodes) {
    if (n.type === "function" && n.name) sameFileFunctions.add(n.name);
  }
  const importedSymbols = new Set(fileImports);
  const sameModuleFunctions = new Set(sameModuleFunctionNames);
  return { sameFileFunctions, importedSymbols, sameModuleFunctions };
}
