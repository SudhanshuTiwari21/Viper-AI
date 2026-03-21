import type { ContextBuilderAdapter } from "@repo/context-builder";
import type { ContextWindow } from "@repo/context-ranking";
import type { ExecutionPlan } from "@repo/planner-agent";

export interface ExecutionContext {
  repo_id: string;
  query: string;
  adapter: ContextBuilderAdapter;
  intermediateResults: StepOutput[];
  logs: string[];
  workspacePath?: string;
  plan?: ExecutionPlan;
}

export interface StepOutput {
  stepId: string;
  stepType: string;
  result?: ContextWindow;
}

export interface ExecutionResult {
  logs: string[];
  contextWindow?: ContextWindow;
  stepOutputs: StepOutput[];
}
