import { describe, it, expect } from "vitest";
import type { NormalizedPrompt } from "../prompt-normalizer/prompt-normalizer.types";
import { classifyIntent } from "./classify-intent";

function makePrompt(text: string, tokens: string[]): NormalizedPrompt {
  return {
    original: text,
    normalized: text,
    tokens,
    references: [],
  };
}

describe("Intent Classifier", () => {
  it("classifies 'fix login api' as CODE_FIX", () => {
    const prompt = makePrompt("Fix login API", ["fix", "login", "api"]);
    const result = classifyIntent(prompt);
    expect(result.intentType).toBe("CODE_FIX");
  });

  it("classifies 'add password reset' as FEATURE_IMPLEMENTATION", () => {
    const prompt = makePrompt("Add password reset", [
      "add",
      "password",
      "reset",
    ]);
    const result = classifyIntent(prompt);
    expect(result.intentType).toBe("FEATURE_IMPLEMENTATION");
  });

  it("classifies 'refactor auth service' as REFACTOR", () => {
    const prompt = makePrompt("Refactor authentication service", [
      "refactor",
      "authentication",
      "service",
    ]);
    const result = classifyIntent(prompt);
    expect(result.intentType).toBe("REFACTOR");
  });

  it("classifies 'explain authentication module' as CODE_EXPLANATION", () => {
    const prompt = makePrompt("Explain authentication module", [
      "explain",
      "authentication",
      "module",
    ]);
    const result = classifyIntent(prompt);
    expect(result.intentType).toBe("CODE_EXPLANATION");
  });

  it("classifies 'find where jwt is used' as CODE_SEARCH", () => {
    const prompt = makePrompt("Find where jwt is used", [
      "find",
      "where",
      "jwt",
      "used",
    ]);
    const result = classifyIntent(prompt);
    expect(result.intentType).toBe("CODE_SEARCH");
  });
});

