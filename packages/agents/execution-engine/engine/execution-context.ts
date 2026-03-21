import type { ContextBuilderAdapter } from "@repo/context-builder";
import type { ExecutionPlan } from "@repo/planner-agent";
import type { ExecutionContext } from "./execution.types";

export function createExecutionContext(opts: {
  repo_id: string;
  query: string;
  adapter: ContextBuilderAdapter;
  workspacePath?: string;
  plan?: ExecutionPlan;
}): ExecutionContext {
  return {
    repo_id: opts.repo_id,
    query: opts.query,
    adapter: opts.adapter,
    intermediateResults: [],
    logs: [],
    workspacePath: opts.workspacePath,
    plan: opts.plan,
  };
}
