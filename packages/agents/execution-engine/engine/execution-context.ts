import type { ContextBuilderAdapter } from "@repo/context-builder";
import type { ExecutionPlan } from "@repo/planner-agent";
import type { ExecutionContext, EngineMemorySnapshot, RecordStepFn } from "./execution.types";
import type { OnStreamEvent } from "./stream-events";

export function createExecutionContext(opts: {
  repo_id: string;
  query: string;
  adapter: ContextBuilderAdapter;
  workspacePath?: string;
  plan?: ExecutionPlan;
  onEvent?: OnStreamEvent;
  previewMode?: boolean;
  memory?: EngineMemorySnapshot;
  recordStep?: RecordStepFn;
  iteration?: number;
}): ExecutionContext {
  return {
    repo_id: opts.repo_id,
    query: opts.query,
    adapter: opts.adapter,
    intermediateResults: [],
    logs: [],
    workspacePath: opts.workspacePath,
    plan: opts.plan,
    onEvent: opts.onEvent,
    previewMode: opts.previewMode,
    memory: opts.memory,
    recordStep: opts.recordStep,
    iteration: opts.iteration ?? 0,
  };
}
