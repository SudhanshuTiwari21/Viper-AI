declare module "@repo/planner-agent" {
  export type PlanStepType =
    | "SEARCH_SYMBOL"
    | "SEARCH_EMBEDDING"
    | "FETCH_DEPENDENCIES"
    | "ANALYZE_CODE"
    | "IDENTIFY_ISSUE"
    | "GENERATE_PATCH"
    | "EXPLAIN_CODE"
    | "NO_OP";

  export interface PlanStep {
    id: string;
    type: PlanStepType;
    description: string;
    entities?: string[];
  }

  export interface ExecutionPlan {
    intent: string;
    steps: PlanStep[];
  }

  export interface PlannerMemoryContext {
    lastIntent?: { intent: string; summary: string; entities?: string[] };
    lastPatch?: { files: string[]; success: boolean };
    lastError?: string;
    recentFiles: string[];
    lastLoopReflection?: {
      iteration: number;
      strategy: string;
      failureSummary: string;
      shouldRetry: boolean;
    };
  }

  export function buildExecutionPlan(
    intent: string,
    entities: string[],
    memory?: PlannerMemoryContext,
  ): ExecutionPlan;
}
