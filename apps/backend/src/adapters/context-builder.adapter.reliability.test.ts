/**
 * B.10 — Reliability: cold/stale index and bounded embedding fetch (no live Qdrant/OpenAI).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";

const hoisted = vi.hoisted(() => ({
  embeddingsCreate: vi.fn(),
  getCollections: vi.fn(),
  search: vi.fn(),
}));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    embeddings = {
      create: (...args: unknown[]) => hoisted.embeddingsCreate(...args),
    };
    constructor(_opts: unknown) {}
  },
}));

vi.mock("@qdrant/js-client-rest", () => ({
  QdrantClient: class MockQdrantClient {
    getCollections = () => hoisted.getCollections();
    search = (...args: unknown[]) => hoisted.search(...args);
    constructor(_opts: unknown) {}
  },
}));

import {
  CONTEXT_ADAPTER_EMBEDDING_SEARCH_LIMIT,
  CONTEXT_ADAPTER_QDRANT_COLLECTION,
  createContextAdapter,
} from "./context-builder.adapter.js";

const stubPool = { query: vi.fn() } as unknown as Pool;
const baseOpts = {
  repo_id: "repo-test",
  pool: stubPool,
  qdrantUrl: "http://127.0.0.1:6333",
  openaiApiKey: "test-key",
};

function stubVector(dim = 4): number[] {
  return Array.from({ length: dim }, () => 0.01);
}

describe("context-builder.adapter reliability (B.10)", () => {
  beforeEach(() => {
    hoisted.embeddingsCreate.mockReset();
    hoisted.getCollections.mockReset();
    hoisted.search.mockReset();
    hoisted.embeddingsCreate.mockResolvedValue({
      data: [{ embedding: stubVector() }],
    });
  });

  describe("cold index", () => {
    it("returns [] when the vector collection is missing (no search call)", async () => {
      hoisted.getCollections.mockResolvedValue({
        collections: [{ name: "some_other_collection" }],
      });
      const adapter = createContextAdapter(baseOpts);
      await expect(adapter.searchEmbeddings("hello world")).resolves.toEqual([]);
      expect(hoisted.search).not.toHaveBeenCalled();
    });

    it("returns [] when the collection exists but Qdrant search returns no points", async () => {
      hoisted.getCollections.mockResolvedValue({
        collections: [{ name: CONTEXT_ADAPTER_QDRANT_COLLECTION }],
      });
      hoisted.search.mockResolvedValue([]);
      const adapter = createContextAdapter(baseOpts);
      await expect(adapter.searchEmbeddings("valid query")).resolves.toEqual([]);
      expect(hoisted.search).toHaveBeenCalledWith(
        CONTEXT_ADAPTER_QDRANT_COLLECTION,
        expect.objectContaining({
          limit: CONTEXT_ADAPTER_EMBEDDING_SEARCH_LIMIT,
        }),
      );
    });

    it("returns [] when OpenAI returns no embedding vector (no Qdrant calls)", async () => {
      hoisted.embeddingsCreate.mockResolvedValue({ data: [{ embedding: [] }] });
      const adapter = createContextAdapter(baseOpts);
      await expect(adapter.searchEmbeddings("x")).resolves.toEqual([]);
      expect(hoisted.getCollections).not.toHaveBeenCalled();
    });

    it("returns [] and does not throw when Qdrant search throws (degraded path)", async () => {
      hoisted.getCollections.mockResolvedValue({
        collections: [{ name: CONTEXT_ADAPTER_QDRANT_COLLECTION }],
      });
      hoisted.search.mockRejectedValue(new Error("fetch failed"));
      const adapter = createContextAdapter(baseOpts);
      await expect(adapter.searchEmbeddings("q")).resolves.toEqual([]);
    });
  });

  describe("stale index", () => {
    it("maps payloads with missing/empty file to stable text and optional file (no throw)", async () => {
      hoisted.getCollections.mockResolvedValue({
        collections: [{ name: CONTEXT_ADAPTER_QDRANT_COLLECTION }],
      });
      hoisted.search.mockResolvedValue([
        { score: 0.91, payload: { symbol: "onlySymbol" } },
        { score: 0.82, payload: { file: "", chunk_id: "chunk-xyz" } },
        {
          score: 0.7,
          payload: { file: "may-not-exist-on-disk.ts", symbol: "Ghost" },
        },
      ]);
      const adapter = createContextAdapter(baseOpts);
      const out = await adapter.searchEmbeddings("stale");
      expect(out).toHaveLength(3);
      expect(out[0]).toMatchObject({
        file: undefined,
        symbol: "onlySymbol",
        text: "[chunk]",
      });
      expect(out[1]).toMatchObject({
        file: undefined,
        text: "chunk-xyz",
      });
      expect(out[2]).toMatchObject({
        file: "may-not-exist-on-disk.ts",
        symbol: "Ghost",
        text: "may-not-exist-on-disk.ts (Ghost)",
      });
    });
  });

  describe("large repo", () => {
    it("requests a fixed cap from Qdrant (SEARCH_LIMIT) regardless of ideal result size", async () => {
      hoisted.getCollections.mockResolvedValue({
        collections: [{ name: CONTEXT_ADAPTER_QDRANT_COLLECTION }],
      });
      hoisted.search.mockResolvedValue([]);
      const adapter = createContextAdapter(baseOpts);
      await adapter.searchEmbeddings("wide query");
      expect(hoisted.search).toHaveBeenCalledWith(
        CONTEXT_ADAPTER_QDRANT_COLLECTION,
        expect.objectContaining({ limit: CONTEXT_ADAPTER_EMBEDDING_SEARCH_LIMIT }),
      );
      expect(CONTEXT_ADAPTER_EMBEDDING_SEARCH_LIMIT).toBe(20);
    });

    it("returns at most as many matches as Qdrant returns for one page (bounded by prior limit)", async () => {
      hoisted.getCollections.mockResolvedValue({
        collections: [{ name: CONTEXT_ADAPTER_QDRANT_COLLECTION }],
      });
      const points = Array.from({ length: CONTEXT_ADAPTER_EMBEDDING_SEARCH_LIMIT }, (_, i) => ({
        score: 1 - i * 0.01,
        payload: { file: `pkg/f${i}.ts`, symbol: `Fn${i}` },
      }));
      hoisted.search.mockResolvedValue(points);
      const adapter = createContextAdapter(baseOpts);
      const out = await adapter.searchEmbeddings("many");
      expect(out).toHaveLength(CONTEXT_ADAPTER_EMBEDDING_SEARCH_LIMIT);
      expect(out[0]?.file).toBe("pkg/f0.ts");
    });
  });
});
