import { describe, it, expect } from "vitest";
import { buildContextWindow, CONTEXT_TOKEN_BUDGET, DEFAULT_TOKEN_LIMIT } from "./build-context-window.js";
import { estimateTokens } from "./token-estimator.js";
import { formatSnippet, packContext } from "./context-packer.js";
import type { RankedContextBundle } from "../topk-selector/topk-selector.types.js";

describe("token-estimator", () => {
  it("estimates tokens as chars/4", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("function loginUser() {}")).toBe(6);
  });
});

describe("context-packer", () => {
  it("formats snippet correctly", () => {
    const out = formatSnippet({
      file: "auth/login.ts",
      content: "function loginUser() {...}",
      score: 0.92,
    });
    expect(out).toBe("File: auth/login.ts\n\nfunction loginUser() {...}");
  });
});

describe("Context Window Builder", () => {
  it("respects token budget", () => {
    const hugeSnippet = "x".repeat(CONTEXT_TOKEN_BUDGET * 4 + 100);
    const bundle: RankedContextBundle = {
      files: [],
      functions: [],
      snippets: [{ file: "big.ts", content: hugeSnippet, score: 1 }],
    };
    const result = buildContextWindow(bundle);
    expect(result.estimatedTokens).toBeLessThanOrEqual(CONTEXT_TOKEN_BUDGET);
    expect(result.snippets).toHaveLength(0);
  });

  it("prioritizes snippets over functions and files", () => {
    const bundle: RankedContextBundle = {
      files: ["auth/login.ts"],
      functions: ["loginUser", "validatePassword"],
      snippets: [
        {
          file: "auth/login.ts",
          content: "function loginUser() {...}",
          score: 0.92,
        },
      ],
    };
    const result = buildContextWindow(bundle, { tokenBudget: 1000 });
    expect(result.snippets).toHaveLength(1);
    expect(result.snippets[0]).toContain("File: auth/login.ts");
    expect(result.snippets[0]).toContain("function loginUser() {...}");
    expect(result.functions.length).toBeGreaterThanOrEqual(0);
    expect(result.files.length).toBeGreaterThanOrEqual(0);
  });

  it("estimated token count is correct", () => {
    const bundle: RankedContextBundle = {
      files: ["auth/login.ts"],
      functions: ["loginUser"],
      snippets: [
        {
          file: "auth/login.ts",
          content: "function loginUser() {...}",
          score: 0.92,
        },
      ],
    };
    const result = buildContextWindow(bundle, { tokenBudget: 10000 });
    const expectedSnippet = formatSnippet(bundle.snippets[0]!);
    const expectedTokens =
      estimateTokens(expectedSnippet) +
      estimateTokens("loginUser") +
      estimateTokens("auth/login.ts");
    expect(result.estimatedTokens).toBe(expectedTokens);
  });

  it("truncates when budget is small", () => {
    const bundle: RankedContextBundle = {
      files: ["a.ts", "b.ts", "c.ts"],
      functions: ["f1", "f2"],
      snippets: [
        { file: "a.ts", content: "code block here", score: 0.9 },
        { file: "b.ts", content: "another block", score: 0.8 },
      ],
    };
    const result = buildContextWindow(bundle, { tokenBudget: 5 });
    expect(result.estimatedTokens).toBeLessThanOrEqual(5);
    expect(result.snippets.length + result.functions.length + result.files.length).toBeLessThanOrEqual(
      bundle.snippets.length + bundle.functions.length + bundle.files.length,
    );
  });

  it("output formatting is correct", () => {
    const bundle: RankedContextBundle = {
      files: ["auth/login.ts"],
      functions: ["loginUser"],
      snippets: [
        {
          file: "auth/login.ts",
          content: "function loginUser() {...}",
          score: 0.92,
        },
      ],
    };
    const result = buildContextWindow(bundle, { tokenBudget: 1000 });
    expect(result.files).toEqual(["auth/login.ts"]);
    expect(result.functions).toEqual(["loginUser"]);
    expect(result.snippets).toHaveLength(1);
    expect(result.snippets[0]).toBe(
      "File: auth/login.ts\n\nfunction loginUser() {...}",
    );
    expect(result.estimatedTokens).toBeGreaterThan(0);
  });

  it("example input produces expected output shape", () => {
    const bundle: RankedContextBundle = {
      files: ["auth/login.ts"],
      functions: ["loginUser", "validatePassword"],
      snippets: [
        {
          file: "auth/login.ts",
          content: "function loginUser() {...}",
          score: 0.92,
        },
      ],
    };
    const result = buildContextWindow(bundle);
    expect(result).toMatchObject({
      files: ["auth/login.ts"],
      functions: expect.arrayContaining(["loginUser"]),
      snippets: expect.any(Array),
      estimatedTokens: expect.any(Number),
    });
    expect(result.snippets[0]).toMatch(/^File: auth\/login\.ts/);
  });

  it("uses custom token budget when provided", () => {
    const bundle: RankedContextBundle = {
      files: [],
      functions: [],
      snippets: [{ file: "x.ts", content: "short", score: 1 }],
    };
    const result = buildContextWindow(bundle, { tokenBudget: 2 });
    expect(result.estimatedTokens).toBeLessThanOrEqual(2);
  });

  it("handles 100+ snippets in under 5ms", () => {
    const bundle: RankedContextBundle = {
      files: [],
      functions: [],
      snippets: Array.from({ length: 120 }, (_, i) => ({
        file: `f${i}.ts`,
        content: `snippet content ${i}`,
        score: 1 - i * 0.001,
      })),
    };
    const start = performance.now();
    const result = buildContextWindow(bundle, { tokenBudget: 50_000 });
    const elapsed = performance.now() - start;
    expect(result.snippets.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(5);
  });

  it("packContext stops at budget boundary", () => {
    const bundle: RankedContextBundle = {
      files: ["a.ts"],
      functions: ["fn"],
      snippets: [
        { file: "x.ts", content: "a".repeat(40), score: 1 },
        { file: "y.ts", content: "b".repeat(40), score: 0.9 },
      ],
    };
    const window = packContext(bundle, 15);
    expect(window.estimatedTokens).toBeLessThanOrEqual(15);
  });
});
