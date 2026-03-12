import type { GraphBuildJob } from "../types/graph-job.types";
import type { NormalizedGraphNode } from "../types/graph.types";

/**
 * Convert job payload into unified normalized nodes (id, type, file, module).
 * Uses canonical ids from edges and optional functions/classes.
 */
export function normalizeMetadata(job: GraphBuildJob): NormalizedGraphNode[] {
  const seen = new Set<string>();
  const nodes: NormalizedGraphNode[] = [];

  const edges = job.edges ?? job.relationships ?? [];
  for (const e of edges) {
    const from = (e as { from?: string }).from;
    const to = (e as { to?: string }).to;
    if (from && !seen.has(from)) {
      seen.add(from);
      nodes.push(parseCanonicalId(from, job.repo_id, job.file, job.module));
    }
    if (to && !seen.has(to)) {
      seen.add(to);
      nodes.push(parseCanonicalId(to, job.repo_id, job.file, job.module));
    }
  }

  if (job.functions) {
    for (const f of job.functions) {
      const id = `${job.repo_id}:${f.file}:${f.function}`;
      if (!seen.has(id)) {
        seen.add(id);
        nodes.push({
          id,
          type: "function",
          file: f.file,
          module: f.module,
          repo_id: job.repo_id,
          name: f.function,
        });
      }
    }
  }

  if (job.classes) {
    for (const c of job.classes) {
      const id = `${job.repo_id}:${c.file}:${c.class}`;
      if (!seen.has(id)) {
        seen.add(id);
        nodes.push({
          id,
          type: "class",
          file: c.file,
          module: c.module,
          repo_id: job.repo_id,
          name: c.class,
        });
      }
    }
  }

  return nodes;
}

function parseCanonicalId(
  id: string,
  repo_id: string,
  defaultFile: string,
  defaultModule: string
): NormalizedGraphNode {
  const parts = id.split(":");
  if (parts.length >= 3) {
    const r = parts[0];
    const name = parts[parts.length - 1];
    const file = parts.slice(1, -1).join(":");
    const isFile = name === "file" || !name;
    return {
      id,
      type: isFile ? "file" : "function",
      file: file || defaultFile,
      module: defaultModule,
      repo_id: r || repo_id,
      name: isFile ? undefined : name,
    };
  }
  return {
    id,
    type: "function",
    file: defaultFile,
    module: defaultModule,
    repo_id,
    name: id,
  };
}
