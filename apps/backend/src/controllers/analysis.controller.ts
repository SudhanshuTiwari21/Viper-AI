import type { FastifyReply, FastifyRequest } from "fastify";
import { getRepoId } from "../services/workspace.service.js";
import type { AnalysisRequest } from "../validators/request.schemas.js";

export async function runAnalysis(
  request: FastifyRequest<{ Body: AnalysisRequest }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { workspacePath } = request.body;
    const repo_id = getRepoId(workspacePath);

    const codebaseAnalysisModule = "@repo/codebase-analysis-agent";
    const analysis = (await import(
      codebaseAnalysisModule
    )) as {
      runRepoScanner: (input: {
        workspacePath: string;
        repo_id: string;
      }) => Promise<unknown>;
      startASTParserWorkers: (opts?: unknown) => unknown;
      startMetadataExtractionWorkers: (opts?: unknown) => unknown;
      startGraphBuilderWorkers: (opts?: unknown) => unknown;
      startEmbeddingWorkers: (opts?: unknown) => unknown;
    };
    const {
      runRepoScanner,
      startASTParserWorkers,
      startMetadataExtractionWorkers,
      startGraphBuilderWorkers,
      startEmbeddingWorkers,
    } = analysis;

    await runRepoScanner({ workspacePath, repo_id });

    startASTParserWorkers({});
    startMetadataExtractionWorkers({});
    startGraphBuilderWorkers({});
    startEmbeddingWorkers({});

    await reply.send({ status: "analysis_started" });
  } catch (err) {
    request.log.error(err);
    await reply.status(500).send({
      error: err instanceof Error ? err.message : "Analysis failed",
    });
  }
}
