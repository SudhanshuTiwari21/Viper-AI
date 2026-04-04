import { describe, it, expect } from "vitest";
import {
  buildRetrievalConfidence,
  RETRIEVAL_CONFIDENCE_SCHEMA_VERSION,
} from "./build-retrieval-confidence.js";
import type { RankedCandidate } from "../score-aggregator/score-aggregator.types.js";
import type { ContextWindow } from "../context-window-builder/context-window.types.js";

function cand(
  type: RankedCandidate["candidate"]["type"],
  finalScore: number,
  file = "a.ts",
): RankedCandidate {
  return {
    candidate: {
      id: `${type}-${file}`,
      type,
      repo_id: "r1",
      file: type === "file" || type === "chunk" ? file : undefined,
      symbol: type === "function" ? "fn" : undefined,
      content: type === "chunk" ? "x" : undefined,
    },
    embeddingScore: finalScore,
    symbolScore: finalScore,
    dependencyScore: finalScore,
    fileImportanceScore: finalScore,
    recencyScore: finalScore,
    finalScore,
  };
}

describe("buildRetrievalConfidence", () => {
  const emptyWindow = (): ContextWindow => ({
    files: [],
    functions: [],
    snippets: [],
    estimatedTokens: 0,
  });

  it("schema_version is 1.0", () => {
    const ranked: RankedCandidate[] = [];
    const c = buildRetrievalConfidence({
      rankedCandidates: ranked,
      bundle: { files: [], functions: [], snippets: [] },
      contextWindow: emptyWindow(),
    });
    expect(c.schema_version).toBe(RETRIEVAL_CONFIDENCE_SCHEMA_VERSION);
  });

  it("no candidates → overall 0 and degraded", () => {
    const c = buildRetrievalConfidence({
      rankedCandidates: [],
      bundle: { files: [], functions: [], snippets: [] },
      contextWindow: { files: [], functions: [], snippets: [], estimatedTokens: 0 },
    });
    expect(c.overall).toBe(0);
    expect(c.index_state).toBe("degraded");
    expect(c.counts.candidatesConsidered).toBe(0);
  });

  it("snippets: overall is blend of max and mean scores", () => {
    const ranked: RankedCandidate[] = [
      cand("chunk", 0.8, "f1.ts"),
      cand("chunk", 0.4, "f2.ts"),
    ];
    const bundle = {
      files: [] as string[],
      functions: [] as string[],
      snippets: [
        { file: "f1.ts", content: "a", score: 0.8 },
        { file: "f2.ts", content: "b", score: 0.4 },
      ],
    };
    const w: ContextWindow = {
      files: [],
      functions: [],
      snippets: ["a", "b"],
      estimatedTokens: 200,
    };
    const c = buildRetrievalConfidence({
      rankedCandidates: ranked,
      bundle,
      contextWindow: w,
    });
    expect(c.overall).toBeCloseTo(0.5 * 0.8 + 0.5 * ((0.8 + 0.4) / 2), 6);
    expect(c.signals?.maxScore).toBe(0.8);
    expect(c.signals?.meanScore).toBeCloseTo((0.8 + 0.4) / 2, 6);
    expect(c.counts.estimatedTokens).toBe(200);
    expect(c.index_state).toBe("ready");
  });

  it("files only in bundle uses scaled poolMax", () => {
    const ranked: RankedCandidate[] = [cand("file", 0.5, "x.ts")];
    const c = buildRetrievalConfidence({
      rankedCandidates: ranked,
      bundle: {
        files: ["x.ts"],
        functions: [],
        snippets: [],
      },
      contextWindow: { files: ["x.ts"], functions: [], snippets: [], estimatedTokens: 10 },
    });
    expect(c.overall).toBeCloseTo(0.5 * 0.85, 6);
    expect(c.signals?.maxScore).toBe(0.5);
    expect(c.signals?.meanScore).toBeUndefined();
  });

  it("non-empty pool but empty bundle uses weaker scale", () => {
    const ranked: RankedCandidate[] = [cand("chunk", 0.6, "z.ts")];
    const c = buildRetrievalConfidence({
      rankedCandidates: ranked,
      bundle: { files: [], functions: [], snippets: [] },
      contextWindow: emptyWindow(),
    });
    expect(c.overall).toBeCloseTo(0.6 * 0.35, 6);
  });
});
