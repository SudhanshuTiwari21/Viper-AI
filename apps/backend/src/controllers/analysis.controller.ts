import type { FastifyReply, FastifyRequest } from "fastify";
import { getPool } from "@repo/database";
import {
  runFullAnalysis,
  RepoMetadataStoreService,
  GraphStoreService,
  PostgresGraphStoreAdapter,
  VectorStoreService,
  QdrantVectorStoreAdapter,
} from "@repo/codebase-analysis-agent";
import { PostgresRepoMetadataAdapter } from "@repo/codebase-analysis-agent/persistence/postgres-repo";
import { getRepoId } from "../services/workspace.service.js";
import type { AnalysisRequest } from "../validators/request.schemas.js";

/** Scan-only: run Repo Scanner and return result (no workers). For testing with IDE workspace. */
export async function runAnalysisScan(
  request: FastifyRequest<{ Body: AnalysisRequest }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { workspacePath } = request.body;
    const repo_id = getRepoId(workspacePath);
    const codebaseAnalysisModule = "@repo/codebase-analysis-agent";
    const analysis = (await import(codebaseAnalysisModule)) as {
      runRepoScanner: (input: { workspacePath: string; repo_id: string }) => Promise<{
        workspacePath: string;
        repo_id: string;
        files: Array<{ file: string; language: string; module: string; type: string }>;
        sourceFiles: Array<{ file: string; language: string; module: string }>;
        jobs: Array<{ repo: string; file: string; language: string; module: string }>;
      }>;
    };
    const result = await analysis.runRepoScanner({ workspacePath, repo_id });
    await reply.send(result);
  } catch (err) {
    request.log.error(err);
    await reply.status(500).send({
      error: err instanceof Error ? err.message : "Scan failed",
    });
  }
}

export async function runAnalysis(
  request: FastifyRequest<{ Body: AnalysisRequest }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { workspacePath } = request.body;
    const repo_id = getRepoId(workspacePath);

    const redisUrl = process.env.REDIS_URL;
    const databaseUrl = process.env.DATABASE_URL;
    const qdrantUrl = process.env.QDRANT_URL;

    const options: Parameters<typeof runFullAnalysis>[1] = {};
    if (redisUrl) options.redis = { url: redisUrl };

    if (databaseUrl) {
      const pool = getPool();
      const repoMetadataStore = new RepoMetadataStoreService();
      repoMetadataStore.setAdapter(new PostgresRepoMetadataAdapter(pool));
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

    await runFullAnalysis({ workspacePath, repo_id }, options);

    await reply.send({ status: "analysis_started" });
  } catch (err) {
    request.log.error(err);
    await reply.status(500).send({
      error: err instanceof Error ? err.message : "Analysis failed",
    });
  }
}
