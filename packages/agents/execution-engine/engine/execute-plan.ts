import type { ExecutionPlan } from "@repo/planner-agent";
import type { ContextBuilderAdapter } from "@repo/context-builder";
import type { ExecutionResult, EngineMemorySnapshot, RecordStepFn } from "./execution.types";
import type { OnStreamEvent } from "./stream-events";
import { createExecutionContext } from "./execution-context";
import { runStep } from "./step-runner";

export async function executePlan(
  plan: ExecutionPlan,
  opts: {
    repo_id: string;
    query: string;
    adapter: ContextBuilderAdapter;
    workspacePath?: string;
    onEvent?: OnStreamEvent;
    previewMode?: boolean;
    memory?: EngineMemorySnapshot;
    recordStep?: RecordStepFn;
    /** Autonomous loop pass index (default 0). Threaded into ctx for tools. */
    iteration?: number;
  },
): Promise<ExecutionResult> {
  const iteration = opts.iteration ?? 0;
  const ctx = createExecutionContext({ ...opts, plan, iteration });

  for (const step of plan.steps) {
    const start = Date.now();
    ctx.onEvent?.({
      type: "step:start",
      data: { stepId: step.id, stepType: step.type, iteration },
    });
    ctx.recordStep?.(step.id, step.type, "started");

    await runStep(step, ctx);

    const durationMs = Date.now() - start;
    ctx.onEvent?.({
      type: "step:complete",
      data: {
        stepId: step.id,
        stepType: step.type,
        durationMs,
      },
    });
    ctx.recordStep?.(step.id, step.type, "completed", durationMs);
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
