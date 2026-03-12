import type { GraphBuildJob } from "../types/graph-job.types";
import type { GraphEdge, GraphEdgeType } from "../types/graph.types";

const EDGE_TYPES: Set<string> = new Set([
  "CALLS",
  "IMPORTS",
  "EXTENDS",
  "IMPLEMENTS",
  "DEPENDS_ON",
]);

function toEdgeType(t: string): GraphEdgeType {
  if (EDGE_TYPES.has(t)) return t as GraphEdgeType;
  return "CALLS";
}

/**
 * Generate graph edges from job (edges or relationships array).
 */
export function generateEdges(job: GraphBuildJob): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const list = job.edges ?? job.relationships ?? [];

  for (const e of list) {
    const from = (e as { from?: string }).from;
    const to = (e as { to?: string }).to;
    const type = (e as { type?: string }).type;
    const repo_id = (e as { repo_id?: string }).repo_id ?? job.repo_id;
    const file = (e as { file?: string }).file ?? job.file;
    const module = (e as { module?: string }).module ?? job.module;
    if (from && to) {
      edges.push({
        from,
        to,
        type: toEdgeType(type ?? "CALLS"),
        repo_id,
        file,
        module,
      });
    }
  }

  return edges;
}
