import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMemoryCache } from "./memory-cache.js";

describe("createMemoryCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null for missing key", async () => {
    const cache = createMemoryCache<string>();
    expect(await cache.get("missing")).toBe(null);
  });

  it("returns value after set", async () => {
    const cache = createMemoryCache<string>();
    await cache.set("k", "v", 3600);
    expect(await cache.get("k")).toBe("v");
  });

  it("returns null after TTL expires", async () => {
    const cache = createMemoryCache<string>();
    await cache.set("k", "v", 1);
    expect(await cache.get("k")).toBe("v");
    vi.advanceTimersByTime(2000);
    expect(await cache.get("k")).toBe(null);
  });

  it("stores objects", async () => {
    const cache = createMemoryCache<{ a: number }>();
    await cache.set("obj", { a: 42 }, 3600);
    expect(await cache.get("obj")).toEqual({ a: 42 });
  });
});
