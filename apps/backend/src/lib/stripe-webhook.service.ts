/**
 * F.34 — Stripe webhook verification, routing, and entitlement application.
 *
 * Architecture:
 *   verifyStripeEvent      — validates raw body + Stripe-Signature via SDK constructEvent
 *   loadPlanEntitlements   — reads VIPER_STRIPE_PRICE_ENTITLEMENTS env (JSON map) or falls
 *                            back to committed FREE_PLAN_ENTITLEMENTS
 *   handleSubscriptionUpdated  — applies plan from active price id
 *   handleSubscriptionDeleted  — reverts to allow-all (deletes entitlement row)
 *   processStripeWebhook   — orchestrates: idempotency check → dispatch → DB write
 *
 * Workspace routing:
 *   Reads metadata.workspace_id (UUID) from subscription or customer event objects.
 *   If absent → log + return 2xx without DB writes (avoids infinite Stripe retries).
 *
 * Kill-switches:
 *   VIPER_STRIPE_WEBHOOK_ENABLED=1   required for route to process events (else 404)
 *   STRIPE_WEBHOOK_SECRET            required when enabled (never logged)
 *
 * Idempotency:
 *   insertWebhookEventIfNew returns null on duplicate → skip processing entirely.
 */

import Stripe from "stripe";
import { getPool } from "@repo/database";
import {
  insertWebhookEventIfNew,
  upsertWorkspaceEntitlements,
  deleteWorkspaceEntitlements,
  type UpsertEntitlementsParams,
} from "@repo/database";
import { workflowLog } from "../services/assistant.service.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape of one price → entitlement mapping entry in VIPER_STRIPE_PRICE_ENTITLEMENTS. */
export interface PriceEntitlementConfig {
  allowed_modes?: string[] | null;
  allowed_model_tiers?: string[] | null;
  flags?: Record<string, unknown>;
}

/** Parsed plan entitlement map: priceId → config */
export type PriceEntitlementMap = Record<string, PriceEntitlementConfig>;

/** Return shape from processStripeWebhook. */
export interface WebhookResult {
  status: "applied" | "ignored" | "duplicate" | "error";
  reason?: string;
  workspaceId?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Fallback "free" plan applied when a subscription is deleted and no explicit
 * free-plan price is configured. Deleting the entitlement row causes F.30
 * to fall back to allow-all, which is the intended "free" behavior.
 * See docs/ENV.md for VIPER_STRIPE_PRICE_ENTITLEMENTS for overriding.
 */
export const FREE_PLAN_ENTITLEMENTS: PriceEntitlementConfig = {
  allowed_modes: null,    // null = all modes allowed
  allowed_model_tiers: null,
  flags: {},
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isStripeWebhookEnabled(): boolean {
  const v = process.env.VIPER_STRIPE_WEBHOOK_ENABLED ?? "";
  return v === "1" || v.toLowerCase() === "true";
}

export function getWebhookSecret(): string | undefined {
  return process.env.STRIPE_WEBHOOK_SECRET ?? process.env.VIPER_STRIPE_WEBHOOK_SECRET;
}

/**
 * Parse VIPER_STRIPE_PRICE_ENTITLEMENTS env var into a PriceEntitlementMap.
 * Expected format: JSON object mapping priceId → PriceEntitlementConfig.
 * Returns empty map on parse failure (fails open — unknown prices treated as ignored).
 */
export function loadPlanEntitlements(): PriceEntitlementMap {
  const raw = process.env.VIPER_STRIPE_PRICE_ENTITLEMENTS;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || Array.isArray(parsed) || parsed === null) return {};
    return parsed as PriceEntitlementMap;
  } catch {
    return {};
  }
}

/**
 * Extract a workspace UUID from a Stripe event object's metadata.
 * Stripe subscription and checkout session objects carry metadata at the top level.
 * Customer objects also carry metadata. We check multiple locations in priority order.
 */
function extractWorkspaceId(obj: Record<string, unknown>): string | null {
  // subscription or checkout_session metadata.workspace_id
  const meta = obj["metadata"];
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    const wid = (meta as Record<string, unknown>)["workspace_id"];
    if (typeof wid === "string" && wid.length > 0) return wid;
  }
  // subscription_data metadata (checkout session)
  const subData = obj["subscription_data"];
  if (subData && typeof subData === "object" && !Array.isArray(subData)) {
    const sdMeta = (subData as Record<string, unknown>)["metadata"];
    if (sdMeta && typeof sdMeta === "object" && !Array.isArray(sdMeta)) {
      const wid = (sdMeta as Record<string, unknown>)["workspace_id"];
      if (typeof wid === "string" && wid.length > 0) return wid;
    }
  }
  return null;
}

/**
 * Get the first price ID from a Stripe subscription's items list.
 * Returns null if not found.
 */
function extractFirstPriceId(subscription: Record<string, unknown>): string | null {
  const items = subscription["items"];
  if (!items || typeof items !== "object") return null;
  const data = (items as Record<string, unknown>)["data"];
  if (!Array.isArray(data) || data.length === 0) return null;
  const first = data[0] as Record<string, unknown>;
  const price = first["price"] as Record<string, unknown> | undefined;
  if (!price) return null;
  return typeof price["id"] === "string" ? price["id"] : null;
}

// ---------------------------------------------------------------------------
// Stripe event verification
// ---------------------------------------------------------------------------

/**
 * Verify a raw webhook payload against its Stripe-Signature header.
 * Returns the parsed Stripe.Event on success, throws on failure.
 * Never logs the raw secret.
 */
export function verifyStripeEvent(
  rawBody: Buffer | string,
  signature: string,
  webhookSecret: string,
): Stripe.Event {
  // Use a stateless Stripe instance for constructEvent only (no API key needed)
  const stripe = new Stripe("", { apiVersion: "2026-03-25.dahlia" });
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  workspaceId: string,
  planMap: PriceEntitlementMap,
): Promise<"applied" | "ignored"> {
  const priceId = extractFirstPriceId(subscription as unknown as Record<string, unknown>);

  if (!priceId) {
    return "ignored";
  }

  const config = planMap[priceId];
  if (!config) {
    // Unknown price id — treat as ignored (do not break entitlements)
    return "ignored";
  }

  const pool = getPool();
  const params: UpsertEntitlementsParams = {
    workspace_id: workspaceId,
    allowed_modes: config.allowed_modes !== undefined ? config.allowed_modes : null,
    allowed_model_tiers: config.allowed_model_tiers !== undefined ? config.allowed_model_tiers : null,
    flags: config.flags ?? {},
  };
  await upsertWorkspaceEntitlements(pool, params);
  return "applied";
}

async function handleSubscriptionDeleted(
  workspaceId: string,
): Promise<"applied"> {
  const pool = getPool();
  // Delete the entitlements row → F.30 allows all (safe default).
  await deleteWorkspaceEntitlements(pool, workspaceId);
  return "applied";
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  workspaceId: string,
  planMap: PriceEntitlementMap,
): Promise<"applied" | "ignored"> {
  // Resolve subscription from checkout session and apply entitlements
  const subscriptionId = typeof session.subscription === "string"
    ? session.subscription
    : (session.subscription as Stripe.Subscription | null)?.id;

  if (!subscriptionId) return "ignored";

  // We only have the session here; entitlements will be set when
  // customer.subscription.updated fires. Optionally link stripe_customer_id.
  const pool = getPool();
  const customerId = typeof session.customer === "string"
    ? session.customer
    : (session.customer as Stripe.Customer | null)?.id;

  if (customerId) {
    try {
      await pool.query(
        `UPDATE workspaces
         SET stripe_customer_id     = $2,
             stripe_subscription_id = $3,
             updated_at             = now()
         WHERE id = $1`,
        [workspaceId, customerId, subscriptionId],
      );
    } catch {
      // Non-fatal — workspace linkage is best-effort in F.34
    }
  }

  // Eagerly apply entitlement if line items have a known price
  const lineItems = (session as unknown as Record<string, unknown>)["line_items"];
  if (lineItems && typeof lineItems === "object") {
    const data = (lineItems as Record<string, unknown>)["data"];
    if (Array.isArray(data) && data.length > 0) {
      const priceId = ((data[0] as Record<string, unknown>)["price"] as Record<string, unknown> | undefined)?.["id"];
      if (typeof priceId === "string" && planMap[priceId]) {
        const config = planMap[priceId]!;
        await upsertWorkspaceEntitlements(pool, {
          workspace_id: workspaceId,
          allowed_modes: config.allowed_modes ?? null,
          allowed_model_tiers: config.allowed_model_tiers ?? null,
          flags: config.flags ?? {},
        });
        return "applied";
      }
    }
  }

  return "ignored";
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Process a verified Stripe webhook event.
 * Handles idempotency, routing, dispatch, and DB writes.
 *
 * Call ONLY after verifyStripeEvent succeeds.
 */
export async function processStripeWebhook(
  event: Stripe.Event,
): Promise<WebhookResult> {
  const planMap = loadPlanEntitlements();

  // Synthetic identity for workflowLog (no HTTP request context here)
  const billingIdentity = {
    request_id: event.id,
    workspace_id: "billing",
    conversation_id: null,
  };

  workflowLog("billing:webhook:received", billingIdentity, {
    event_type: event.type,
    event_id: event.id,
  });

  // Idempotency check — insert placeholder row before doing any work
  const pool = getPool();
  const inserted = await insertWebhookEventIfNew(pool, {
    stripe_event_id: event.id,
    event_type: event.type,
    processing_status: "applied", // will be updated on completion
  });

  if (inserted === null) {
    // Already processed
    workflowLog("billing:webhook:duplicate", billingIdentity, {
      event_id: event.id,
      event_type: event.type,
    });
    return { status: "duplicate", reason: "already processed" };
  }

  // Extract workspace UUID from event metadata
  const eventObj = event.data.object as unknown as Record<string, unknown>;
  const workspaceId = extractWorkspaceId(eventObj);

  if (!workspaceId) {
    workflowLog("billing:webhook:ignored", billingIdentity, {
      event_id: event.id,
      event_type: event.type,
      reason: "missing metadata.workspace_id",
    });
    // Update idempotency row
    await pool.query(
      `UPDATE billing_webhook_events SET processing_status = 'ignored' WHERE stripe_event_id = $1`,
      [event.id],
    );
    return { status: "ignored", reason: "missing metadata.workspace_id" };
  }

  // Dispatch
  let result: "applied" | "ignored" = "ignored";
  let errorMessage: string | undefined;

  try {
    switch (event.type) {
      case "customer.subscription.updated":
        result = await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
          workspaceId,
          planMap,
        );
        break;

      case "customer.subscription.deleted":
        result = await handleSubscriptionDeleted(workspaceId);
        break;

      case "checkout.session.completed":
        result = await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session,
          workspaceId,
          planMap,
        );
        break;

      default:
        result = "ignored";
        break;
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
    await pool.query(
      `UPDATE billing_webhook_events SET processing_status = 'error', error_message = $2 WHERE stripe_event_id = $1`,
      [event.id, errorMessage],
    );
    workflowLog("billing:webhook:applied", billingIdentity, {
      event_id: event.id,
      event_type: event.type,
      status: "error",
      workspace_id: workspaceId,
      error: errorMessage,
    });
    return { status: "error", reason: errorMessage, workspaceId };
  }

  // Update idempotency row to final status
  await pool.query(
    `UPDATE billing_webhook_events SET processing_status = $2, workspace_id = $3 WHERE stripe_event_id = $1`,
    [event.id, result, workspaceId],
  );

  if (result === "applied") {
    workflowLog("billing:webhook:applied", billingIdentity, {
      event_id: event.id,
      event_type: event.type,
      status: "applied",
      workspace_id: workspaceId,
    });
  } else {
    workflowLog("billing:webhook:ignored", billingIdentity, {
      event_id: event.id,
      event_type: event.type,
      reason: "unhandled event type or missing price config",
      workspace_id: workspaceId,
    });
  }

  return { status: result, workspaceId };
}
