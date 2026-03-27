import type { MemoryEntry, MemoryEntryType, MemoryMetadata, SessionKey } from "./memory.types";
import { sessionKeyString } from "./memory.types";

/**
 * Hard cap — after this, lowest-scored entries are evicted.
 * However, eviction guarantees the latest entry of each type survives.
 */
const MAX_ENTRIES = 50;

/** Base weights per type when none is explicitly provided. */
const DEFAULT_WEIGHTS: Record<MemoryEntryType, number> = {
  intent: 8,
  patch: 9,
  "execution-step": 4,
  decision: 6,
  error: 7,
  reflection: 7,
  context: 3,
  "tool-result": 5,
  "analysis": 8,
  "turn-summary": 9,
};

// ---------------------------------------------------------------------------
// In-process store (always active, serves as the read/write cache)
// ---------------------------------------------------------------------------

const store = new Map<string, MemoryEntry[]>();

function getOrCreate(key: SessionKey): MemoryEntry[] {
  const k = sessionKeyString(key);
  let entries = store.get(k);
  if (!entries) {
    entries = [];
    store.set(k, entries);
  }
  return entries;
}

function relevanceScore(entry: MemoryEntry, now: number): number {
  const ageMs = now - entry.timestamp;
  const ageMinutes = ageMs / 60_000;
  const recencyBoost = Math.max(0, 10 - ageMinutes * 0.1);
  return entry.weight + recencyBoost;
}

function evict(entries: MemoryEntry[]): void {
  if (entries.length <= MAX_ENTRIES) return;

  const now = Date.now();

  const latestByType = new Map<MemoryEntryType, string>();
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i]!;
    if (!latestByType.has(e.type)) {
      latestByType.set(e.type, e.id);
    }
  }
  const protectedIds = new Set(latestByType.values());

  const scored = entries.map((e, idx) => ({
    idx,
    id: e.id,
    score: relevanceScore(e, now),
    protected: protectedIds.has(e.id),
  }));

  scored.sort((a, b) => a.score - b.score);

  const toRemove = new Set<number>();
  for (const s of scored) {
    if (entries.length - toRemove.size <= MAX_ENTRIES) break;
    if (!s.protected) {
      toRemove.add(s.idx);
    }
  }

  for (const idx of [...toRemove].sort((a, b) => b - a)) {
    entries.splice(idx, 1);
  }
}

// ---------------------------------------------------------------------------
// Database persistence layer (optional — fails gracefully)
// ---------------------------------------------------------------------------

interface DbAdapter {
  insert: (
    workspacePath: string,
    conversationId: string,
    entry: MemoryEntry,
  ) => Promise<void>;
  load: (
    workspacePath: string,
    conversationId: string,
    limit: number,
  ) => Promise<MemoryEntry[]>;
  search: (
    workspacePath: string,
    keywords: string[],
    limit: number,
  ) => Promise<MemoryEntry[]>;
}

let dbAdapter: DbAdapter | null = null;
const loadedSessions = new Set<string>();

/**
 * Register a database adapter for persistent storage.
 * Call this once at startup with the initialized pool.
 */
export function registerDbAdapter(adapter: DbAdapter): void {
  dbAdapter = adapter;
}

function toDbMetaJson(meta: MemoryMetadata): Record<string, unknown> {
  return { ...meta } as unknown as Record<string, unknown>;
}

function fromDbMetaJson(json: Record<string, unknown>): MemoryMetadata {
  return json as unknown as MemoryMetadata;
}

async function persistToDb(key: SessionKey, entry: MemoryEntry): Promise<void> {
  if (!dbAdapter) return;
  try {
    await dbAdapter.insert(key.workspacePath, key.conversationId, entry);
  } catch {
    // DB persistence is best-effort — in-process store is authoritative
  }
}

async function loadFromDbIfNeeded(key: SessionKey): Promise<void> {
  if (!dbAdapter) return;
  const k = sessionKeyString(key);
  if (loadedSessions.has(k)) return;
  loadedSessions.add(k);

  try {
    const rows = await dbAdapter.load(key.workspacePath, key.conversationId, MAX_ENTRIES);
    const existing = getOrCreate(key);
    const existingIds = new Set(existing.map((e) => e.id));
    for (const row of rows) {
      if (!existingIds.has(row.id)) {
        existing.push(row);
      }
    }
    evict(existing);
  } catch {
    // Ignore DB load failures
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function addMemoryEntry(key: SessionKey, entry: MemoryEntry): void {
  if (entry.weight === 0) {
    entry.weight = DEFAULT_WEIGHTS[entry.type] ?? 5;
  }
  const entries = getOrCreate(key);
  entries.push(entry);
  evict(entries);
  void persistToDb(key, entry);
}

export function getMemoryEntries(key: SessionKey): readonly MemoryEntry[] {
  return getOrCreate(key);
}

export async function getMemoryEntriesAsync(
  key: SessionKey,
): Promise<readonly MemoryEntry[]> {
  await loadFromDbIfNeeded(key);
  return getOrCreate(key);
}

/**
 * Search memory across ALL conversations for a workspace using keyword matching.
 * Falls back to in-process filtering if no DB adapter is registered.
 */
export async function searchMemoryByQuery(
  workspacePath: string,
  keywords: string[],
  limit = 20,
): Promise<MemoryEntry[]> {
  if (dbAdapter) {
    try {
      return await dbAdapter.search(workspacePath, keywords, limit);
    } catch {
      // fall through to in-process search
    }
  }

  const results: MemoryEntry[] = [];
  const lowerKeywords = keywords.map((k) => k.toLowerCase());
  for (const [sessKey, entries] of store) {
    if (!sessKey.startsWith(workspacePath.replace(/\\/g, "/").replace(/\/$/, ""))) continue;
    for (const entry of entries) {
      const text = entry.content.toLowerCase();
      if (lowerKeywords.some((kw) => text.includes(kw))) {
        results.push(entry);
      }
    }
  }
  results.sort((a, b) => b.timestamp - a.timestamp);
  return results.slice(0, limit);
}

export function clearMemory(key: SessionKey): void {
  store.delete(sessionKeyString(key));
}

/** Test helper */
export function __resetMemoryStoreForTests(): void {
  store.clear();
  loadedSessions.clear();
}

export { toDbMetaJson, fromDbMetaJson };
