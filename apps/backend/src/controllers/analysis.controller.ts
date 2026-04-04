import type { FastifyReply, FastifyRequest } from "fastify";
import {
  runFullAnalysis,
} from "@repo/codebase-analysis-agent";
import { getRepoId } from "../services/workspace.service.js";
import { buildAnalysisOptions } from "../services/analysis-options.service.js";
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

    request.log.info(
      { redisUrl: process.env.REDIS_URL, databaseUrl: process.env.DATABASE_URL, qdrantUrl: process.env.QDRANT_URL },
      "analysis options env",
    );
    const options = await buildAnalysisOptions();
    await runFullAnalysis({ workspacePath, repo_id }, options);

    await reply.send({ status: "analysis_started" });
  } catch (err) {
    request.log.error(err);
    await reply.status(500).send({
      error: err instanceof Error ? err.message : "Analysis failed",
    });
  }
}
