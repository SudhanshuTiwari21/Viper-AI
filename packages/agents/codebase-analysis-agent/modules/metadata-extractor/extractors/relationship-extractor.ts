import type { NormalizedNode, RelationshipEdge, RelationshipType } from "../types/metadata.types";
import { toCanonicalId } from "../types/metadata.types";
import type { SymbolResolverContext } from "../resolvers/symbol-resolver";
import { resolveSymbol } from "../resolvers/symbol-resolver";

/** Generate a stable edge id for deduplication. */
function edgeId(repo_id: string, file: string, from: string, to: string, type: RelationshipType): string {
  const raw = `${repo_id}:${file}:${from}:${to}:${type}`;
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    h = (h * 31 + raw.charCodeAt(i)) >>> 0;
  }
  return `e${h.toString(36)}`;
}

/**
 * Extract relationships from normalized metadata. Produces edges with canonical node IDs
 * (repo_id:file:symbol) and stable edge ids for the knowledge graph.
 */
export function extractRelationships(
  nodes: NormalizedNode[],
  file: string,
  module: string,
  repo_id: string,
  resolverContext?: SymbolResolverContext
): RelationshipEdge[] {
  const edges: RelationshipEdge[] = [];

  for (const node of nodes) {
    if (node.type === "function" && node.calls) {
      const fromId = toCanonicalId(repo_id, file, node.name);
      for (const callee of node.calls) {
        let toId: string;
        if (resolverContext) {
          const resolved = resolveSymbol(node.name, callee, resolverContext, repo_id);
          toId = resolved.resolvedTo ?? toCanonicalId(repo_id, "", callee);
        } else {
          toId = toCanonicalId(repo_id, "", callee);
        }
        edges.push({
          id: edgeId(repo_id, file, node.name, callee, "CALLS"),
          repo_id,
          from: fromId,
          to: toId,
          type: "CALLS",
          file,
          module,
        });
      }
    }
    if (node.type === "class" && node.target) {
      const fromId = toCanonicalId(repo_id, file, node.name);
      const toId = toCanonicalId(repo_id, "", node.target);
      edges.push({
        id: edgeId(repo_id, file, node.name, node.target, "EXTENDS"),
        repo_id,
        from: fromId,
        to: toId,
        type: "EXTENDS",
        file,
        module,
      });
    }
    if (node.type === "import" && node.name) {
      const fromId = `${repo_id}:${file}:file`;
      const toId = `${repo_id}::${node.name}`;
      edges.push({
        id: edgeId(repo_id, file, file, node.name, "IMPORTS"),
        repo_id,
        from: fromId,
        to: toId,
        type: "IMPORTS",
        file,
        module,
      });
    }
  }

  return edges;
}
