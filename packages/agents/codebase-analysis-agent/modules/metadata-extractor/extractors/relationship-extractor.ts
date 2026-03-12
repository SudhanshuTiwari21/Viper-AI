import type { NormalizedNode } from "../types/metadata.types";
import type { RelationshipEdge } from "../types/metadata.types";

/**
 * Extract relationships from normalized metadata for dependency graph.
 * Function → calls → Function; File → imports → File; Class → extends → Class; Module → depends_on → Module.
 */
export function extractRelationships(
  nodes: NormalizedNode[],
  file: string,
  module: string,
  repo_id: string
): RelationshipEdge[] {
  const edges: RelationshipEdge[] = [];

  for (const node of nodes) {
    if (node.type === "function" && node.calls) {
      for (const callee of node.calls) {
        edges.push({
          from: node.name,
          to: callee,
          type: "calls",
          file,
          repo_id,
        });
      }
    }
    if (node.type === "class" && node.target) {
      edges.push({
        from: node.name,
        to: node.target,
        type: "extends",
        file,
        repo_id,
      });
    }
    if (node.type === "import" && node.target) {
      edges.push({
        from: file,
        to: node.target,
        type: "imports",
        file,
        repo_id,
      });
    }
  }

  return edges;
}
