import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockCreate = vi.fn().mockResolvedValue({
  choices: [{ message: { content: '{"detectedComponents":[]}' } }],
});

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPENAI_API_KEY = "sk-test";
  process.env.LLM_CACHE_TTL = "3600";
  process.env.DISABLE_INTENT_CACHE = "false";
});
afterEach(() => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.LLM_CACHE_TTL;
  delete process.env.DISABLE_INTENT_CACHE;
});

describe("runReasoningPrompt cache", () => {
  it("returns cached result on second call (OpenAI not called again)", async () => {
    const { runReasoningPrompt } = await import("./llm-client.service");
    const prompt = "same prompt for cache key";
    const r1 = await runReasoningPrompt(prompt, { conversationId: "c1" });
    const r2 = await runReasoningPrompt(prompt, { conversationId: "c1" });
    expect(r1).toBe(r2);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("calls OpenAI on cache miss", async () => {
    const { runReasoningPrompt } = await import("./llm-client.service");
    await runReasoningPrompt("unique prompt", { conversationId: "c1" });
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});
