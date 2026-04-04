import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NormalizedPrompt } from "../prompt-normalizer/prompt-normalizer.types";
import { classifyIntent } from "./classify-intent";
import * as llmClassifier from "./llm-intent-classifier.service";

vi.mock("./llm-intent-classifier.service", () => ({
  classifyIntentWithLLM: vi.fn(),
}));

const mockedClassify = vi.mocked(llmClassifier.classifyIntentWithLLM);

function makePrompt(text: string, tokens: string[]): NormalizedPrompt {
  return {
    original: text,
    normalized: text,
    tokens,
    references: [],
  };
}

describe("Intent Classifier (LLM-based)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("classifies 'fix login api' as CODE_FIX", async () => {
    mockedClassify.mockResolvedValue("CODE_FIX");
    const prompt = makePrompt("Fix login API", ["fix", "login", "api"]);
    const result = await classifyIntent(prompt);
    expect(result.intentType).toBe("CODE_FIX");
    expect(result.confidence).toBe(1);
    expect(mockedClassify).toHaveBeenCalledWith("Fix login API");
  });

  it("classifies 'add password reset' as FEATURE_IMPLEMENTATION", async () => {
    mockedClassify.mockResolvedValue("FEATURE_IMPLEMENTATION");
    const prompt = makePrompt("Add password reset", [
      "add",
      "password",
      "reset",
    ]);
    const result = await classifyIntent(prompt);
    expect(result.intentType).toBe("FEATURE_IMPLEMENTATION");
    expect(mockedClassify).toHaveBeenCalledWith("Add password reset");
  });

  it("classifies 'refactor auth service' as REFACTOR", async () => {
    mockedClassify.mockResolvedValue("REFACTOR");
    const prompt = makePrompt("Refactor authentication service", [
      "refactor",
      "authentication",
      "service",
    ]);
    const result = await classifyIntent(prompt);
    expect(result.intentType).toBe("REFACTOR");
  });

  it("classifies 'explain authentication module' as CODE_EXPLANATION", async () => {
    mockedClassify.mockResolvedValue("CODE_EXPLANATION");
    const prompt = makePrompt("Explain authentication module", [
      "explain",
      "authentication",
      "module",
    ]);
    const result = await classifyIntent(prompt);
    expect(result.intentType).toBe("CODE_EXPLANATION");
  });

  it("classifies 'find where jwt is used' as CODE_SEARCH", async () => {
    mockedClassify.mockResolvedValue("CODE_SEARCH");
    const prompt = makePrompt("Find where jwt is used", [
      "find",
      "where",
      "jwt",
      "used",
    ]);
    const result = await classifyIntent(prompt);
    expect(result.intentType).toBe("CODE_SEARCH");
  });

  it("classifies generic greeting as GENERIC", async () => {
    mockedClassify.mockResolvedValue("GENERIC");
    const prompt = makePrompt("Hello there!", ["hello", "there"]);
    const result = await classifyIntent(prompt);
    expect(result.intentType).toBe("GENERIC");
  });
});
