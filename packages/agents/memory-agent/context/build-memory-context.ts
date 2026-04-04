import type { SessionKey, MemorySnapshot, MemoryEntry } from "../memory/memory.types";
import {
  retrieveMemory,
  retrieveRelevantMemory,
} from "../memory/memory-retriever";

const MAX_CONTEXT_ENTRIES = 12;

/**
 * Build a prompt-injectable text block from the session memory.
 * Returns empty string if no memory exists.
 */
export function buildMemoryContext(key: SessionKey): string {
  const entries = retrieveMemory(key, { limit: MAX_CONTEXT_ENTRIES });
  if (entries.length === 0) return "";

  return formatEntriesAsContext(entries);
}

/**
 * Build a rich, query-aware memory context block.
 * Uses keyword relevance to select the most useful entries, capped at ~8K tokens.
 */
export async function buildRichMemoryContext(
  key: SessionKey,
  currentQuery: string,
): Promise<string> {
  const entries = await retrieveRelevantMemory(key, {
    query: currentQuery,
    maxTokens: 8000,
    limit: 20,
  });

  if (entries.length === 0) return "";

  const turnSummaries = entries.filter((e) => e.meta._kind === "turn-summary");
  const toolResults = entries.filter((e) => e.meta._kind === "tool-result");
  const analyses = entries.filter((e) => e.meta._kind === "analysis");
  const other = entries.filter(
    (e) =>
      e.meta._kind !== "turn-summary" &&
      e.meta._kind !== "tool-result" &&
      e.meta._kind !== "analysis",
  );

  const sections: string[] = [];

  if (turnSummaries.length > 0) {
    sections.push("PREVIOUS TURNS:");
    for (const e of turnSummaries.slice(0, 5)) {
      if (e.meta._kind !== "turn-summary") continue;
      const m = e.meta;
      const parts: string[] = [];
      parts.push(`  User: ${m.userPrompt}`);
      if (m.toolsUsed.length > 0) parts.push(`  Tools: ${m.toolsUsed.join(", ")}`);
      if (m.filesRead.length > 0) parts.push(`  Read: ${m.filesRead.join(", ")}`);
      if (m.filesEdited.length > 0) parts.push(`  Edited: ${m.filesEdited.join(", ")}`);
      parts.push(`  Result: ${m.responseSummary}`);
      sections.push(parts.join("\n"));
    }
  }

  if (analyses.length > 0) {
    sections.push("PREVIOUS ANALYSIS FINDINGS:");
    for (const e of analyses.slice(0, 3)) {
      if (e.meta._kind !== "analysis") continue;
      sections.push(`  ${e.content}`);
      if (e.meta.issuesFound.length > 0) {
        sections.push(`  Issues: ${e.meta.issuesFound.join("; ")}`);
      }
    }
  }

  if (toolResults.length > 0) {
    sections.push("RELEVANT TOOL RESULTS FROM PAST TURNS:");
    for (const e of toolResults.slice(0, 6)) {
      if (e.meta._kind !== "tool-result") continue;
      const argsStr = Object.entries(e.meta.args)
        .map(([k, v]) => `${k}=${v}`)
        .join(" ");
      sections.push(`  ${e.meta.toolName}(${argsStr}): ${e.meta.resultSummary}`);
    }
  }

  if (other.length > 0) {
    sections.push("OTHER CONTEXT:");
    for (const e of other.slice(0, 4)) {
      sections.push(`  [${e.type.toUpperCase()}] ${e.content}`);
    }
  }

  return sections.join("\n\n");
}

function formatEntriesAsContext(entries: MemoryEntry[]): string {
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
    } else if (e.meta._kind === "turn-summary") {
      detail = `User: ${e.meta.userPrompt} | Tools: ${e.meta.toolsUsed.join(",")} | Response: ${e.meta.responseSummary}`;
    } else if (e.meta._kind === "tool-result") {
      detail = `${e.meta.toolName}: ${e.meta.resultSummary}`;
    } else if (e.meta._kind === "analysis") {
      detail = `Issues: ${e.meta.issuesFound.join("; ")} | Files: ${e.meta.filesExamined.join(", ")}`;
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

export { buildMemorySnapshot } from "../memory/memory-retriever";
export type { MemorySnapshot } from "../memory/memory.types";
