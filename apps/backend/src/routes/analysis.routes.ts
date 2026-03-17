import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { runAnalysis, runAnalysisScan } from "../controllers/analysis.controller.js";
import { AnalysisRequestSchema } from "../validators/request.schemas.js";

/** GET /analysis — describe analysis API for Postman / debugging. */
const ANALYSIS_API_DOC = {
  description: "Codebase Analysis Agent API. Use with Postman or the IDE.",
  endpoints: {
    run: {
      method: "POST",
      path: "/analysis/run",
      body: { workspacePath: "<absolute path to repo root>" },
      description: "Run full pipeline: Repo Scanner → AST → Metadata → Graph → Embeddings.",
    },
    scan: {
      method: "POST",
      path: "/analysis/scan",
      body: { workspacePath: "<absolute path to repo root>" },
      description: "Run Repo Scanner only; returns files, sourceFiles, jobs (for debugging).",
    },
  },
};

export async function analysisRoutes(app: FastifyInstance): Promise<void> {
  app.get("/analysis", async (_request: FastifyRequest, reply: FastifyReply) => {
    await reply.send(ANALYSIS_API_DOC);
  });

  app.post<{ Body: unknown }>("/analysis/scan", {
    schema: {
      body: {
        type: "object",
        required: ["workspacePath"],
        properties: { workspacePath: { type: "string" } },
      },
    },
    handler: async (request: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
      const parsed = AnalysisRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        await reply.status(400).send({ error: parsed.error.message });
        return;
      }
      return runAnalysisScan(
        { ...request, body: parsed.data } as Parameters<typeof runAnalysisScan>[0],
        reply,
      );
    },
  });

  app.post<{ Body: unknown }>("/analysis/run", {
    schema: {
      body: {
        type: "object",
        required: ["workspacePath"],
        properties: {
          workspacePath: { type: "string" },
        },
      },
    },
    handler: async (request: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
      const parsed = AnalysisRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        await reply.status(400).send({ error: parsed.error.message });
        return;
      }
      return runAnalysis(
        { ...request, body: parsed.data } as Parameters<typeof runAnalysis>[0],
        reply,
      );
    },
  });
}
