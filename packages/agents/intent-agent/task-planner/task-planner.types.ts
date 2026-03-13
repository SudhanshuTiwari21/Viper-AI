import type { IntentType } from "../intent-classifier/intent-classifier.types";

export type TaskType =
  | "LOCATE_CODE"
  | "ANALYZE_FLOW"
  | "IDENTIFY_ISSUE"
  | "GENERATE_PATCH"
  | "EXPLAIN_CODE"
  | "SEARCH_REFERENCES";

export interface PlannedTask {
  type: TaskType;
  description: string;
  entities?: string[];
}

export interface TaskPlan {
  intent: IntentType;
  tasks: PlannedTask[];
}

