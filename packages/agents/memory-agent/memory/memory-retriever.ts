import type {
  MemoryEntry,
  MemoryEntryType,
  MemorySnapshot,
  SessionKey,
} from "./memory.types";
import { getMemoryEntries } from "./memory-store";

export interface RetrieveOptions {
  types?: MemoryEntryType[];
  limit?: number;
}

/**
 * Retrieve memory entries for a session, optionally filtered by type.
 * Returns most recent first.
 */
export function retrieveMemory(
  key: SessionKey,
  options: RetrieveOptions = {},
): MemoryEntry[] {
  let entries = [...getMemoryEntries(key)];

  if (options.types && options.types.length > 0) {
    const allowed = new Set(options.types);
    entries = entries.filter((e) => allowed.has(e.type));
  }

  entries.sort((a, b) => b.timestamp - a.timestamp);

  if (options.limit && options.limit > 0) {
    entries = entries.slice(0, options.limit);
  }

  return entries;
}

/**
 * Build a compact, structured snapshot of the session memory.
 * Used by the planner and execution engine — no long strings.
 */
export function buildMemorySnapshot(key: SessionKey): MemorySnapshot {
  const entries = retrieveMemory(key);

  let lastIntent: MemorySnapshot["lastIntent"];
  let lastPatch: MemorySnapshot["lastPatch"];
  let lastError: string | undefined;
  let lastLoopReflection: MemorySnapshot["lastLoopReflection"];
  const recentFileSet = new Set<string>();
  const narrativeParts: string[] = [];

  for (const e of entries) {
    if (e.meta._kind === "intent" && !lastIntent) {
      lastIntent = {
        intent: e.meta.intent,
        summary: e.meta.summary,
        entities: e.meta.entities,
      };
      narrativeParts.push(`User intent: ${e.meta.summary}`);
    }

    if (e.meta._kind === "patch" && !lastPatch) {
      lastPatch = { files: e.meta.files, success: e.meta.success };
      for (const f of e.meta.files) recentFileSet.add(f);
      narrativeParts.push(
        `Patch ${e.meta.success ? "applied" : "failed"}: ${e.meta.files.join(", ")}`,
      );
    }

    if (e.meta._kind === "error" && !lastError) {
      lastError = e.content;
      narrativeParts.push(`Error: ${e.content}`);
    }

    if (e.meta._kind === "execution-step") {
      if (e.meta.status === "failed") {
        narrativeParts.push(
          `Step ${e.meta.stepType} failed${e.meta.reason ? `: ${e.meta.reason}` : ""}`,
        );
      }
    }

    if (e.meta._kind === "reflection" && !lastLoopReflection) {
      lastLoopReflection = {
        iteration: e.meta.iteration,
        strategy: e.meta.strategy,
        failureSummary: e.meta.failureSummary,
        shouldRetry: e.meta.shouldRetry,
      };
      narrativeParts.push(
        `Loop reflection (iter ${e.meta.iteration}): ${e.meta.strategy}`,
      );
    }
  }

  return {
    lastIntent,
    lastPatch,
    lastError,
    lastLoopReflection,
    recentFiles: [...recentFileSet],
    narrative: narrativeParts.length > 0
      ? narrativeParts.join("\n")
      : "",
  };
}
