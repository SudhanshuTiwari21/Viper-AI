import type { NormalizedGraphNode } from "../types/graph.types";
import type { GraphNode, GraphNodeType } from "../types/graph.types";

/**
 * Create graph nodes from normalized metadata. Ensures node types: function, class, file, module.
 */
export function generateNodes(normalized: NormalizedGraphNode[]): GraphNode[] {
  const nodes: GraphNode[] = [];
  const moduleIds = new Set<string>();

  for (const n of normalized) {
    nodes.push({
      id: n.id,
      type: n.type as GraphNodeType,
      file: n.file,
      module: n.module,
      repo_id: n.repo_id,
      name: n.name,
    });
    const moduleId = `${n.repo_id}:${n.module}:module`;
    if (!moduleIds.has(moduleId)) {
      moduleIds.add(moduleId);
      nodes.push({
        id: moduleId,
        type: "module",
        file: "",
        module: n.module,
        repo_id: n.repo_id,
      });
    }
  }

  return nodes;
}
