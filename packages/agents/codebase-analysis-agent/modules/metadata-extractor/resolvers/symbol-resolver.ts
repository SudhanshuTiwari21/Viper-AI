import type { NormalizedNode, FunctionMetadata, ResolvedSymbol } from "../types/metadata.types";
import { toCanonicalId } from "../types/metadata.types";

/**
 * Index-based context for fast symbol resolution. Use maps for O(1) lookup instead of scanning arrays.
 */
export interface SymbolResolverContext {
  /** Function name → metadata (file, module, repo_id). Enables canonical id resolution. */
  functionsByName: Map<string, FunctionMetadata>;
  /** Imported symbol names (from import metadata). */
  importsByFile: Map<string, string[]>;
  /** Function name → metadata for functions in the same module (other files). Populated when cross-file index is available. */
  moduleFunctions: Map<string, FunctionMetadata>;
}

/**
 * Resolve caller → callee using the index. Returns resolved: true when callee can be located;
 * resolvedTo is the canonical id (repo_id:file:symbol) when available.
 */
export function resolveSymbol(
  caller: string,
  callee: string,
  context: SymbolResolverContext,
  repo_id: string
): ResolvedSymbol {
  const sameFile = context.functionsByName.get(callee);
  if (sameFile && sameFile.file) {
    return {
      caller,
      callee,
      resolved: true,
      location: "same_file",
      resolvedTo: toCanonicalId(repo_id, sameFile.file, sameFile.function),
    };
  }
  const moduleFn = context.moduleFunctions.get(callee);
  if (moduleFn) {
    return {
      caller,
      callee,
      resolved: true,
      location: "same_module",
      resolvedTo: toCanonicalId(repo_id, moduleFn.file, moduleFn.function),
    };
  }
  for (const imports of context.importsByFile.values()) {
    if (imports.includes(callee)) {
      return { caller, callee, resolved: true, location: "imported" };
    }
  }
  return { caller, callee, resolved: false };
}

/**
 * Build index-based context from normalized nodes and optional module-level function metadata.
 * Prefer this over ad-hoc sets so resolution can return canonical ids.
 */
export function buildResolverContext(
  nodes: NormalizedNode[],
  file: string,
  module: string,
  repo_id: string,
  fileImports: string[] = [],
  sameModuleFunctionMetadata: FunctionMetadata[] = []
): SymbolResolverContext {
  const functionsByName = new Map<string, FunctionMetadata>();
  for (const n of nodes) {
    if (n.type === "function" && n.name) {
      functionsByName.set(n.name, {
        function: n.name,
        file,
        module,
        repo_id,
        calls: n.calls,
      });
    }
  }
  const importsByFile = new Map<string, string[]>();
  if (fileImports.length > 0) {
    importsByFile.set(file, fileImports);
  }
  const moduleFunctions = new Map<string, FunctionMetadata>();
  for (const meta of sameModuleFunctionMetadata) {
    moduleFunctions.set(meta.function, meta);
  }
  return { functionsByName, importsByFile, moduleFunctions };
}
