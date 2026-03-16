import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { runAnalysis } from "../controllers/analysis.controller.js";
import { AnalysisRequestSchema } from "../validators/request.schemas.js";

export async function analysisRoutes(app: FastifyInstance): Promise<void> {
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
