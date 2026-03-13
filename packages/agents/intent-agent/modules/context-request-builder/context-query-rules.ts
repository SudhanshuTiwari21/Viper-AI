import type { TaskType } from "../task-planner/task-planner.types";

export type QueryStrategy =
  | "symbolSearch"
  | "fileSearch"
  | "moduleSearch"
  | "embeddingSearch"
  | "dependencyLookup";

export const CONTEXT_QUERY_RULES: Record<TaskType, QueryStrategy[]> = {
  LOCATE_CODE: ["symbolSearch", "embeddingSearch"],
  ANALYZE_FLOW: ["dependencyLookup", "symbolSearch"],
  IDENTIFY_ISSUE: ["embeddingSearch", "dependencyLookup"],
  GENERATE_PATCH: ["symbolSearch", "embeddingSearch"],
  EXPLAIN_CODE: ["symbolSearch", "embeddingSearch"],
  SEARCH_REFERENCES: ["symbolSearch"],
};
