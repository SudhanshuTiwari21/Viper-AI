import { describe, it, expect } from "vitest";
import { computeCandidateScores } from "./compute-candidate-scores.js";
import type { ContextCandidate } from "../candidate-generator/candidate.types.js";
import type { ScoringContext } from "./scoring.types.js";

function makeContext(overrides: Partial<ScoringContext> = {}): ScoringContext {
  return {
    query: "",
    entities: [],
    rawContext: {},
    ...overrides,
  };
}

describe("Scoring Engine", () => {
  it("symbol candidates receive symbolScore", () => {
    const candidates: ContextCandidate[] = [
      {
        id: "f1",
        type: "function",
        repo_id: "r1",
        symbol: "loginUser",
        file: "auth/login.ts",
      },
      {
        id: "c1",
        type: "file",
        repo_id: "r1",
        file: "auth/login.ts",
      },
    ];
    const context = makeContext({ entities: ["login"] });
    const scored = computeCandidateScores(candidates, context);

    const fnCandidate = scored.find((s) => s.candidate.type === "function");
    const fileCandidate = scored.find((s) => s.candidate.type === "file");
    expect(fnCandidate!.symbolScore).toBeGreaterThan(0);
    expect(fnCandidate!.symbolScore).toBeLessThanOrEqual(1);
    expect(fileCandidate!.symbolScore).toBe(0);
  });

  it("exact entity match gives high symbolScore", () => {
    const candidates: ContextCandidate[] = [
      {
        id: "f1",
        type: "function",
        repo_id: "r1",
        symbol: "login",
        file: "auth/login.ts",
      },
    ];
    const context = makeContext({ entities: ["login"] });
    const scored = computeCandidateScores(candidates, context);
    expect(scored[0]!.symbolScore).toBe(1);
  });

  it("chunk candidates receive embeddingScore", () => {
    const candidates: ContextCandidate[] = [
      {
        id: "ch1",
        type: "chunk",
        repo_id: "r1",
        file: "auth/login.ts",
        content: "login API handler",
      },
      {
        id: "f1",
        type: "function",
        repo_id: "r1",
        symbol: "login",
        file: "auth/login.ts",
      },
    ];
    const context = makeContext({ query: "fix login api" });
    const scored = computeCandidateScores(candidates, context);

    const chunkCandidate = scored.find((s) => s.candidate.type === "chunk");
    const fnCandidate = scored.find((s) => s.candidate.type === "function");
    expect(chunkCandidate!.embeddingScore).toBeGreaterThan(0);
    expect(chunkCandidate!.embeddingScore).toBeLessThanOrEqual(1);
    expect(fnCandidate!.embeddingScore).toBe(0);
  });

  it("dependency graph boosts related symbols", () => {
    const candidates: ContextCandidate[] = [
      {
        id: "loginUser",
        type: "function",
        repo_id: "r1",
        symbol: "loginUser",
        file: "auth/login.ts",
      },
      {
        id: "authService",
        type: "class",
        repo_id: "r1",
        symbol: "AuthService",
        file: "auth/service.ts",
      },
      {
        id: "jwtToken",
        type: "function",
        repo_id: "r1",
        symbol: "jwtToken",
        file: "auth/jwt.ts",
      },
    ];
    const context = makeContext({
      entities: ["loginUser"],
      rawContext: {
        dependencies: [
          { from: "loginUser", to: "AuthService", type: "CALLS" },
          { from: "AuthService", to: "jwtToken", type: "CALLS" },
        ],
      },
    });
    const scored = computeCandidateScores(candidates, context);

    const loginUser = scored.find((s) => s.candidate.symbol === "loginUser");
    const authService = scored.find((s) => s.candidate.symbol === "AuthService");
    const jwtToken = scored.find((s) => s.candidate.symbol === "jwtToken");

    expect(loginUser!.dependencyScore).toBe(1); // distance 0 -> 1/(0+1)=1
    expect(authService!.dependencyScore).toBe(0.5); // distance 1 -> 1/2
    expect(jwtToken!.dependencyScore).toBeCloseTo(0.33, 2); // distance 2 -> 1/3
  });

  it("file importance applies to controller and service paths", () => {
    const candidates: ContextCandidate[] = [
      { id: "1", type: "file", repo_id: "r1", file: "src/routes/auth.ts" },
      { id: "2", type: "file", repo_id: "r1", file: "src/controllers/user.ts" },
      { id: "3", type: "file", repo_id: "r1", file: "src/services/auth.ts" },
      { id: "4", type: "file", repo_id: "r1", file: "src/utils/helpers.ts" },
      { id: "5", type: "file", repo_id: "r1", file: "src/other/foo.ts" },
    ];
    const context = makeContext();
    const scored = computeCandidateScores(candidates, context);

    expect(scored[0]!.fileImportanceScore).toBe(0.2);
    expect(scored[1]!.fileImportanceScore).toBe(0.2);
    expect(scored[2]!.fileImportanceScore).toBe(0.15);
    expect(scored[3]!.fileImportanceScore).toBe(0.05);
    expect(scored[4]!.fileImportanceScore).toBe(0);
  });

  it("recency score applies to recently opened files", () => {
    const candidates: ContextCandidate[] = [
      { id: "1", type: "file", repo_id: "r1", file: "auth/login.ts" },
      { id: "2", type: "file", repo_id: "r1", file: "other/bar.ts" },
    ];
    const context = makeContext({ openedFiles: ["auth/login.ts", "auth/service.ts"] });
    const scored = computeCandidateScores(candidates, context);

    expect(scored[0]!.recencyScore).toBe(0.2);
    expect(scored[1]!.recencyScore).toBe(0);
  });

  it("scores always remain between 0 and 1", () => {
    const candidates: ContextCandidate[] = [
      { id: "1", type: "function", repo_id: "r1", symbol: "loginUser", file: "auth/login.ts" },
      { id: "2", type: "chunk", repo_id: "r1", file: "auth/login.ts", content: "login API" },
      { id: "3", type: "file", repo_id: "r1", file: "services/core.ts" },
    ];
    const context = makeContext({
      query: "fix login",
      entities: ["login"],
      rawContext: { dependencies: [{ from: "loginUser", to: "Auth", type: "CALLS" }] },
      openedFiles: ["auth/login.ts"],
    });
    const scored = computeCandidateScores(candidates, context);

    for (const s of scored) {
      expect(s.symbolScore).toBeGreaterThanOrEqual(0);
      expect(s.symbolScore).toBeLessThanOrEqual(1);
      expect(s.embeddingScore).toBeGreaterThanOrEqual(0);
      expect(s.embeddingScore).toBeLessThanOrEqual(1);
      expect(s.dependencyScore).toBeGreaterThanOrEqual(0);
      expect(s.dependencyScore).toBeLessThanOrEqual(1);
      expect(s.fileImportanceScore).toBeGreaterThanOrEqual(0);
      expect(s.fileImportanceScore).toBeLessThanOrEqual(1);
      expect(s.recencyScore).toBeGreaterThanOrEqual(0);
      expect(s.recencyScore).toBeLessThanOrEqual(1);
    }
  });

  it("produces expected output shape", () => {
    const candidates: ContextCandidate[] = [
      {
        id: "function:auth/login.ts:loginUser",
        type: "function",
        repo_id: "r1",
        symbol: "loginUser",
        file: "auth/login.ts",
      },
    ];
    const context = makeContext({
      entities: ["loginUser"],
      rawContext: {
        dependencies: [{ from: "loginUser", to: "AuthService", type: "CALLS" }],
      },
    });
    const scored = computeCandidateScores(candidates, context);

    expect(scored).toHaveLength(1);
    expect(scored[0]).toMatchObject({
      candidate: { type: "function", symbol: "loginUser" },
      symbolScore: expect.any(Number),
      embeddingScore: 0,
      dependencyScore: 1,
      fileImportanceScore: expect.any(Number),
      recencyScore: expect.any(Number),
    });
    expect(scored[0]!.candidate).toBe(candidates[0]);
  });

  it("handles 1000+ candidates in under 10ms", () => {
    const candidates: ContextCandidate[] = Array.from({ length: 1200 }, (_, i) => ({
      id: `cand-${i}`,
      type: i % 4 === 0 ? "file" : i % 4 === 1 ? "function" : i % 4 === 2 ? "class" : "chunk",
      repo_id: "r1",
      file: `src/file-${i}.ts`,
      symbol: i % 4 !== 3 ? `symbol${i}` : undefined,
      content: i % 4 === 3 ? `content ${i}` : undefined,
    }));
    const context = makeContext({
      query: "test query",
      entities: ["symbol1"],
      rawContext: { dependencies: [] },
      openedFiles: ["src/file-0.ts"],
    });
    const start = performance.now();
    const scored = computeCandidateScores(candidates, context);
    const elapsed = performance.now() - start;

    expect(scored).toHaveLength(1200);
    expect(elapsed).toBeLessThan(10);
  });
});
