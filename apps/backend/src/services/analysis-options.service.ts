/**
 * Build options for runFullAnalysis. Shared by analysis controller and assistant pipeline.
 */
import { getPool } from "@repo/database";
import {
  runFullAnalysis,
  RepoMetadataStoreService,
  GraphStoreService,
  PostgresGraphStoreAdapter,
  VectorStoreService,
  QdrantVectorStoreAdapter,
} from "@repo/codebase-analysis-agent";

export type RunFullAnalysisOptions = Parameters<typeof runFullAnalysis>[1];

export async function buildAnalysisOptions(): Promise<RunFullAnalysisOptions> {
  const options: RunFullAnalysisOptions = {};
  const redisUrl = process.env.REDIS_URL;
  const databaseUrl = process.env.DATABASE_URL;
  const qdrantUrl = process.env.QDRANT_URL;

  if (redisUrl) options.redis = { url: redisUrl };

  if (databaseUrl) {
    const pool = getPool();
    const { default: PostgresRepoMetadataAdapter } = await import(
      "@repo/codebase-analysis-agent/persistence/postgres-repo"
    );
    const repoMetadataStore = new RepoMetadataStoreService();
    const adapter = new PostgresRepoMetadataAdapter(pool);
    repoMetadataStore.setAdapter(adapter);
    options.persistMetadata = repoMetadataStore;

    const graphStore = new GraphStoreService();
    graphStore.setAdapter(new PostgresGraphStoreAdapter(pool));
    options.graphStore = graphStore;
  }

  if (qdrantUrl) {
    const vectorStore = new VectorStoreService();
    vectorStore.setAdapter(new QdrantVectorStoreAdapter());
    options.vectorStore = vectorStore;
  }

  return options;
}

/**
 * Run full codebase analysis (scan, AST, metadata, graph, embeddings).
 * Uses REDIS_URL, DATABASE_URL, QDRANT_URL. No-op if REDIS_URL is missing.
 */
export async function runCodebaseAnalysisIfConfigured(
  workspacePath: string,
  repo_id: string,
): Promise<boolean> {
  const options = await buildAnalysisOptions();
  if (!options?.redis?.url) return false;
  await runFullAnalysis({ workspacePath, repo_id }, options as NonNullable<typeof options>);
  return true;
}
