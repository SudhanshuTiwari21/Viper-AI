export type IntentType =
  | "CODE_FIX"
  | "FEATURE_IMPLEMENTATION"
  | "REFACTOR"
  | "CODE_EXPLANATION"
  | "CODE_SEARCH"
  | "DEPENDENCY_ANALYSIS"
  | "TEST_GENERATION"
  | "SECURITY_ANALYSIS"
  | "FILE_EDIT"
  | "PROJECT_SETUP";

export interface IntentClassification {
  intentType: IntentType;
  confidence: number;
  matchedKeywords: string[];
}

