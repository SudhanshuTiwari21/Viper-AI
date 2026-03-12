import type { GraphEdge } from "../types/graph.types";
import type { SymbolIndexService } from "../services/symbol-index.service";

/**
 * Resolve references using symbol index, imports, and module structure.
 * Edges from Metadata Extractor already use canonical ids; this step can
 * resolve any remaining symbolic refs or enrich with index lookups.
 */
export function resolveReferences(
  edges: GraphEdge[],
  symbolIndex: SymbolIndexService
): GraphEdge[] {
  const resolved: GraphEdge[] = [];
  for (const e of edges) {
    const fromId = symbolIndex.get(e.from) ?? e.from;
    const toId = symbolIndex.get(e.to) ?? e.to;
    resolved.push({ ...e, from: fromId, to: toId });
  }
  return resolved;
}
