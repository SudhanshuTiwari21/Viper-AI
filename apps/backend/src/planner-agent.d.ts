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

  export function buildExecutionPlan(
    intent: string,
    entities: string[],
  ): ExecutionPlan;
}
