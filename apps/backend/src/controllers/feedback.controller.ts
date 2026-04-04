import type { FastifyReply, FastifyRequest } from "fastify";
import { saveFeedback, getFeedbackStats } from "../lib/chat-feedback-store.js";
import { workflowLog } from "../services/assistant.service.js";
import type { ChatFeedbackRequest, FeedbackStatsQuery } from "../validators/request.schemas.js";

export async function postChatFeedback(
  request: FastifyRequest<{ Body: ChatFeedbackRequest }>,
  reply: FastifyReply,
): Promise<void> {
  const { request_id, message_id, rating, tags, comment, workspace_id } = request.body;

  try {
    await saveFeedback({
      workspace_id,
      request_id,
      message_id,
      rating,
      tags,
      comment,
    });

    workflowLog("feedback:received", {
      request_id,
      workspace_id,
      conversation_id: null,
    }, {
      message_id: message_id ?? null,
      rating,
      tags,
    });

    await reply.status(200).send({ ok: true });
  } catch (err) {
    request.log.error({ err, request_id }, "Feedback save failed");
    await reply.status(500).send({ error: "Failed to save feedback" });
  }
}

export async function getChatFeedbackStatsHandler(
  request: FastifyRequest<{ Querystring: FeedbackStatsQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const { workspace_id, since } = request.query as FeedbackStatsQuery;
  try {
    const stats = await getFeedbackStats(workspace_id, since);
    await reply.send(stats);
  } catch (err) {
    request.log.error({ err }, "Feedback stats failed");
    await reply.status(500).send({ error: "Failed to get feedback stats" });
  }
}
