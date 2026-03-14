import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildRawContext } from "./build-raw-context.js";
import type { ContextRequest, ContextBuilderAdapter } from "./raw-context.types.js";
import type { RawContextBundle } from "./raw-context.types.js";

describe("buildRawContext", () => {
  let adapter: ContextBuilderAdapter;

  beforeEach(() => {
    adapter = {
      searchSymbols: vi.fn().mockResolvedValue([]),
      searchEmbeddings: vi.fn().mockResolvedValue([]),
      getDependencies: vi.fn().mockResolvedValue([]),
    };
  });

  it("empty request returns empty bundle with repo_id preserved", async () => {
    const request: ContextRequest = {};
    const bundle = await buildRawContext("my-repo", request, adapter);

    expect(bundle.repo_id).toBe("my-repo");
    expect(bundle).toMatchObject<RawContextBundle>({
      repo_id: "my-repo",
      files: [],
      functions: [],
      classes: [],
      embeddings: [],
      dependencies: [],
    });
    expect(Array.isArray(bundle.files)).toBe(true);
    expect(Array.isArray(bundle.functions)).toBe(true);
    expect(Array.isArray(bundle.classes)).toBe(true);
    expect(Array.isArray(bundle.embeddings)).toBe(true);
    expect(Array.isArray(bundle.dependencies)).toBe(true);
  });

  it("symbol search populates files, functions, and classes", async () => {
    const request: ContextRequest = {
      symbolSearch: ["login"],
    };

    vi.mocked(adapter.searchSymbols).mockResolvedValueOnce([
      {
        filePath: "auth/login.ts",
        symbolName: "loginUser",
        kind: "function",
      },
    ]);

    const bundle = await buildRawContext("auth-service", request, adapter);

    expect(bundle.repo_id).toBe("auth-service");
    expect(adapter.searchSymbols).toHaveBeenCalledWith("login");
    expect(bundle.files).toContainEqual({
      file: "auth/login.ts",
      module: "auth",
    });
    expect(bundle.functions).toContainEqual({
      name: "loginUser",
      file: "auth/login.ts",
      module: "auth",
    });
    expect(bundle.classes).toHaveLength(0);
  });

  it("symbol search populates classes", async () => {
    const request: ContextRequest = {
      symbolSearch: ["Auth"],
    };

    vi.mocked(adapter.searchSymbols).mockResolvedValueOnce([
      {
        filePath: "auth/service.ts",
        symbolName: "AuthService",
        kind: "class",
      },
    ]);

    const bundle = await buildRawContext("auth-service", request, adapter);

    expect(bundle.classes).toContainEqual({
      name: "AuthService",
      file: "auth/service.ts",
      module: "auth",
    });
    expect(bundle.files).toContainEqual({
      file: "auth/service.ts",
      module: "auth",
    });
  });

  it("embedding search populates embeddings", async () => {
    const request: ContextRequest = {
      embeddingSearch: ["login API"],
    };

    vi.mocked(adapter.searchEmbeddings).mockResolvedValueOnce([
      {
        text: "login API handler",
        score: 0.92,
        file: "auth/login.ts",
      },
    ]);

    const bundle = await buildRawContext("auth-service", request, adapter);

    expect(adapter.searchEmbeddings).toHaveBeenCalledWith("login API");
    expect(bundle.embeddings).toContainEqual({
      file: "auth/login.ts",
      content: "login API handler",
      score: 0.92,
    });
    expect(bundle.files).toContainEqual({
      file: "auth/login.ts",
      module: "auth",
    });
  });

  it("dependency lookup populates dependencies", async () => {
    const request: ContextRequest = {
      symbolSearch: ["login"],
      dependencyLookup: true,
    };

    vi.mocked(adapter.searchSymbols).mockResolvedValue([]);
    vi.mocked(adapter.getDependencies).mockResolvedValueOnce([
      { from: "auth/login.ts", to: "auth/service.ts", type: "CALLS" },
    ]);

    const bundle = await buildRawContext("auth-service", request, adapter);

    expect(adapter.getDependencies).toHaveBeenCalledWith("login");
    expect(bundle.dependencies).toContainEqual({
      from: "auth/login.ts",
      to: "auth/service.ts",
      type: "CALLS",
    });
  });

  it("adds default type REFERENCES when dependency edge has no type", async () => {
    const request: ContextRequest = {
      symbolSearch: ["auth"],
      dependencyLookup: true,
    };

    vi.mocked(adapter.searchSymbols).mockResolvedValue([]);
    vi.mocked(adapter.getDependencies).mockResolvedValueOnce([
      { from: "AuthService", to: "UserRepository" },
    ]);

    const bundle = await buildRawContext("auth-service", request, adapter);

    expect(bundle.dependencies).toContainEqual({
      from: "AuthService",
      to: "UserRepository",
      type: "REFERENCES",
    });
  });

  it("files from embeddings are merged into bundle files", async () => {
    const request: ContextRequest = {
      embeddingSearch: ["handler"],
    };

    vi.mocked(adapter.searchEmbeddings).mockResolvedValueOnce([
      {
        text: "login API handler",
        score: 0.92,
        file: "auth/login.ts",
      },
    ]);

    const bundle = await buildRawContext("auth-service", request, adapter);

    expect(bundle.files).toContainEqual({
      file: "auth/login.ts",
      module: "auth",
    });
    expect(bundle.embeddings).toHaveLength(1);
  });

  it("removes duplicate files, functions, and embeddings", async () => {
    const request: ContextRequest = {
      symbolSearch: ["login"],
      embeddingSearch: ["login"],
    };

    vi.mocked(adapter.searchSymbols).mockResolvedValueOnce([
      { filePath: "auth/login.ts", symbolName: "loginUser", kind: "function" },
      { filePath: "auth/login.ts", symbolName: "loginUser", kind: "function" },
    ]);
    vi.mocked(adapter.searchEmbeddings).mockResolvedValueOnce([
      {
        text: "login API handler",
        score: 0.92,
        file: "auth/login.ts",
      },
      {
        text: "login API handler",
        score: 0.92,
        file: "auth/login.ts",
      },
    ]);

    const bundle = await buildRawContext("auth-service", request, adapter);

    expect(bundle.files).toHaveLength(1);
    expect(bundle.functions).toHaveLength(1);
    expect(bundle.embeddings).toHaveLength(1);
  });

  it("removes duplicate dependency edges by from+to", async () => {
    const request: ContextRequest = {
      symbolSearch: ["auth"],
      dependencyLookup: true,
    };

    vi.mocked(adapter.searchSymbols).mockResolvedValue([]);
    vi.mocked(adapter.getDependencies).mockResolvedValueOnce([
      { from: "auth/login.ts", to: "auth/service.ts", type: "CALLS" },
      { from: "auth/login.ts", to: "auth/service.ts", type: "IMPORTS" },
    ]);

    const bundle = await buildRawContext("auth-service", request, adapter);

    expect(bundle.dependencies).toHaveLength(1);
    expect(bundle.dependencies[0]).toMatchObject({
      from: "auth/login.ts",
      to: "auth/service.ts",
    });
  });

  it("repo_id is preserved in output", async () => {
    const request: ContextRequest = { symbolSearch: ["x"] };
    vi.mocked(adapter.searchSymbols).mockResolvedValueOnce([]);

    const bundle = await buildRawContext("my-repo-123", request, adapter);

    expect(bundle.repo_id).toBe("my-repo-123");
  });

  it("produces expected output shape matching example", async () => {
    const request: ContextRequest = {
      symbolSearch: ["login"],
      embeddingSearch: ["login API"],
      dependencyLookup: true,
    };

    vi.mocked(adapter.searchSymbols).mockResolvedValueOnce([
      {
        filePath: "auth/login.ts",
        symbolName: "loginUser",
        kind: "function",
      },
    ]);
    vi.mocked(adapter.searchEmbeddings).mockResolvedValueOnce([
      {
        text: "login API handler",
        score: 0.92,
        file: "auth/login.ts",
      },
    ]);
    vi.mocked(adapter.getDependencies).mockResolvedValueOnce([
      {
        from: "auth/login.ts",
        to: "auth/service.ts",
        type: "CALLS",
      },
    ]);

    const bundle = await buildRawContext("auth-service", request, adapter);

    expect(bundle).toEqual({
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
    });
  });
});
