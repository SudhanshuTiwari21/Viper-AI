import type { FastifyReply, FastifyRequest } from "fastify";
import { runContextDebugPipeline } from "../services/assistant.service.js";
import type { ContextDebugRequest } from "../validators/request.schemas.js";

export async function postContextDebug(
  request: FastifyRequest<{ Body: ContextDebugRequest }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { prompt } = request.body;
    const result = await runContextDebugPipeline(prompt);
    await reply.send(result);
  } catch (err) {
    request.log.error(err);
    await reply.status(500).send({
      error: err instanceof Error ? err.message : "Context debug failed",
    });
  }
}
