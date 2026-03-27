import type { PlanStepType } from "./planner.types";

export const PLANNER_RULES: Record<string, PlanStepType[]> = {
  CODE_FIX: [
    "SEARCH_SYMBOL",
    "SEARCH_EMBEDDING",
    "FETCH_DEPENDENCIES",
    "IDENTIFY_ISSUE",
    "GENERATE_PATCH",
  ],
  /** ANALYZE_CODE removed — no execution-engine tool registered; use SEARCH_* + GENERATE_PATCH. */
  FEATURE_IMPLEMENTATION: [
    "SEARCH_SYMBOL",
    "SEARCH_EMBEDDING",
    "GENERATE_PATCH",
  ],
  REFACTOR: [
    "SEARCH_SYMBOL",
    "SEARCH_EMBEDDING",
    "GENERATE_PATCH",
  ],
  CODE_EXPLANATION: [
    "SEARCH_SYMBOL",
    "SEARCH_EMBEDDING",
    "EXPLAIN_CODE",
  ],
  CODE_SEARCH: ["SEARCH_SYMBOL"],
  GENERIC: ["NO_OP"],
  /** Advisory intent — planner not executed; keeps routing consistent. */
  CODE_GUIDANCE: ["NO_OP"],
};
