import type { MemoryEntry, MemoryEntryType, SessionKey } from "./memory.types";
import { sessionKeyString } from "./memory.types";

/**
 * Hard cap — after this, lowest-scored entries are evicted.
 * However, eviction guarantees the latest entry of each type survives.
 */
const MAX_ENTRIES = 30;

/** Base weights per type when none is explicitly provided. */
const DEFAULT_WEIGHTS: Record<MemoryEntryType, number> = {
  intent: 8,
  patch: 9,
  "execution-step": 4,
  decision: 6,
  error: 7,
  reflection: 7,
  context: 3,
};

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

/**
 * Compute a relevance score for sorting / eviction.
 * Higher = keep. Blends explicit weight with recency.
 */
function relevanceScore(entry: MemoryEntry, now: number): number {
  const ageMs = now - entry.timestamp;
  const ageMinutes = ageMs / 60_000;
  const recencyBoost = Math.max(0, 10 - ageMinutes * 0.1);
  return entry.weight + recencyBoost;
}

/**
 * Evict lowest-scored entries while keeping at least the latest of each type.
 */
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

export function addMemoryEntry(key: SessionKey, entry: MemoryEntry): void {
  if (entry.weight === 0) {
    entry.weight = DEFAULT_WEIGHTS[entry.type] ?? 5;
  }
  const entries = getOrCreate(key);
  entries.push(entry);
  evict(entries);
}

export function getMemoryEntries(key: SessionKey): readonly MemoryEntry[] {
  return getOrCreate(key);
}

export function clearMemory(key: SessionKey): void {
  store.delete(sessionKeyString(key));
}

/** Test helper */
export function __resetMemoryStoreForTests(): void {
  store.clear();
}
