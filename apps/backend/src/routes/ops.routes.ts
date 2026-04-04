// H.43 — Ops routes: SLO snapshot + SLO check / alerting.
//
// GET /ops/slo-snapshot
//   Returns a structured JSON SLO health snapshot computed from usage_events
//   and usage_rollups_daily. Reuses queries from docs/SLO.md §6.
//   Kill-switch: VIPER_SLO_OPS_ENABLED=1. Auth: Bearer VIPER_SLO_OPS_TOKEN.
//
// POST /ops/slo-check
//   Cron-friendly endpoint: runs the snapshot, checks alert thresholds,
//   optionally POSTs violations to VIPER_SLO_ALERT_WEBHOOK_URL, emits
//   slo:alert:fired or slo:check:ok workflowLog stages.
//   Returns 200 { ok: true } when no violations, 200 { ok: false, violations }
//   when violations are found. (Exit code is handled by the caller / cron;
//   the HTTP status is always 200 so Fastify doesn't retry on violation.)
//
// Security:
//   Both endpoints require Authorization: Bearer <VIPER_SLO_OPS_TOKEN>.
//   When VIPER_SLO_OPS_ENABLED is off → 404 (hidden endpoint pattern, F.34).
//   When token is missing or wrong → 401.

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  isSloOpsEnabled,
  getSloOpsToken,
  getSloAlertWebhookUrl,
  buildSloSnapshot,
  detectViolations,
  postAlertWebhook,
  type SloSnapshot,
} from "../lib/slo-snapshot.service.js";
import { workflowLog } from "../services/assistant.service.js";

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

function checkBearerToken(request: FastifyRequest, reply: FastifyReply): boolean {
  const expected = getSloOpsToken();
  if (!expected) {
    // No token configured → always deny (safety default)
    reply.status(401).send({ error: "VIPER_SLO_OPS_TOKEN not configured" });
    return false;
  }
  const auth = request.headers["authorization"] ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (provided !== expected) {
    reply.status(401).send({ error: "Unauthorized" });
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Handlers (separated for testability)
// ---------------------------------------------------------------------------

export async function getSloSnapshot(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!isSloOpsEnabled()) {
    return reply.status(404).send({ error: "Not found" });
  }
  if (!checkBearerToken(request, reply)) return;

  try {
    const snapshot = await buildSloSnapshot();
    return reply.status(200).send(snapshot);
  } catch (err) {
    request.log.error({ err }, "SLO snapshot error");
    return reply.status(500).send({ error: "Failed to compute SLO snapshot" });
  }
}

export async function postSloCheck(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!isSloOpsEnabled()) {
    return reply.status(404).send({ error: "Not found" });
  }
  if (!checkBearerToken(request, reply)) return;

  let snapshot: SloSnapshot;
  try {
    snapshot = await buildSloSnapshot();
  } catch (err) {
    request.log.error({ err }, "SLO check snapshot error");
    return reply.status(500).send({ error: "Failed to compute SLO snapshot" });
  }

  const violations = snapshot.breaches;
  const identity = null; // ops endpoint — no per-request identity

  if (violations.length === 0) {
    workflowLog("slo:check:ok", identity, {
      computed_at: snapshot.computed_at,
      total_requests: snapshot.quality.total_requests,
      any_breach: false,
    });
    return reply.status(200).send({ ok: true, computed_at: snapshot.computed_at, violations: [] });
  }

  // Violations found
  workflowLog("slo:alert:fired", identity, {
    computed_at: snapshot.computed_at,
    violation_count: violations.length,
    severities: violations.map((v) => v.severity),
    rules: violations.map((v) => v.rule),
  });

  // Optional webhook delivery
  const webhookUrl = getSloAlertWebhookUrl();
  if (webhookUrl) {
    try {
      await postAlertWebhook(webhookUrl, violations);
      request.log.info({ violation_count: violations.length }, "SLO alert webhook delivered");
    } catch (err) {
      request.log.warn({ err }, "SLO alert webhook delivery failed (non-fatal)");
    }
  }

  return reply.status(200).send({
    ok: false,
    computed_at: snapshot.computed_at,
    violation_count: violations.length,
    violations,
  });
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function opsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/ops/slo-snapshot", {}, getSloSnapshot);

  app.post("/ops/slo-check", {
    schema: {
      body: { type: "object" },
    },
  }, postSloCheck);
}
