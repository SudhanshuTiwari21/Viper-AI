/**
 * Type shim for @repo/codebase-analysis-agent so the backend build does not
 * type-check the agent's source (which uses NodeNext and would require .js
 * extensions everywhere). At runtime the real package is loaded.
 */
declare module "@repo/codebase-analysis-agent" {
  export class RepoMetadataStoreService {
    setAdapter(adapter: unknown): void;
    saveRepository(params: { repo_id: string; workspacePath: string; branch?: string }): Promise<string>;
    insertRepositoryFiles(repoId: string, filesList: unknown[]): Promise<void>;
  }
  export class GraphStoreService {
    setAdapter(adapter: unknown): void;
  }
  export class PostgresGraphStoreAdapter {
    constructor(client: { query: (text: string, values?: unknown[]) => Promise<{ rows: unknown[] }> });
  }
  export class VectorStoreService {
    setAdapter(adapter: unknown): void;
  }
  export class QdrantVectorStoreAdapter {}

  export function runFullAnalysis(
    input: { workspacePath: string; repo_id: string; branch?: string },
    options?: {
      redis?: { url?: string; host?: string; port?: number };
      persistMetadata?: RepoMetadataStoreService;
      graphStore?: GraphStoreService;
      vectorStore?: VectorStoreService;
      getRepoRoot?: (repo: string) => string;
      embeddingModel?: unknown;
    }
  ): Promise<{ status: "started"; scan: unknown }>;
}

declare module "@repo/codebase-analysis-agent/persistence/postgres-repo" {
  export class PostgresRepoMetadataAdapter {
    constructor(client: { query: (text: string, values?: unknown[]) => Promise<{ rows: unknown[] }> });
  }
}
