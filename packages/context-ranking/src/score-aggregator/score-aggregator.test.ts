import { describe, it, expect } from "vitest";
import { combineScores, SCORE_WEIGHTS } from "./combine-scores.js";
import type { ScoredCandidate } from "../scoring-engine/scoring.types.js";

function makeScored(overrides: Partial<ScoredCandidate> = {}): ScoredCandidate {
  return {
    candidate: { id: "c1", type: "file", repo_id: "r1" },
    symbolScore: 0,
    embeddingScore: 0,
    dependencyScore: 0,
    fileImportanceScore: 0,
    recencyScore: 0,
    ...overrides,
  };
}

describe("Score Aggregator", () => {
  it("weights sum to 1.0", () => {
    const sum =
      SCORE_WEIGHTS.embedding +
      SCORE_WEIGHTS.symbol +
      SCORE_WEIGHTS.dependency +
      SCORE_WEIGHTS.fileImportance +
      SCORE_WEIGHTS.recency;
    expect(sum).toBe(1);
  });

  it("produces correct weighted finalScore", () => {
    const input: ScoredCandidate[] = [
      makeScored({
        candidate: { id: "loginUser", type: "function", repo_id: "r1" },
        symbolScore: 0.9,
        embeddingScore: 0.4,
        dependencyScore: 1.0,
        fileImportanceScore: 0.15,
        recencyScore: 0,
      }),
    ];
    const result = combineScores(input);

    const expected =
      0.35 * 0.4 + 0.25 * 0.9 + 0.25 * 1.0 + 0.1 * 0.15 + 0.05 * 0;
    expect(result).toHaveLength(1);
    expect(result[0]!.finalScore).toBeCloseTo(expected, 10);
    expect(result[0]!.finalScore).toBeCloseTo(0.63, 2);
  });

  it("clamps finalScore to [0, 1]", () => {
    const high = makeScored({
      symbolScore: 1,
      embeddingScore: 1,
      dependencyScore: 1,
      fileImportanceScore: 1,
      recencyScore: 1,
    });
    const low = makeScored({
      symbolScore: -0.5,
      embeddingScore: -0.5,
      dependencyScore: -0.5,
      fileImportanceScore: -0.5,
      recencyScore: -0.5,
    });
    const resultHigh = combineScores([high]);
    const resultLow = combineScores([low]);

    expect(resultHigh[0]!.finalScore).toBeLessThanOrEqual(1);
    expect(resultHigh[0]!.finalScore).toBe(1);
    expect(resultLow[0]!.finalScore).toBeGreaterThanOrEqual(0);
    expect(resultLow[0]!.finalScore).toBe(0);
  });

  it("does not mutate input array or objects", () => {
    const input: ScoredCandidate[] = [
      makeScored({ symbolScore: 0.5, embeddingScore: 0.5 }),
    ];
    const originalFirst = input[0]!;
    const originalSymbolScore = originalFirst.symbolScore;

    const result = combineScores(input);

    expect(input[0]).toBe(originalFirst);
    expect(input[0]!.symbolScore).toBe(originalSymbolScore);
    expect(result[0]).not.toBe(input[0]);
    expect(result[0]!.candidate).toBe(input[0]!.candidate);
  });

  it("returns same number of candidates as input", () => {
    const input: ScoredCandidate[] = [
      makeScored(),
      makeScored({ symbolScore: 0.3 }),
      makeScored({ embeddingScore: 0.7 }),
    ];
    const result = combineScores(input);
    expect(result).toHaveLength(3);
  });

  it("preserves all signal scores on output", () => {
    const input: ScoredCandidate[] = [
      makeScored({
        symbolScore: 0.9,
        embeddingScore: 0.4,
        dependencyScore: 1.0,
        fileImportanceScore: 0.15,
        recencyScore: 0.2,
      }),
    ];
    const result = combineScores(input);

    expect(result[0]!.symbolScore).toBe(0.9);
    expect(result[0]!.embeddingScore).toBe(0.4);
    expect(result[0]!.dependencyScore).toBe(1.0);
    expect(result[0]!.fileImportanceScore).toBe(0.15);
    expect(result[0]!.recencyScore).toBe(0.2);
    expect(result[0]!.candidate).toEqual(input[0]!.candidate);
  });

  it("optionally attaches debug score breakdown", () => {
    const input: ScoredCandidate[] = [
      makeScored({
        symbolScore: 0.8,
        embeddingScore: 0.6,
        dependencyScore: 0.5,
        fileImportanceScore: 0.2,
        recencyScore: 0.2,
      }),
    ];
    const result = combineScores(input, { debug: true });

    expect(result[0]!.debug).toEqual({
      embedding: 0.6,
      symbol: 0.8,
      dependency: 0.5,
      fileImportance: 0.2,
      recency: 0.2,
    });
  });

  it("handles 2000+ candidates in under 2ms", () => {
    const input: ScoredCandidate[] = Array.from({ length: 2500 }, (_, i) =>
      makeScored({
        symbolScore: i % 10 / 10,
        embeddingScore: (i % 7) / 7,
        dependencyScore: (i % 5) / 5,
        fileImportanceScore: (i % 4) / 4,
        recencyScore: i % 3 === 0 ? 0.2 : 0,
      }),
    );
    const start = performance.now();
    const result = combineScores(input);
    const elapsed = performance.now() - start;

    expect(result).toHaveLength(2500);
    expect(elapsed).toBeLessThan(2);
  });
});
