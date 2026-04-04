export type IntentType =
  | "GENERIC"
  | "CODE_FIX"
  | "FEATURE_IMPLEMENTATION"
  | "REFACTOR"
  | "CODE_EXPLANATION"
  | "CODE_SEARCH"
  | "DEPENDENCY_ANALYSIS"
  | "TEST_GENERATION"
  | "SECURITY_ANALYSIS"
  | "FILE_EDIT"
  | "PROJECT_SETUP"
  /** Advice / next steps / priorities — answer with context, do not run patch generation. */
  | "CODE_GUIDANCE";

export interface IntentClassification {
  intentType: IntentType;
  confidence: number;
  matchedKeywords: string[];
}

