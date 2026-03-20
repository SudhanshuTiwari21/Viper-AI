import type { IntentType } from "../intent-classifier/intent-classifier.types";
import type { TaskType } from "./task-planner.types";

export type TaskRuleMap = Record<IntentType, TaskType[]>;

export const TASK_RULES: TaskRuleMap = {
  GENERIC: [],
  CODE_FIX: [
    "LOCATE_CODE",
    "ANALYZE_FLOW",
    "IDENTIFY_ISSUE",
    "GENERATE_PATCH",
  ],
  FEATURE_IMPLEMENTATION: ["LOCATE_CODE", "ANALYZE_FLOW", "GENERATE_PATCH"],
  REFACTOR: ["LOCATE_CODE", "ANALYZE_FLOW", "GENERATE_PATCH"],
  CODE_EXPLANATION: ["LOCATE_CODE", "EXPLAIN_CODE"],
  CODE_SEARCH: ["SEARCH_REFERENCES"],
  DEPENDENCY_ANALYSIS: ["LOCATE_CODE", "ANALYZE_FLOW"],
  TEST_GENERATION: ["LOCATE_CODE"],
  SECURITY_ANALYSIS: ["LOCATE_CODE", "ANALYZE_FLOW"],
  FILE_EDIT: ["LOCATE_CODE", "GENERATE_PATCH"],
  PROJECT_SETUP: ["ANALYZE_FLOW", "GENERATE_PATCH"],
};

