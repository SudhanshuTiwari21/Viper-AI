import type { FastifyReply, FastifyRequest } from "fastify";
import {
  runAssistantPipeline,
  runAssistantStreamPipeline,
} from "../services/assistant.service.js";
import { verifyWorkspaceExists } from "../services/workspace.service.js";
import type { ChatRequest } from "../validators/request.schemas.js";

export async function postChat(
  request: FastifyRequest<{ Body: ChatRequest }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { prompt, workspacePath, conversationId, messages } = request.body;

    const exists = await verifyWorkspaceExists(workspacePath);
    if (!exists) {
      await reply.status(400).send({ error: "Workspace path does not exist" });
      return;
    }

    const result = await runAssistantPipeline(
      prompt,
      workspacePath,
      conversationId,
      messages,
    );
    await reply.send(result);
  } catch (err) {
    request.log.error(err);
    await reply.status(500).send({
      error: err instanceof Error ? err.message : "Chat request failed",
    });
  }
}

export async function postChatStream(
  request: FastifyRequest<{ Body: ChatRequest }>,
  reply: FastifyReply,
): Promise<void> {
  const { prompt, workspacePath, conversationId, messages } = request.body;

  const exists = await verifyWorkspaceExists(workspacePath);
  if (!exists) {
    await reply.status(400).send({ error: "Workspace path does not exist" });
    return;
  }

  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const send = (event: { type: string; data: unknown }) => {
    reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
  };

  try {
    await runAssistantStreamPipeline(
      prompt,
      workspacePath,
      send,
      conversationId,
      messages,
    );
  } catch (err) {
    request.log.error(err);
    send({
      type: "error",
      data: { message: err instanceof Error ? err.message : "Chat stream failed" },
    });
  } finally {
    reply.raw.end();
  }
}
