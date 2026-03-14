import { describe, it, expect } from "vitest";
import { generateCandidates } from "./generate-candidates.js";
import type { RawContextBundle } from "@repo/context-builder";

function makeRaw(overrides: Partial<RawContextBundle> = {}): RawContextBundle {
  return {
    repo_id: "test-repo",
    files: [],
    functions: [],
    classes: [],
    embeddings: [],
    dependencies: [],
    ...overrides,
  };
}

describe("generateCandidates", () => {
  it("files produce file candidates", () => {
    const raw = makeRaw({
      files: [
        { file: "auth/login.ts", module: "auth" },
        { file: "auth/service.ts", module: "auth" },
      ],
    });
    const candidates = generateCandidates(raw);

    expect(candidates).toHaveLength(2);
    const fileCandidates = candidates.filter((c) => c.type === "file");
    expect(fileCandidates).toHaveLength(2);
    expect(fileCandidates).toContainEqual({
      id: "auth/login.ts",
      type: "file",
      repo_id: "test-repo",
      file: "auth/login.ts",
      module: "auth",
    });
    expect(fileCandidates).toContainEqual({
      id: "auth/service.ts",
      type: "file",
      repo_id: "test-repo",
      file: "auth/service.ts",
      module: "auth",
    });
  });

  it("functions produce function candidates", () => {
    const raw = makeRaw({
      functions: [
        { name: "loginUser", file: "auth/login.ts", module: "auth" },
      ],
    });
    const candidates = generateCandidates(raw);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toEqual({
      id: "function:auth/login.ts:loginUser",
      type: "function",
      repo_id: "test-repo",
      file: "auth/login.ts",
      symbol: "loginUser",
      module: "auth",
    });
  });

  it("classes produce class candidates", () => {
    const raw = makeRaw({
      classes: [
        { name: "AuthService", file: "auth/service.ts", module: "auth" },
      ],
    });
    const candidates = generateCandidates(raw);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toEqual({
      id: "class:auth/service.ts:AuthService",
      type: "class",
      repo_id: "test-repo",
      file: "auth/service.ts",
      symbol: "AuthService",
      module: "auth",
    });
  });

  it("embeddings produce chunk candidates", () => {
    const raw = makeRaw({
      embeddings: [
        {
          file: "auth/login.ts",
          content: "login API handler",
          score: 0.92,
        },
      ],
    });
    const candidates = generateCandidates(raw);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toEqual({
      id: "chunk:auth/login.ts:login API handler",
      type: "chunk",
      repo_id: "test-repo",
      file: "auth/login.ts",
      content: "login API handler",
    });
  });

  it("dependencies are ignored", () => {
    const raw = makeRaw({
      dependencies: [
        { from: "auth/login.ts", to: "auth/service.ts", type: "CALLS" },
      ],
    });
    const candidates = generateCandidates(raw);

    expect(candidates).toHaveLength(0);
  });

  it("duplicates are removed by id", () => {
    const raw = makeRaw({
      files: [
        { file: "auth/login.ts", module: "auth" },
        { file: "auth/login.ts", module: "auth" },
      ],
      functions: [
        { name: "loginUser", file: "auth/login.ts" },
        { name: "loginUser", file: "auth/login.ts" },
      ],
      embeddings: [
        { file: "auth/login.ts", content: "same content", score: 0.9 },
        { file: "auth/login.ts", content: "same content", score: 0.8 },
      ],
    });
    const candidates = generateCandidates(raw);

    const fileCandidates = candidates.filter((c) => c.type === "file");
    const functionCandidates = candidates.filter((c) => c.type === "function");
    const chunkCandidates = candidates.filter((c) => c.type === "chunk");

    expect(fileCandidates).toHaveLength(1);
    expect(functionCandidates).toHaveLength(1);
    expect(chunkCandidates).toHaveLength(1);
    expect(candidates).toHaveLength(3);
  });

  it("preserves repo_id on all candidates", () => {
    const raw = makeRaw({
      repo_id: "my-repo-123",
      files: [{ file: "src/index.ts" }],
      functions: [{ name: "main", file: "src/index.ts" }],
    });
    const candidates = generateCandidates(raw);

    expect(candidates.every((c) => c.repo_id === "my-repo-123")).toBe(true);
    expect(candidates).toHaveLength(2);
  });

  it("example RawContextBundle generates expected candidate array", () => {
    const raw: RawContextBundle = {
      repo_id: "auth-service",
      files: [{ file: "auth/login.ts", module: "auth" }],
      functions: [
        { name: "loginUser", file: "auth/login.ts", module: "auth" },
      ],
      classes: [],
      embeddings: [
        {
          file: "auth/login.ts",
          content: "login API handler",
          score: 0.92,
        },
      ],
      dependencies: [
        {
          from: "auth/login.ts",
          to: "auth/service.ts",
          type: "CALLS",
        },
      ],
    };

    const candidates = generateCandidates(raw);

    expect(candidates).toHaveLength(3);

    expect(candidates).toContainEqual({
      id: "auth/login.ts",
      type: "file",
      repo_id: "auth-service",
      file: "auth/login.ts",
      module: "auth",
    });
    expect(candidates).toContainEqual({
      id: "function:auth/login.ts:loginUser",
      type: "function",
      repo_id: "auth-service",
      file: "auth/login.ts",
      symbol: "loginUser",
      module: "auth",
    });
    expect(candidates).toContainEqual({
      id: "chunk:auth/login.ts:login API handler",
      type: "chunk",
      repo_id: "auth-service",
      file: "auth/login.ts",
      content: "login API handler",
    });
  });
});
