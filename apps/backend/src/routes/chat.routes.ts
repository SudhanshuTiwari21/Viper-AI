import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { postChat, postChatStream } from "../controllers/chat.controller.js";
import { ChatRequestSchema } from "../validators/request.schemas.js";

export async function chatRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: unknown }>("/chat", {
    schema: {
      body: {
        type: "object",
        required: ["prompt", "workspacePath"],
        properties: {
          prompt: { type: "string" },
          workspacePath: { type: "string" },
        },
      },
    },
    handler: async (request: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
      const parsed = ChatRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        await reply.status(400).send({ error: parsed.error.message });
        return;
      }
      return postChat(
        { ...request, body: parsed.data } as Parameters<typeof postChat>[0],
        reply,
      );
    },
  });

  app.post<{ Body: unknown }>("/chat/stream", {
    schema: {
      body: {
        type: "object",
        required: ["prompt", "workspacePath"],
        properties: {
          prompt: { type: "string" },
          workspacePath: { type: "string" },
        },
      },
    },
    handler: async (request: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
      const parsed = ChatRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        await reply.status(400).send({ error: parsed.error.message });
        return;
      }
      return postChatStream(
        { ...request, body: parsed.data } as Parameters<typeof postChatStream>[0],
        reply,
      );
    },
  });
}
