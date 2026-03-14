import { describe, it, expect } from "vitest";
import { selectTopK, CONTEXT_LIMITS } from "./select-topk.js";
import type { RankedCandidate } from "../score-aggregator/score-aggregator.types.js";

function ranked(
  type: "file" | "function" | "class" | "chunk",
  finalScore: number,
  extra: Partial<RankedCandidate["candidate"]> = {},
): RankedCandidate {
  return {
    candidate: {
      id: `id-${type}-${finalScore}`,
      type,
      repo_id: "r1",
      file: extra.file,
      symbol: extra.symbol,
      content: extra.content,
      ...extra,
    },
    symbolScore: 0,
    embeddingScore: 0,
    dependencyScore: 0,
    fileImportanceScore: 0,
    recencyScore: 0,
    finalScore,
  };
}

describe("Top-K Selector", () => {
  it("returns empty bundle for empty input", () => {
    const result = selectTopK([]);
    expect(result).toEqual({ files: [], functions: [], snippets: [] });
  });

  it("selects candidates by score and maps to bundle", () => {
    const input: RankedCandidate[] = [
      ranked("function", 0.91, { symbol: "loginUser" }),
      ranked("file", 0.88, { file: "auth/login.ts" }),
      ranked("chunk", 0.87, {
        file: "auth/login.ts",
        content: "login API handler",
      }),
    ];
    const result = selectTopK(input);

    expect(result.files).toEqual(["auth/login.ts"]);
    expect(result.functions).toEqual(["loginUser"]);
    expect(result.snippets).toHaveLength(1);
    expect(result.snippets[0]).toEqual({
      file: "auth/login.ts",
      content: "login API handler",
      score: 0.87,
    });
  });

  it("enforces file limit (5)", () => {
    const input: RankedCandidate[] = Array.from({ length: 10 }, (_, i) =>
      ranked("file", 0.9 - i * 0.01, { file: `file-${i}.ts` }),
    );
    const result = selectTopK(input);
    expect(result.files).toHaveLength(CONTEXT_LIMITS.files);
    expect(result.files).toEqual([
      "file-0.ts",
      "file-1.ts",
      "file-2.ts",
      "file-3.ts",
      "file-4.ts",
    ]);
  });

  it("enforces functions limit (10)", () => {
    const input: RankedCandidate[] = Array.from({ length: 15 }, (_, i) =>
      ranked("function", 0.95 - i * 0.01, { symbol: `fn${i}` }),
    );
    const result = selectTopK(input);
    expect(result.functions).toHaveLength(CONTEXT_LIMITS.functions);
    expect(result.functions[0]).toBe("fn0");
    expect(result.functions[9]).toBe("fn9");
  });

  it("enforces snippets limit (10)", () => {
    const input: RankedCandidate[] = Array.from({ length: 15 }, (_, i) =>
      ranked("chunk", 0.9 - i * 0.05, {
        file: "f.ts",
        content: `content-${i}`,
      }),
    );
    const result = selectTopK(input);
    expect(result.snippets).toHaveLength(CONTEXT_LIMITS.snippets);
    expect(result.snippets[0]!.score).toBeGreaterThan(result.snippets[9]!.score);
  });

  it("higher scores replace lower scores in heaps", () => {
    const input: RankedCandidate[] = [
      ranked("file", 0.5, { file: "low.ts" }),
      ranked("file", 0.9, { file: "high.ts" }),
      ranked("file", 0.6, { file: "mid.ts" }),
    ];
    const result = selectTopK(input);
    expect(result.files).toContain("high.ts");
    expect(result.files).toContain("mid.ts");
    expect(result.files).toContain("low.ts");
    expect(result.files[0]).toBe("high.ts");
  });

  it("removes duplicate files", () => {
    const input: RankedCandidate[] = [
      ranked("file", 0.9, { file: "auth/login.ts" }),
      ranked("file", 0.85, { file: "auth/login.ts" }),
    ];
    const result = selectTopK(input);
    expect(result.files).toEqual(["auth/login.ts"]);
  });

  it("removes duplicate functions", () => {
    const input: RankedCandidate[] = [
      ranked("function", 0.9, { symbol: "loginUser" }),
      ranked("function", 0.8, { symbol: "loginUser" }),
    ];
    const result = selectTopK(input);
    expect(result.functions).toEqual(["loginUser"]);
  });

  it("removes duplicate snippets by file+content", () => {
    const input: RankedCandidate[] = [
      ranked("chunk", 0.9, {
        file: "auth/login.ts",
        content: "login API handler",
      }),
      ranked("chunk", 0.8, {
        file: "auth/login.ts",
        content: "login API handler",
      }),
    ];
    const result = selectTopK(input);
    expect(result.snippets).toHaveLength(1);
  });

  it("maps class to functions array", () => {
    const input: RankedCandidate[] = [
      ranked("class", 0.92, { symbol: "AuthService", file: "auth/service.ts" }),
    ];
    const result = selectTopK(input);
    expect(result.functions).toEqual(["AuthService"]);
  });

  it("output arrays are sorted by score descending", () => {
    const input: RankedCandidate[] = [
      ranked("function", 0.7, { symbol: "a" }),
      ranked("function", 0.9, { symbol: "b" }),
      ranked("function", 0.8, { symbol: "c" }),
    ];
    const result = selectTopK(input);
    expect(result.functions).toEqual(["b", "c", "a"]);
  });

  it("processes 10,000 candidates in under 15ms", () => {
    const input: RankedCandidate[] = Array.from({ length: 10_000 }, (_, i) => {
      const type = ["file", "function", "class", "chunk"][i % 4] as
        | "file"
        | "function"
        | "class"
        | "chunk";
      return ranked(type, Math.random(), {
        file: `f${i}.ts`,
        symbol: type !== "chunk" ? `sym${i}` : undefined,
        content: type === "chunk" ? `content ${i}` : undefined,
      });
    });
    const start = performance.now();
    const result = selectTopK(input);
    const elapsed = performance.now() - start;

    expect(result.files.length).toBeLessThanOrEqual(CONTEXT_LIMITS.files);
    expect(result.functions.length).toBeLessThanOrEqual(CONTEXT_LIMITS.functions);
    expect(result.snippets.length).toBeLessThanOrEqual(CONTEXT_LIMITS.snippets);
    expect(elapsed).toBeLessThan(15);
  });
});
