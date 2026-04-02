import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { postChatFeedback, getChatFeedbackStatsHandler } from "../controllers/feedback.controller.js";
import { ChatFeedbackSchema, FeedbackStatsQuerySchema } from "../validators/request.schemas.js";

export async function feedbackRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: unknown }>("/chat/feedback", {
    schema: {
      body: {
        type: "object",
        required: ["request_id", "rating", "workspace_id"],
        properties: {
          request_id: { type: "string" },
          message_id: { type: "string" },
          rating: { type: "string", enum: ["up", "down"] },
          tags: { type: "array", items: { type: "string" }, maxItems: 5 },
          comment: { type: "string", maxLength: 1000 },
          workspace_id: { type: "string" },
        },
      },
    },
    handler: async (request: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
      const parsed = ChatFeedbackSchema.safeParse(request.body);
      if (!parsed.success) {
        await reply.status(400).send({ error: parsed.error.message });
        return;
      }
      return postChatFeedback(
        { ...request, body: parsed.data } as Parameters<typeof postChatFeedback>[0],
        reply,
      );
    },
  });

  app.get<{ Querystring: unknown }>("/feedback/stats", {
    handler: async (request: FastifyRequest<{ Querystring: unknown }>, reply: FastifyReply) => {
      const parsed = FeedbackStatsQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        await reply.status(400).send({ error: parsed.error.message });
        return;
      }
      return getChatFeedbackStatsHandler(
        { ...request, query: parsed.data } as Parameters<typeof getChatFeedbackStatsHandler>[0],
        reply,
      );
    },
  });
}
