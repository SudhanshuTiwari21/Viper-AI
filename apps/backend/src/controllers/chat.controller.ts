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
import {
  EntitlementError,
  assertModeAllowed,
  assertModelTierAllowed,
  resolvePathKey,
} from "../lib/entitlements.service.js";
import { recordUsageEvent } from "../lib/usage-events.js";
import { checkMonthlyQuota, QuotaError } from "../lib/quota.service.js";

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

  // F.30: assert mode + tier allowed by workspace entitlements (no-op when enforcement is off).
  const entitlements = request.entitlements ?? null;
  try {
    assertModeAllowed(entitlements, chatMode ?? "agent");
  } catch (err) {
    if (err instanceof EntitlementError) {
      await reply.status(err.statusCode).send({ error: err.message });
      return;
    }
    throw err;
  }

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
    assertModelTierAllowed(entitlements, tierRes.effective);
  } catch (err) {
    if (err instanceof EntitlementError) {
      await reply.status(err.statusCode).send({ error: err.message });
      return;
    }
    throw err;
  }

  // F.33: monthly request quota check (no-op when VIPER_QUOTA_ENFORCE is off).
  try {
    await checkMonthlyQuota(resolvePathKey(workspacePath), entitlements, identity);
  } catch (err) {
    if (err instanceof QuotaError) {
      await reply.status(err.statusCode).send({ error: err.message, quota: err.quota });
      return;
    }
    throw err;
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
      // F.31: persist billing-grade usage event (fire-and-forget; errors never crash the request).
      // Token accounting deferred to F.32 — tokens are null until OpenAI usage is wired through.
      void recordUsageEvent({
        telemetry: routeTelemetry,
        stream: false,
        entitlements,
        tokens: null,
        identity,
      });
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

  // F.30: assert mode + tier allowed by workspace entitlements (no-op when enforcement is off).
  const entitlements = request.entitlements ?? null;
  try {
    assertModeAllowed(entitlements, chatMode ?? "agent");
  } catch (err) {
    if (err instanceof EntitlementError) {
      await reply.status(err.statusCode).send({ error: err.message });
      return;
    }
    throw err;
  }

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
    assertModelTierAllowed(entitlements, tierRes.effective);
  } catch (err) {
    if (err instanceof EntitlementError) {
      await reply.status(err.statusCode).send({ error: err.message });
      return;
    }
    throw err;
  }

  // F.33: monthly request quota check — must run BEFORE reply.hijack() so we can
  // still return a normal HTTP response (429) if quota is exhausted.
  try {
    await checkMonthlyQuota(resolvePathKey(workspacePath), entitlements, identity);
  } catch (err) {
    if (err instanceof QuotaError) {
      await reply.status(err.statusCode).send({ error: err.message, quota: err.quota });
      return;
    }
    throw err;
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

  // F.31: capture route telemetry from the model:route:summary SSE event so we can
  // record a usage event on successful stream completion.
  let streamRouteTelemetryData: Record<string, unknown> | null = null;

  const send = (event: { type: string; data: unknown }) => {
    if (event.type === "model:route:summary" && event.data && typeof event.data === "object") {
      streamRouteTelemetryData = event.data as Record<string, unknown>;
    }
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

    // F.31: record usage event on successful stream completion only.
    // Token accounting deferred to F.32 — tokens are null until usage is wired.
    if (streamRouteTelemetryData) {
      const d = streamRouteTelemetryData;
      const streamTelemetry: import("../types/route-telemetry.js").RouteTelemetry = {
        request_id: identity.request_id,
        workspace_id: identity.workspace_id,
        conversation_id: identity.conversation_id,
        mode: String(d["mode"] ?? chatMode ?? "agent"),
        effective_model_tier: String(d["effective_model_tier"] ?? tierRes.effective),
        primary_model_id: String(d["primary_model_id"] ?? ""),
        final_model_id: String(d["final_model_id"] ?? ""),
        fallback_chain: Array.isArray(d["fallback_chain"]) ? (d["fallback_chain"] as string[]) : [],
        fallback_count: typeof d["fallback_count"] === "number" ? d["fallback_count"] : 0,
        intent: String(d["intent"] ?? "unknown"),
        route_mode: String(d["route_mode"] ?? ""),
        tier_downgraded: Boolean(d["tier_downgraded"] ?? tierRes.downgraded),
        latency_ms: typeof d["latency_ms"] === "number" ? d["latency_ms"] : 0,
      };
      void recordUsageEvent({
        telemetry: streamTelemetry,
        stream: true,
        entitlements,
        tokens: null,
        identity,
      });
    }
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
