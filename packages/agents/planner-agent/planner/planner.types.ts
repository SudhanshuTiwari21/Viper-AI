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

/** Compact memory summary the planner can use to resolve references like "it", "optimize that", etc. */
export interface PlannerMemoryContext {
  lastIntent?: { intent: string; summary: string; entities?: string[] };
  lastPatch?: { files: string[]; success: boolean };
  lastError?: string;
  recentFiles: string[];
  /** From a prior autonomous-loop retry in this session (affects step descriptions). */
  lastLoopReflection?: {
    iteration: number;
    strategy: string;
    failureSummary: string;
    shouldRetry: boolean;
  };
}
