import { describe, it, expect, vi, beforeEach } from "vitest";

const mockEmbeddingsCreate = vi.fn().mockImplementation((opts: { input: string[] }) =>
  Promise.resolve({
    data: opts.input.map((_, i) => ({ index: i, embedding: [0.1 + i * 0.01] })),
  }),
);

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    embeddings: { create: mockEmbeddingsCreate },
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPENAI_API_KEY = "sk-test";
  process.env.EMBEDDING_CACHE_TTL = "604800";
  process.env.EMBEDDING_BATCH_SIZE = "64";
});

describe("OpenAI embedding adapter cache and batching", () => {
  it("returns cached embedding on second call (OpenAI not called again)", async () => {
    const { createOpenAIEmbeddingAdapter } = await import("./openai-embedding.adapter.js");
    const adapter = createOpenAIEmbeddingAdapter();
    const text = "same text for cache";
    const r1 = await adapter.generateEmbeddings([text]);
    const r2 = await adapter.generateEmbeddings([text]);
    expect(r1).toEqual(r2);
    expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(1);
  });

  it("batches requests (64 per batch)", async () => {
    const { createOpenAIEmbeddingAdapter } = await import("./openai-embedding.adapter.js");
    const adapter = createOpenAIEmbeddingAdapter();
    const texts = Array.from({ length: 100 }, (_, i) => `unique-${i}`);
    const result = await adapter.generateEmbeddings(texts);
    expect(result).toHaveLength(100);
    expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(2);
    expect(mockEmbeddingsCreate.mock.calls[0]![0].input).toHaveLength(64);
    expect(mockEmbeddingsCreate.mock.calls[1]![0].input).toHaveLength(36);
  });
});
