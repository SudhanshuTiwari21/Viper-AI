/**
 * F.30 — Fastify preHandler hook for workspace entitlement enforcement.
 *
 * Usage:
 *   import { entitlementsPreHandler } from "../middleware/entitlements.middleware.js";
 *   app.post("/chat", { preHandler: entitlementsPreHandler }, handler);
 *
 * When VIPER_ENTITLEMENTS_ENFORCE is 0 / unset (default):
 *   The hook is a fast no-op — no DB calls, no token parsing, existing behavior
 *   is byte-for-byte unchanged.
 *
 * When VIPER_ENTITLEMENTS_ENFORCE=1:
 *   1. Parses workspacePath from the request body (JSON body must already be parsed).
 *   2. Calls resolveWorkspaceContext; on EntitlementError → replies with the
 *      appropriate HTTP status and stable { error } JSON.
 *   3. On success, attaches `request.entitlements` for downstream handlers.
 *
 * The hook never throws — it always calls reply.send() on error or next() on pass.
 */

import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from "fastify";
import {
  resolveWorkspaceContext,
  EntitlementError,
  isEntitlementsEnforced,
  type ResolvedEntitlements,
} from "../lib/entitlements.service.js";
import { workflowRuntimeConfig } from "../config/workflow-flags.js";
import { workflowLog } from "../services/assistant.service.js";
import { createRequestIdentity } from "../types/request-identity.js";

// ---------------------------------------------------------------------------
// Augment FastifyRequest to carry the entitlement snapshot downstream
// ---------------------------------------------------------------------------

declare module "fastify" {
  interface FastifyRequest {
    entitlements?: ResolvedEntitlements | null;
  }
}

// ---------------------------------------------------------------------------
// preHandler hook
// ---------------------------------------------------------------------------

export async function entitlementsPreHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Fast path: enforcement is off (default) — skip all DB work.
  if (!isEntitlementsEnforced()) {
    request.entitlements = null;
    return;
  }

  // Extract workspacePath from body (may be nested; Fastify parses JSON before preHandler).
  const body = request.body as Record<string, unknown> | null | undefined;
  const workspacePath = typeof body?.["workspacePath"] === "string" ? body["workspacePath"] : null;

  if (!workspacePath) {
    await reply.status(400).send({ error: "workspacePath is required." });
    return;
  }

  const authHeader = request.headers["authorization"];

  try {
    const resolved = await resolveWorkspaceContext(
      workspacePath,
      authHeader,
      workflowRuntimeConfig,
    );
    request.entitlements = resolved;

    // Observability (only when enforcement is on and debug is enabled)
    if (resolved) {
      const identity = createRequestIdentity(workspacePath);
      workflowLog("entitlement:checked", identity, {
        workspaceId: resolved.workspaceId,
        pathKey: resolved.pathKey,
        userId: resolved.userId,
        allowedModes: [...resolved.allowedModes],
        allowedModelTiers: [...resolved.allowedModelTiers],
      });
    }
  } catch (err) {
    if (err instanceof EntitlementError) {
      const identity = createRequestIdentity(workspacePath);
      workflowLog("entitlement:denied", identity, {
        statusCode: err.statusCode,
        reason: err.message,
      });
      await reply.status(err.statusCode).send({ error: err.message });
      return;
    }
    // Unexpected error — log and return 500
    request.log.error({ err }, "Entitlement resolution unexpected error");
    await reply.status(500).send({ error: "Internal entitlement resolution error." });
  }
}
