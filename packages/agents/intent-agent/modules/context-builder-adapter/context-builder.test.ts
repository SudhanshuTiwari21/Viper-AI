import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildContext } from "./build-context";
import type { ContextRequest } from "../context-request-builder/context-request.types";
import type {
  DependencyEdge,
  EmbeddingMatch,
  SymbolSearchResult,
} from "./context-builder.types";

vi.mock("./symbol-query.service", () => ({
  searchSymbols: vi.fn(),
}));

vi.mock("./embedding-query.service", () => ({
  searchEmbeddings: vi.fn(),
}));

vi.mock("./dependency-query.service", () => ({
  getDependencies: vi.fn(),
}));

const mockedSearchSymbols = vi.mocked<
  (term: string) => Promise<SymbolSearchResult[]>
>(require("./symbol-query.service").searchSymbols);

const mockedSearchEmbeddings = vi.mocked<
  (term: string) => Promise<EmbeddingMatch[]>
>(require("./embedding-query.service").searchEmbeddings);

const mockedGetDependencies = vi.mocked<
  (symbol: string) => Promise<DependencyEdge[]>
>(require("./dependency-query.service").getDependencies);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Context Builder Adapter", () => {
  it("uses symbolSearch terms to populate functions from symbol results", async () => {
    const request: ContextRequest = {
      symbolSearch: ["login"],
    };

    mockedSearchSymbols.mockResolvedValueOnce([
      {
        filePath: "src/auth/login.ts",
        symbolName: "login",
        kind: "function",
      },
    ]);

    const bundle = await buildContext(request);

    expect(mockedSearchSymbols).toHaveBeenCalledWith("login");
    expect(bundle.functions).toEqual(["login"]);
    expect(bundle.files).toEqual(["src/auth/login.ts"]);
  });

  it("uses embeddingSearch terms to populate embeddingMatches", async () => {
    const request: ContextRequest = {
      embeddingSearch: ["login API"],
    };

    mockedSearchEmbeddings.mockResolvedValueOnce([
      { text: "login handler in auth module", score: 0.92 },
    ]);

    const bundle = await buildContext(request);

    expect(mockedSearchEmbeddings).toHaveBeenCalledWith("login API");
    expect(bundle.embeddingMatches).toEqual([
      { text: "login handler in auth module", score: 0.92 },
    ]);
  });

  it("performs dependencyLookup when requested", async () => {
    const request: ContextRequest = {
      symbolSearch: ["auth"],
      dependencyLookup: true,
    };

    mockedSearchSymbols.mockResolvedValueOnce([]);
    mockedGetDependencies.mockResolvedValueOnce([
      { from: "AuthService", to: "UserRepository" },
    ]);

    const bundle = await buildContext(request);

    expect(mockedGetDependencies).toHaveBeenCalledWith("auth");
    expect(bundle.dependencies).toEqual([
      { from: "AuthService", to: "UserRepository" },
    ]);
  });
});

