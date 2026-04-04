import type {
  MemoryEntry,
  MemoryEntryType,
  MemorySnapshot,
  SessionKey,
} from "./memory.types";
import { getMemoryEntries, getMemoryEntriesAsync, searchMemoryByQuery } from "./memory-store";

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
 * Async version that first loads from DB if a db adapter is registered.
 */
export async function retrieveMemoryAsync(
  key: SessionKey,
  options: RetrieveOptions = {},
): Promise<MemoryEntry[]> {
  const allEntries = await getMemoryEntriesAsync(key);
  let entries = [...allEntries];

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

// ---------------------------------------------------------------------------
// Keyword relevance scoring
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "can", "shall", "to", "of", "in", "for",
  "on", "with", "at", "by", "from", "as", "into", "through", "during",
  "and", "or", "but", "if", "then", "else", "when", "that", "this",
  "it", "its", "my", "your", "we", "they", "them", "their", "our",
  "what", "which", "who", "how", "not", "no", "so", "up", "out",
]);

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s_.-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function keywordOverlapScore(entryText: string, queryKeywords: string[]): number {
  if (queryKeywords.length === 0) return 0;
  const entryLower = entryText.toLowerCase();
  let matches = 0;
  for (const kw of queryKeywords) {
    if (entryLower.includes(kw)) matches++;
  }
  return matches / queryKeywords.length;
}

export interface SmartRetrieveOptions {
  query: string;
  maxTokens?: number;
  types?: MemoryEntryType[];
  limit?: number;
}

const APPROX_CHARS_PER_TOKEN = 4;
const DEFAULT_MAX_TOKENS = 8000;

/**
 * Retrieve memory entries relevant to the current query.
 * Uses keyword overlap to rank entries, capped at a token budget.
 */
export async function retrieveRelevantMemory(
  key: SessionKey,
  options: SmartRetrieveOptions,
): Promise<MemoryEntry[]> {
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  const maxChars = maxTokens * APPROX_CHARS_PER_TOKEN;
  const queryKeywords = extractKeywords(options.query);

  const allEntries = await getMemoryEntriesAsync(key);
  let entries = [...allEntries];

  if (options.types && options.types.length > 0) {
    const allowed = new Set(options.types);
    entries = entries.filter((e) => allowed.has(e.type));
  }

  const crossSessionResults = await searchMemoryByQuery(
    key.workspacePath,
    queryKeywords.slice(0, 5),
    15,
  );
  const existingIds = new Set(entries.map((e) => e.id));
  for (const r of crossSessionResults) {
    if (!existingIds.has(r.id)) {
      entries.push(r);
      existingIds.add(r.id);
    }
  }

  const now = Date.now();
  const scored = entries.map((entry) => {
    const kwScore = keywordOverlapScore(entry.content, queryKeywords);
    const ageMs = now - entry.timestamp;
    const ageMinutes = ageMs / 60_000;
    const recencyScore = Math.max(0, 1 - ageMinutes / 1440);

    const typeBoost: Record<string, number> = {
      "turn-summary": 1.5,
      "analysis": 1.3,
      "tool-result": 1.0,
      "patch": 1.2,
      "error": 1.1,
      "intent": 0.8,
      "decision": 0.9,
      "context": 0.5,
      "execution-step": 0.4,
      "reflection": 0.7,
    };

    const score =
      kwScore * 3.0 +
      recencyScore * 1.5 +
      (entry.weight / 10) * 1.0 +
      (typeBoost[entry.type] ?? 0.5);

    return { entry, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const limit = options.limit ?? 20;
  const results: MemoryEntry[] = [];
  let charBudget = maxChars;

  for (const { entry } of scored) {
    if (results.length >= limit) break;
    const cost = entry.content.length + 50;
    if (charBudget - cost < 0 && results.length > 0) break;
    results.push(entry);
    charBudget -= cost;
  }

  return results;
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

    if (e.meta._kind === "turn-summary") {
      for (const f of e.meta.filesRead) recentFileSet.add(f);
      for (const f of e.meta.filesEdited) recentFileSet.add(f);
    }

    if (e.meta._kind === "tool-result") {
      const argFile = e.meta.args["path"] || e.meta.args["file"] || e.meta.args["directory"];
      if (argFile) recentFileSet.add(argFile);
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
