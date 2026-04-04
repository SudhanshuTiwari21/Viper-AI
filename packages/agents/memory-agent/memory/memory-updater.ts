import { randomUUID } from "node:crypto";
import type { MemoryEntry, MemoryMetadata, MemoryEntryType, SessionKey } from "./memory.types";
import { addMemoryEntry } from "./memory-store";

// ---------------------------------------------------------------------------
// Generic recorder
// ---------------------------------------------------------------------------

export interface MemoryUpdateInput {
  type: MemoryEntryType;
  content: string;
  meta: MemoryMetadata;
  weight?: number;
}

export function recordMemory(key: SessionKey, input: MemoryUpdateInput): string {
  const id = randomUUID();
  const entry: MemoryEntry = {
    id,
    type: input.type,
    content: input.content,
    timestamp: Date.now(),
    meta: input.meta,
    weight: input.weight ?? 0,
  };
  addMemoryEntry(key, entry);
  return id;
}

// ---------------------------------------------------------------------------
// Typed convenience helpers
// ---------------------------------------------------------------------------

export function recordIntent(
  key: SessionKey,
  intent: string,
  summary: string,
  entities?: string[],
): string {
  return recordMemory(key, {
    type: "intent",
    content: `${intent}: ${summary}`,
    meta: { _kind: "intent", intent, summary, entities },
    weight: 8,
  });
}

export function recordPatch(
  key: SessionKey,
  files: string[],
  success: boolean,
  operationCount?: number,
  rollbackId?: string,
): string {
  return recordMemory(key, {
    type: "patch",
    content: `Patch ${success ? "applied" : "failed"}: ${files.join(", ")}`,
    meta: { _kind: "patch", files, success, operationCount, rollbackId },
    weight: 9,
  });
}

export function recordExecutionStep(
  key: SessionKey,
  stepId: string,
  stepType: string,
  status: "started" | "completed" | "skipped" | "failed",
  durationMs?: number,
  reason?: string,
): string {
  return recordMemory(key, {
    type: "execution-step",
    content: `Step ${stepType} ${status}${durationMs ? ` (${durationMs}ms)` : ""}${reason ? `: ${reason}` : ""}`,
    meta: { _kind: "execution-step", stepId, stepType, status, durationMs, reason },
    weight: status === "failed" ? 7 : 4,
  });
}

export function recordDecision(
  key: SessionKey,
  decision: string,
  rationale?: string,
): string {
  return recordMemory(key, {
    type: "decision",
    content: decision,
    meta: { _kind: "decision", rationale },
    weight: 6,
  });
}

export function recordError(
  key: SessionKey,
  error: string,
  source?: string,
  stepId?: string,
): string {
  return recordMemory(key, {
    type: "error",
    content: error,
    meta: { _kind: "error", source, stepId },
    weight: 7,
  });
}

/** Structured reflection from the autonomous execution loop. */
export function recordReflectionIteration(
  key: SessionKey,
  iteration: number,
  strategy: string,
  failureSummary: string,
  shouldRetry: boolean,
): string {
  return recordMemory(key, {
    type: "reflection",
    content: `Loop reflection (iter ${iteration}): ${strategy}`,
    meta: {
      _kind: "reflection",
      iteration,
      strategy,
      failureSummary,
      shouldRetry,
    },
    weight: 7,
  });
}

// ---------------------------------------------------------------------------
// New: agentic loop turn recording
// ---------------------------------------------------------------------------

export interface ToolCallRecord {
  toolName: string;
  args: Record<string, string>;
  resultSummary: string;
  durationMs?: number;
}

/**
 * Record a single tool call result from the agentic loop.
 */
export function recordToolResult(
  key: SessionKey,
  toolCall: ToolCallRecord,
): string {
  return recordMemory(key, {
    type: "tool-result",
    content: `${toolCall.toolName}: ${toolCall.resultSummary}`,
    meta: {
      _kind: "tool-result",
      toolName: toolCall.toolName,
      args: toolCall.args,
      resultSummary: toolCall.resultSummary,
      durationMs: toolCall.durationMs,
    },
    weight: toolCall.toolName === "read_file" || toolCall.toolName === "edit_file" ? 6 : 4,
  });
}

/**
 * Record a structured analysis finding.
 */
export function recordAnalysis(
  key: SessionKey,
  summary: string,
  issuesFound: string[],
  filesExamined: string[],
): string {
  return recordMemory(key, {
    type: "analysis",
    content: summary,
    meta: {
      _kind: "analysis",
      issuesFound,
      filesExamined,
    },
    weight: 8,
  });
}

/**
 * Record a full agentic loop turn summary.
 * Called after the loop completes (or pauses) to capture the overall turn.
 */
export function recordTurnSummary(
  key: SessionKey,
  opts: {
    userPrompt: string;
    toolsUsed: string[];
    filesRead: string[];
    filesEdited: string[];
    responseSummary: string;
    toolCallCount: number;
  },
): string {
  const parts = [`User asked: ${opts.userPrompt}`];
  if (opts.toolsUsed.length > 0) {
    parts.push(`Tools used: ${opts.toolsUsed.join(", ")}`);
  }
  if (opts.filesRead.length > 0) {
    parts.push(`Files read: ${opts.filesRead.join(", ")}`);
  }
  if (opts.filesEdited.length > 0) {
    parts.push(`Files edited: ${opts.filesEdited.join(", ")}`);
  }
  parts.push(`Response: ${opts.responseSummary}`);

  return recordMemory(key, {
    type: "turn-summary",
    content: parts.join(" | "),
    meta: {
      _kind: "turn-summary",
      ...opts,
    },
    weight: 9,
  });
}
