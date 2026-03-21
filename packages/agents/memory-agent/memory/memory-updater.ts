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

/** Structured reflection from the autonomous execution loop (feeds next iteration memory). */
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
