import type { SessionKey, MemorySnapshot } from "../memory/memory.types";
import { retrieveMemory, buildMemorySnapshot } from "../memory/memory-retriever";

const MAX_CONTEXT_ENTRIES = 12;

/**
 * Build a prompt-injectable text block from the session memory.
 * Returns empty string if no memory exists.
 */
export function buildMemoryContext(key: SessionKey): string {
  const entries = retrieveMemory(key, { limit: MAX_CONTEXT_ENTRIES });
  if (entries.length === 0) return "";

  const lines = entries.map((e) => {
    const tag = e.type.toUpperCase();
    const ts = new Date(e.timestamp).toISOString().slice(11, 19);
    let detail = e.content;

    if (e.meta._kind === "intent") {
      detail = `intent=${e.meta.intent} summary="${e.meta.summary}"${
        e.meta.entities?.length ? ` entities=[${e.meta.entities.join(", ")}]` : ""
      }`;
    } else if (e.meta._kind === "patch") {
      detail = `${e.meta.success ? "applied" : "failed"} files=[${e.meta.files.join(", ")}]`;
    } else if (e.meta._kind === "execution-step") {
      detail = `${e.meta.stepType} ${e.meta.status}${e.meta.durationMs ? ` (${e.meta.durationMs}ms)` : ""}`;
    } else if (e.meta._kind === "reflection") {
      detail = `iter=${e.meta.iteration} retry=${e.meta.shouldRetry} strategy="${e.meta.strategy}"`;
    }

    return `[${tag} ${ts}] ${detail}`;
  });

  return [
    "PREVIOUS CONTEXT (most recent first):",
    ...lines,
  ].join("\n");
}

/**
 * Augment an existing prompt with memory context.
 */
export function injectMemoryIntoPrompt(
  prompt: string,
  key: SessionKey,
): string {
  const context = buildMemoryContext(key);
  if (!context) return prompt;
  return `${context}\n\n---\n\n${prompt}`;
}

/**
 * Get the structured memory snapshot for the planner / execution engine.
 * This is the primary interface for non-LLM consumers.
 */
export { buildMemorySnapshot } from "../memory/memory-retriever";
export type { MemorySnapshot } from "../memory/memory.types";
