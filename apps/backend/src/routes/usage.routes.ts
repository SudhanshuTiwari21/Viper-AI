/**
 * F.35 — Usage & plan summary routes.
 *
 * POST /usage/summary
 *   Returns month-to-date request count, quota limit, and entitlement snapshot
 *   for the current workspace.
 *
 * Kill-switch:
 *   VIPER_USAGE_UI_ENABLED=1 required. When off → 404 (hidden endpoint).
 *
 * Auth / isolation:
 *   When VIPER_ENTITLEMENTS_ENFORCE=1, the same entitlementsPreHandler as /chat
 *   is registered so only workspace members can read their workspace's data.
 *   When enforcement is off, this is dev-trust: the caller must supply a valid
 *   workspacePath but no token is required (same as /chat in local mode).
 *   Isolation is guaranteed by the path_key lookup — the response only ever
 *   contains data for the supplied workspacePath's derived key.
 *
 * Body: { workspacePath: string, todayUtc?: string }
 *   todayUtc is optional, only accepted for test/debug injection; in production
 *   the server always uses its own UTC clock.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { entitlementsPreHandler } from "../middleware/entitlements.middleware.js";
import { isUsageUiEnabled, getUsageSummary } from "../lib/usage-summary.service.js";

interface UsageSummaryBody {
  workspacePath: string;
  /** Injectable for tests only; server ignores in production. */
  todayUtc?: string;
}

export async function usageRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: UsageSummaryBody }>("/usage/summary", {
    preHandler: entitlementsPreHandler,
    schema: {
      body: {
        type: "object",
        required: ["workspacePath"],
        properties: {
          workspacePath: { type: "string" },
          todayUtc: { type: "string" },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: UsageSummaryBody }>, reply: FastifyReply) => {
    if (!isUsageUiEnabled()) {
      return reply.status(404).send({ error: "Not found" });
    }

    const { workspacePath, todayUtc } = request.body;

    if (!workspacePath || typeof workspacePath !== "string") {
      return reply.status(400).send({ error: "workspacePath is required." });
    }

    try {
      const summary = await getUsageSummary(
        workspacePath,
        request.entitlements ?? null,
        process.env["NODE_ENV"] !== "production" ? todayUtc : undefined,
      );
      return reply.status(200).send(summary);
    } catch (err) {
      request.log.error({ err }, "Usage summary error");
      return reply.status(500).send({ error: "Failed to compute usage summary." });
    }
  });
}
