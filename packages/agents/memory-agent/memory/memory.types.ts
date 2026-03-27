export type MemoryEntryType =
  | "intent"
  | "decision"
  | "patch"
  | "error"
  | "context"
  | "execution-step"
  | "reflection"
  | "tool-result"
  | "analysis"
  | "turn-summary";

// ---------------------------------------------------------------------------
// Structured metadata per entry type (discriminated by `_kind`)
// ---------------------------------------------------------------------------

export interface IntentMeta {
  intent: string;
  summary: string;
  entities?: string[];
}

export interface PatchMeta {
  files: string[];
  success: boolean;
  operationCount?: number;
  rollbackId?: string;
}

export interface ExecutionStepMeta {
  stepId: string;
  stepType: string;
  status: "started" | "completed" | "skipped" | "failed";
  durationMs?: number;
  reason?: string;
}

export interface ErrorMeta {
  source?: string;
  stepId?: string;
}

export interface DecisionMeta {
  rationale?: string;
}

/** Autonomous loop reflection (structured, for next-iteration planner / engine context). */
export interface ReflectionLoopMeta {
  iteration: number;
  strategy: string;
  failureSummary: string;
  shouldRetry: boolean;
}

/** A single tool call + result from the agentic loop. */
export interface ToolResultMeta {
  toolName: string;
  args: Record<string, string>;
  resultSummary: string;
  durationMs?: number;
}

/** Structured findings from a codebase analysis turn. */
export interface AnalysisMeta {
  issuesFound: string[];
  filesExamined: string[];
}

/** Summary of an entire agentic loop turn (user prompt → tool calls → response). */
export interface TurnSummaryMeta {
  userPrompt: string;
  toolsUsed: string[];
  filesRead: string[];
  filesEdited: string[];
  responseSummary: string;
  toolCallCount: number;
}

/** Type-safe metadata union */
export type MemoryMetadata =
  | ({ _kind: "intent" } & IntentMeta)
  | ({ _kind: "patch" } & PatchMeta)
  | ({ _kind: "execution-step" } & ExecutionStepMeta)
  | ({ _kind: "error" } & ErrorMeta)
  | ({ _kind: "decision" } & DecisionMeta)
  | ({ _kind: "reflection" } & ReflectionLoopMeta)
  | ({ _kind: "context" })
  | ({ _kind: "tool-result" } & ToolResultMeta)
  | ({ _kind: "analysis" } & AnalysisMeta)
  | ({ _kind: "turn-summary" } & TurnSummaryMeta);

export interface MemoryEntry {
  id: string;
  type: MemoryEntryType;
  content: string;
  timestamp: number;
  /** Structured metadata — typed per entry type. */
  meta: MemoryMetadata;
  /** Importance weight (1–10). Higher = more resistant to eviction. */
  weight: number;
}

// ---------------------------------------------------------------------------
// Session key
// ---------------------------------------------------------------------------

export interface SessionKey {
  workspacePath: string;
  conversationId: string;
}

export function sessionKeyString(key: SessionKey): string {
  const normalized = key.workspacePath.replace(/\\/g, "/").replace(/\/$/, "");
  return `${normalized}::${key.conversationId}`;
}

// ---------------------------------------------------------------------------
// Compact summary for planner / execution engine (no raw strings)
// ---------------------------------------------------------------------------

export interface MemorySnapshot {
  lastIntent?: { intent: string; summary: string; entities?: string[] };
  lastPatch?: { files: string[]; success: boolean };
  lastError?: string;
  /** Latest autonomous-loop reflection (so the next execution pass sees it). */
  lastLoopReflection?: {
    iteration: number;
    strategy: string;
    failureSummary: string;
    shouldRetry: boolean;
  };
  recentFiles: string[];
  /** Human-readable summary for injection into prompts / descriptions. */
  narrative: string;
}
