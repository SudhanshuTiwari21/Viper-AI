/**
 * F.34 — Controller for POST /webhooks/stripe.
 *
 * Critical: receives raw Buffer body (pre-JSON-parse) so Stripe signature
 * verification can use the exact bytes. See billing.routes.ts for raw body setup.
 *
 * Behavior when disabled (VIPER_STRIPE_WEBHOOK_ENABLED != 1):
 *   Returns 404 — endpoint does not visibly exist to scanners.
 *
 * Behavior on bad signature:
 *   Returns 400 — tells Stripe to retry with the correct secret.
 *
 * Behavior on accepted event (applied, ignored, duplicate):
 *   Returns 200 — Stripe does not retry.
 *
 * Behavior on processing error:
 *   Returns 200 — still ack to Stripe; error is logged internally.
 *   (Stripe retries on 5xx, which could be noisy for persistent bad configs.)
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import {
  isStripeWebhookEnabled,
  getWebhookSecret,
  verifyStripeEvent,
  processStripeWebhook,
} from "../lib/stripe-webhook.service.js";

export async function postStripeWebhook(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!isStripeWebhookEnabled()) {
    return reply.status(404).send({ error: "Not found" });
  }

  const secret = getWebhookSecret();
  if (!secret) {
    request.log.error("STRIPE_WEBHOOK_SECRET is not set; webhook rejected");
    return reply.status(500).send({ error: "Webhook secret not configured" });
  }

  const signature = request.headers["stripe-signature"];
  if (!signature || typeof signature !== "string") {
    return reply.status(400).send({ error: "Missing Stripe-Signature header" });
  }

  // Raw body is attached by billing.routes.ts as request.rawBody
  const rawBody = (request as FastifyRequest & { rawBody?: Buffer | string }).rawBody;
  if (!rawBody) {
    return reply.status(400).send({ error: "Missing raw request body" });
  }

  let event;
  try {
    event = verifyStripeEvent(rawBody, signature, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    request.log.warn({ err: msg }, "Stripe webhook signature verification failed");
    return reply.status(400).send({ error: "Invalid signature" });
  }

  // Process (idempotent — duplicate events are safely handled)
  const result = await processStripeWebhook(event);

  return reply.status(200).send({ received: true, status: result.status });
}
