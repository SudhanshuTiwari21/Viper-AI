import type { IntentType } from "./intent-classifier.types";

export type IntentKeywordRules = Record<IntentType, string[]>;

export const INTENT_KEYWORD_RULES: IntentKeywordRules = {
  GENERIC: [], // No keywords; used when nothing else matches (e.g. "Hi", "how are you")
  CODE_FIX: ["fix", "bug", "issue", "error", "broken", "debug"],
  FEATURE_IMPLEMENTATION: ["add", "implement", "create", "build", "support"],
  REFACTOR: ["refactor", "improve", "cleanup", "simplify"],
  CODE_EXPLANATION: ["explain", "describe", "what", "how"],
  CODE_SEARCH: ["find", "search", "locate", "where"],
  DEPENDENCY_ANALYSIS: ["dependency", "dependencies", "imports"],
  TEST_GENERATION: ["test", "tests", "testing", "unit", "unit test"],
  SECURITY_ANALYSIS: ["security", "vulnerability", "secure"],
  FILE_EDIT: ["edit", "modify", "change"],
  PROJECT_SETUP: ["setup", "configure", "install", "initialize"],
  CODE_GUIDANCE: [
    "next steps",
    "next step",
    "what should",
    "prioritize",
    "roadmap",
    "advice",
    "recommend",
    "planning",
  ],
};

