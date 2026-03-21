import type { PlanStepType } from "./planner.types";

export const PLANNER_RULES: Record<string, PlanStepType[]> = {
  CODE_FIX: [
    "SEARCH_SYMBOL",
    "SEARCH_EMBEDDING",
    "FETCH_DEPENDENCIES",
    "ANALYZE_CODE",
    "IDENTIFY_ISSUE",
    "GENERATE_PATCH",
  ],
  FEATURE_IMPLEMENTATION: [
    "SEARCH_SYMBOL",
    "ANALYZE_CODE",
    "GENERATE_PATCH",
  ],
  REFACTOR: [
    "SEARCH_SYMBOL",
    "ANALYZE_CODE",
    "GENERATE_PATCH",
  ],
  CODE_EXPLANATION: [
    "SEARCH_SYMBOL",
    "ANALYZE_CODE",
    "EXPLAIN_CODE",
  ],
  CODE_SEARCH: ["SEARCH_SYMBOL"],
  GENERIC: ["NO_OP"],
};
