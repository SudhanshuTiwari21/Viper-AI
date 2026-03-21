import type { ExecutionPlan } from "@repo/planner-agent";
import type { ContextBuilderAdapter } from "@repo/context-builder";
import type { ExecutionResult } from "./execution.types";
import { createExecutionContext } from "./execution-context";
import { runStep } from "./step-runner";

export async function executePlan(
  plan: ExecutionPlan,
  opts: {
    repo_id: string;
    query: string;
    adapter: ContextBuilderAdapter;
    workspacePath?: string;
  },
): Promise<ExecutionResult> {
  const ctx = createExecutionContext({ ...opts, plan });

  for (const step of plan.steps) {
    await runStep(step, ctx);
  }

  const lastWithResult = [...ctx.intermediateResults]
    .reverse()
    .find((r) => r.result !== undefined);

  return {
    logs: ctx.logs,
    contextWindow: lastWithResult?.result,
    stepOutputs: ctx.intermediateResults,
  };
}
