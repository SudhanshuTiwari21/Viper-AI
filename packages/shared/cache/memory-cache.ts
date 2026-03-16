import type { CacheAdapter } from "./cache.types.js";

interface Entry<T> {
  value: T;
  expiresAt: number;
}

/**
 * In-memory cache with TTL. Uses Map; evicts on get when expired.
 */
export function createMemoryCache<T = unknown>(): CacheAdapter<T> {
  const store = new Map<string, Entry<T>>();

  return {
    async get(key: string): Promise<T | null> {
      const entry = store.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },

    async set(key: string, value: T, ttlSeconds?: number): Promise<void> {
      const ttl = ttlSeconds ?? 3600;
      const expiresAt = Date.now() + ttl * 1000;
      store.set(key, { value, expiresAt });
    },
  };
}
