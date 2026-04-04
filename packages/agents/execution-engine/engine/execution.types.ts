import type { ContextBuilderAdapter } from "@repo/context-builder";
import type { ContextWindow } from "@repo/context-ranking";
import type { ExecutionPlan } from "@repo/planner-agent";
import type { OnStreamEvent } from "./stream-events";

/** Compact memory summary passed into the execution engine from the caller. */
export interface EngineMemorySnapshot {
  lastIntent?: { intent: string; summary: string; entities?: string[] };
  lastPatch?: { files: string[]; success: boolean };
  lastError?: string;
  /** Latest autonomous-loop reflection (present on retry iterations when memory is refreshed). */
  lastLoopReflection?: {
    iteration: number;
    strategy: string;
    failureSummary: string;
    shouldRetry: boolean;
  };
  recentFiles: string[];
  narrative: string;
}

/** Callback the engine uses to record execution-step memory entries. */
export type RecordStepFn = (
  stepId: string,
  stepType: string,
  status: "started" | "completed" | "skipped" | "failed",
  durationMs?: number,
  reason?: string,
) => void;

export interface ExecutionContext {
  repo_id: string;
  query: string;
  adapter: ContextBuilderAdapter;
  intermediateResults: StepOutput[];
  logs: string[];
  workspacePath?: string;
  plan?: ExecutionPlan;
  onEvent?: OnStreamEvent;
  previewMode?: boolean;
  /** Session memory snapshot available to tools. */
  memory?: EngineMemorySnapshot;
  /** If provided, each step lifecycle event is recorded to memory. */
  recordStep?: RecordStepFn;
  /**
   * 0-based index of the autonomous execution loop pass (0 = first attempt).
   * Tools can use this for deeper search / fallback behavior on retries.
   */
  iteration?: number;
  /**
   * C.12: Mutation step types blocked by the current chat mode.
   * If the step type is in this set, `runStep` will skip it with a policy reason.
   */
  blockedStepTypes?: ReadonlySet<string>;
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
