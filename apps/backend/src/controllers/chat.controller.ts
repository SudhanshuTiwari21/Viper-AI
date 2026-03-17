import type { FastifyReply, FastifyRequest } from "fastify";
import { runAssistantPipeline } from "../services/assistant.service.js";
import { verifyWorkspaceExists } from "../services/workspace.service.js";
import type { ChatRequest } from "../validators/request.schemas.js";

export async function postChat(
  request: FastifyRequest<{ Body: ChatRequest }>,
  reply: FastifyReply,
): Promise<void> {
  try {
    const { prompt, workspacePath } = request.body;

    const exists = await verifyWorkspaceExists(workspacePath);
    if (!exists) {
      await reply.status(400).send({ error: "Workspace path does not exist" });
      return;
    }

    const result = await runAssistantPipeline(prompt, workspacePath);
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
  try {
    const { prompt, workspacePath } = request.body;

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

    const send = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    send("status", { message: "intent detected" });
    const result = await runAssistantPipeline(prompt, workspacePath);
    send("status", { message: "context retrieved" });
    send("status", { message: "ranking complete" });
    send("result", result);
    reply.raw.end();
  } catch (err) {
    request.log.error(err);
    await reply.status(500).send({
      error: err instanceof Error ? err.message : "Chat stream failed",
    });
  }
}
