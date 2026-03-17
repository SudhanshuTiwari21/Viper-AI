import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { postContextDebug } from "../controllers/context.controller.js";
import { ContextDebugSchema } from "../validators/request.schemas.js";

export async function contextRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: unknown }>("/context/debug", {
    schema: {
      body: {
        type: "object",
        required: ["prompt"],
        properties: {
          prompt: { type: "string" },
        },
      },
    },
    handler: async (request: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
      const parsed = ContextDebugSchema.safeParse(request.body);
      if (!parsed.success) {
        await reply.status(400).send({ error: parsed.error.message });
        return;
      }
      return postContextDebug(
        { ...request, body: parsed.data } as Parameters<typeof postContextDebug>[0],
        reply,
      );
    },
  });
}
