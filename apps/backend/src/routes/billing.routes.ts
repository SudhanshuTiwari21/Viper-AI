/**
 * F.34 — Billing / Stripe webhook routes.
 *
 * CRITICAL: Stripe signature verification requires the EXACT raw request bytes.
 * This route plugin adds a Fastify `addContentTypeParser` for
 * 'application/json' scoped to this plugin so the body is stored as a Buffer
 * in `request.rawBody` BEFORE any JSON parsing.
 *
 * The default JSON content-type parser is NOT used for this route — Fastify's
 * built-in JSON parser would stringify/re-parse the body, corrupting the
 * signature. Instead, we parse manually after sig verification.
 *
 * CORS note: Stripe webhooks are server-to-server; no CORS preflight
 * handling required for this endpoint. The global CORS plugin does not
 * interfere because Stripe never sends an Origin header.
 */

import type { FastifyInstance } from "fastify";
import { postStripeWebhook } from "../controllers/billing-webhook.controller.js";

export async function billingRoutes(app: FastifyInstance): Promise<void> {
  // Register a scoped raw body parser for this plugin's routes.
  // This captures raw Buffer before Fastify's normal JSON parse step.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    function (_req, body: Buffer, done) {
      // Attach raw body so the controller can access exact bytes
      done(null, body);
    },
  );

  // POST /webhooks/stripe — Stripe delivers to this URL
  app.post<{
    Body: Buffer;
  }>("/webhooks/stripe", {
    // No Fastify schema — body is a raw Buffer (not JSON)
    config: { rawBody: true },
  }, async (request, reply) => {
    // Attach the raw buffer for the controller
    (request as typeof request & { rawBody: Buffer }).rawBody = request.body;
    return postStripeWebhook(request, reply);
  });
}
