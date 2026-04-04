// G.41 — Eval harness fixture and result types.
//
// Fixture format (JSON, one file per domain):
//   { "type": CaseType, "cases": EvalCase[] }
//
// Case types (Tier A — deterministic, no LLM):
//   "privacy-glob"        — tests checkPrivacy() from @repo/workspace-tools
//   "intent-scoring"      — tests scoreIntents() from @repo/intent-agent
//   "schema-validation"   — tests Zod schema accept/reject behaviour (inline schemas)
//   "workflow-stage"      — asserts a stage name is present in VALID_WORKFLOW_STAGES
//
// Tier B (optional, requires VIPER_EVAL_USE_LLM=1):
//   "llm-response"        — sends a prompt to the assistant, checks response against rubric

export type CaseType =
  | "privacy-glob"
  | "intent-scoring"
  | "schema-validation"
  | "workflow-stage";

// ---------------------------------------------------------------------------
// Per-type input / expect shapes
// ---------------------------------------------------------------------------

export interface PrivacyGlobInput {
  relativePath: string;
  configDenyGlobs?: string[];
  configAllowGlobs?: string[];
}
export interface PrivacyGlobExpect {
  allowed: boolean;
  blockedByPrefix?: string;
}

export interface IntentScoringInput {
  tokens: string[];
}
export interface IntentScoringExpect {
  intentType: string;
  minConfidence?: number;
}

export interface SchemaValidationInput {
  schema: "ChatMode" | "ModelTier";
  value: unknown;
}
export interface SchemaValidationExpect {
  valid: boolean;
}

export interface WorkflowStageInput {
  stage: string;
}
export interface WorkflowStageExpect {
  present: boolean;
}

// ---------------------------------------------------------------------------
// Generic EvalCase
// ---------------------------------------------------------------------------

export interface EvalCase<I = unknown, E = unknown> {
  id: string;
  description: string;
  tier?: "offline" | "live";
  input: I;
  expect: E;
}

export interface EvalFixtureFile {
  type: CaseType;
  cases: EvalCase[];
}

// ---------------------------------------------------------------------------
// Runner result types
// ---------------------------------------------------------------------------

export type CaseStatus = "pass" | "fail" | "skip" | "error";

export interface CaseResult {
  id: string;
  description: string;
  status: CaseStatus;
  durationMs: number;
  error?: string;
  actual?: unknown;
}

export interface SuiteResult {
  file: string;
  type: CaseType;
  cases: CaseResult[];
  passed: number;
  failed: number;
  skipped: number;
  errors: number;
  passRate: number;
  durationMs: number;
}

export interface HarnessResult {
  suites: SuiteResult[];
  totalCases: number;
  totalPassed: number;
  totalFailed: number;
  totalSkipped: number;
  overallPassRate: number;
  durationMs: number;
  thresholdPassed: boolean;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface TierConfig {
  description?: string;
  required_pass_rate: number;
}

export interface EvalConfig {
  tiers: {
    offline: TierConfig;
    live?: TierConfig;
  };
  timeout_ms?: number;
}
