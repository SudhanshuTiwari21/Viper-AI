import type { FastifyReply, FastifyRequest } from "fastify";
import {
  ClientDisconnectedError,
  VisionNotSupportedError,
  runAssistantPipeline,
  runAssistantStreamPipeline,
} from "../services/assistant.service.js";
import { MultimodalResolutionError } from "../lib/multimodal-content.js";
import { sseCorsHeaders } from "../lib/sse-cors-headers.js";
import { verifyWorkspaceExists } from "../services/workspace.service.js";
import type { ChatRequest } from "../validators/request.schemas.js";
import { createRequestIdentity } from "../types/request-identity.js";
import { resolveEffectiveModelTier } from "../lib/resolve-effective-model-tier.js";
import { workflowLog } from "../services/assistant.service.js";
import { workflowRuntimeConfig } from "../config/workflow-flags.js";
import { buildRouteTelemetry } from "../types/route-telemetry.js";

export async function postChat(
  request: FastifyRequest<{ Body: ChatRequest }>,
  reply: FastifyReply,
): Promise<void> {
  const { prompt, workspacePath, conversationId, messages, mode: chatMode, attachments } = request.body;

  const exists = await verifyWorkspaceExists(workspacePath);
  if (!exists) {
    await reply.status(400).send({ error: "Workspace path does not exist" });
    return;
  }

  const identity = createRequestIdentity(workspacePath, conversationId);

  const tierRes = await resolveEffectiveModelTier({
    parsedBody: request.body,
    identity,
    config: workflowRuntimeConfig,
  });
  if (tierRes.downgraded) {
    workflowLog("model:tier:denied", identity, {
      tier_downgraded_from: tierRes.tier_downgraded_from,
      tier_downgraded_to: tierRes.tier_downgraded_to,
      reason: tierRes.denyReason ?? "tier_downgrade",
    });
  }

  try {
    const requestStart = Date.now();
    const result = await runAssistantPipeline(
      prompt,
      workspacePath,
      identity,
      conversationId,
      messages,
      chatMode,
      tierRes.effective,
      attachments,
    );

    const routeTelemetry = result.routeMeta
      ? buildRouteTelemetry({
          identity,
          mode: chatMode,
          effectiveModelTier: tierRes.effective,
          tierDowngraded: tierRes.downgraded,
          routeMeta: result.routeMeta,
          latencyMs: Date.now() - requestStart,
        })
      : undefined;

    if (routeTelemetry) {
      workflowLog("model:route:outcome", identity, routeTelemetry as unknown as Record<string, unknown>);
      if (workflowRuntimeConfig.modelTelemetry) {
        const line = { _type: "viper.route.telemetry", ts: new Date().toISOString(), ...routeTelemetry };
        process.stdout.write(JSON.stringify(line) + "\n");
      }
    }

    const { routeMeta: _rm, ...resultWithoutMeta } = result;
    await reply.send({
      ...resultWithoutMeta,
      tierResolution: {
        tier_requested: tierRes.requested,
        tier_effective: tierRes.effective,
        tier_downgraded: tierRes.downgraded,
      },
      routeTelemetry,
    });
  } catch (err) {
    // E.24: vision / multimodal errors are client errors → 400.
    if (err instanceof VisionNotSupportedError || err instanceof MultimodalResolutionError) {
      request.log.warn({
        err,
        request_id: identity.request_id,
        workspace_id: identity.workspace_id,
      }, "Chat request rejected: multimodal/vision error");
      const status = err instanceof MultimodalResolutionError ? err.statusCode : 400;
      await reply.status(status).send({ error: err.message });
      return;
    }
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
  const { prompt, workspacePath, conversationId, messages, mode: chatMode, attachments } = request.body;

  const exists = await verifyWorkspaceExists(workspacePath);
  if (!exists) {
    await reply.status(400).send({ error: "Workspace path does not exist" });
    return;
  }

  const identity = createRequestIdentity(workspacePath, conversationId);

  const tierRes = await resolveEffectiveModelTier({
    parsedBody: request.body,
    identity,
    config: workflowRuntimeConfig,
  });
  if (tierRes.downgraded) {
    workflowLog("model:tier:denied", identity, {
      tier_downgraded_from: tierRes.tier_downgraded_from,
      tier_downgraded_to: tierRes.tier_downgraded_to,
      reason: tierRes.denyReason ?? "tier_downgrade",
    });
  }

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

  if (tierRes.downgraded) {
    send({
      type: "model:tier:downgraded",
      data: {
        tier_requested: tierRes.requested,
        tier_effective: tierRes.effective,
        tier_downgraded_from: tierRes.tier_downgraded_from,
        tier_downgraded_to: tierRes.tier_downgraded_to,
      },
    });
  }

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
      chatMode,
      tierRes.effective,
      { tierDowngraded: tierRes.downgraded, requestedTier: tierRes.requested },
      attachments,
    );
  } catch (err) {
    if (err instanceof ClientDisconnectedError) {
      request.log.info({
        request_id: identity.request_id,
        workspace_id: identity.workspace_id,
        conversation_id: identity.conversation_id,
        reason: "client_disconnected",
      }, "Chat stream ended: client disconnected (pipeline aborted)");
    } else if (err instanceof VisionNotSupportedError || err instanceof MultimodalResolutionError) {
      // E.24: vision / multimodal client errors — log at warn, surface via SSE error event.
      request.log.warn({
        err,
        request_id: identity.request_id,
        workspace_id: identity.workspace_id,
      }, "Chat stream rejected: multimodal/vision error");
      send({
        type: "error",
        data: {
          request_id: identity.request_id,
          message: err.message,
        },
      });
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
