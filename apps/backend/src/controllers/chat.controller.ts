import type { FastifyReply, FastifyRequest } from "fastify";
import {
  ClientDisconnectedError,
  runAssistantPipeline,
  runAssistantStreamPipeline,
} from "../services/assistant.service.js";
import { sseCorsHeaders } from "../lib/sse-cors-headers.js";
import { verifyWorkspaceExists } from "../services/workspace.service.js";
import type { ChatRequest } from "../validators/request.schemas.js";
import { createRequestIdentity } from "../types/request-identity.js";

export async function postChat(
  request: FastifyRequest<{ Body: ChatRequest }>,
  reply: FastifyReply,
): Promise<void> {
  const { prompt, workspacePath, conversationId, messages } = request.body;

  const exists = await verifyWorkspaceExists(workspacePath);
  if (!exists) {
    await reply.status(400).send({ error: "Workspace path does not exist" });
    return;
  }

  const identity = createRequestIdentity(workspacePath, conversationId);

  try {
    const result = await runAssistantPipeline(
      prompt,
      workspacePath,
      identity,
      conversationId,
      messages,
    );
    await reply.send(result);
  } catch (err) {
    request.log.error({
      err,
      request_id: identity.request_id,
      workspace_id: identity.workspace_id,
      conversation_id: identity.conversation_id,
    }, "Chat request failed");
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

  const identity = createRequestIdentity(workspacePath, conversationId);

  // Required for long-lived SSE: clears Fastify handler timeout / abort wiring that can drop the socket mid-stream.
  reply.hijack();

  reply.raw.writeHead(200, {
    ...sseCorsHeaders(request),
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const sock = request.raw.socket;
  if (sock && typeof sock.setTimeout === "function") {
    sock.setTimeout(0);
  }

  const send = (event: { type: string; data: unknown }) => {
    try {
      if (reply.raw.writableEnded) return;
      const identityData = {
        request_id: identity.request_id,
        workspace_id: identity.workspace_id,
        conversation_id: identity.conversation_id,
      };

      // Inject identity only into plain-object event.data.
      // This avoids unexpected spreading behavior for arrays / non-plain objects.
      const isPlainObject =
        event.data &&
        typeof event.data === "object" &&
        !Array.isArray(event.data) &&
        (Object.getPrototypeOf(event.data) === Object.prototype ||
          Object.getPrototypeOf(event.data) === null);

      const payload = isPlainObject
        ? { ...identityData, ...(event.data as Record<string, unknown>) }
        : event.data === undefined
          ? identityData
          : event.data;

      reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(payload)}\n\n`);
    } catch (err) {
      request.log.warn({ err }, "SSE write failed (client disconnected or socket closed)");
    }
  };

  send({
    type: "stream:open",
    data: {},
  });

  /** Autonomous loop + reasoning can run 30-120s+ with no other events -- Electron/Chromium may kill idle streams. */
  const HEARTBEAT_MS = Math.max(
    3000,
    parseInt(process.env.SSE_HEARTBEAT_MS ?? "8000", 10),
  );
  const heartbeat = setInterval(() => {
    send({ type: "keepalive", data: { ping: true } });
  }, HEARTBEAT_MS);

  const ac = new AbortController();
  const onClientClose = () => {
    ac.abort();
  };
  request.raw.on("close", onClientClose);

  try {
    await runAssistantStreamPipeline(
      prompt,
      workspacePath,
      send,
      identity,
      conversationId,
      messages,
      ac.signal,
    );
  } catch (err) {
    if (err instanceof ClientDisconnectedError) {
      request.log.info({
        request_id: identity.request_id,
        workspace_id: identity.workspace_id,
        conversation_id: identity.conversation_id,
        reason: "client_disconnected",
      }, "Chat stream ended: client disconnected (pipeline aborted)");
    } else {
      request.log.error({
        err,
        request_id: identity.request_id,
        workspace_id: identity.workspace_id,
        conversation_id: identity.conversation_id,
      }, "Chat stream failed");
      send({
        type: "error",
        data: {
          request_id: identity.request_id,
          message: err instanceof Error ? err.message : "Chat stream failed",
        },
      });
    }
  } finally {
    clearInterval(heartbeat);
    request.raw.removeListener("close", onClientClose);
    reply.raw.end();
  }
}
