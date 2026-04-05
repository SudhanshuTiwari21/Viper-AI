/**
 * F.34 — Stripe webhook verification, routing, and entitlement application.
 *
 * Architecture:
 *   verifyStripeEvent      — validates raw body + Stripe-Signature via SDK constructEvent
 *   loadPlanEntitlements   — reads VIPER_STRIPE_PRICE_ENTITLEMENTS env (JSON map) or falls
 *                            back to committed FREE_PLAN_ENTITLEMENTS
 *   handleSubscriptionUpdated  — applies plan from active price id + Stripe ids + optional billing_plan_slug
 *   handleSubscriptionDeleted  — `free` plan, clear subscription id, delete entitlement row
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
  setWorkspaceStripeBilling,
  clearWorkspacePaidSubscription,
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
  /**
   * Phase 6 — `workspaces.billing_plan_slug` (FK to `billing_plans.slug`), e.g. `pro_20`, `plus_40`.
   * When set, the webhook updates the workspace row after applying `workspace_entitlements`.
   */
  billing_plan_slug?: string;
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
 * Reference shape for a "free" entitlement overlay (not used directly on delete).
 * `handleSubscriptionDeleted` sets `workspaces.billing_plan_slug = 'free'`, clears
 * the subscription id, and deletes `workspace_entitlements` so composed entitlements
 * come from the `free` billing plan only.
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
function normalizeBillingPlanSlug(config: PriceEntitlementConfig): string | undefined {
  const s = config.billing_plan_slug;
  if (typeof s !== "string") return undefined;
  const t = s.trim();
  return t.length > 0 ? t : undefined;
}

/** Subscription states for which we grant mapped entitlements (not incomplete / canceled). */
const SUBSCRIPTION_STATUS_GRANTS_ENTITLEMENTS = new Set([
  "active",
  "trialing",
  "past_due",
]);

function extractStripeCustomerIdFromSubscription(sub: Stripe.Subscription): string | null {
  const c = sub.customer;
  if (typeof c === "string" && c.length > 0) return c;
  if (c && typeof c === "object" && "id" in c && typeof (c as { id?: string }).id === "string") {
    return (c as { id: string }).id;
  }
  return null;
}

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
  if (!SUBSCRIPTION_STATUS_GRANTS_ENTITLEMENTS.has(subscription.status)) {
    return "ignored";
  }

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

  const customerId = extractStripeCustomerIdFromSubscription(subscription);
  const planSlug = normalizeBillingPlanSlug(config);
  if (customerId) {
    try {
      await setWorkspaceStripeBilling(pool, workspaceId, {
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        ...(planSlug ? { billing_plan_slug: planSlug } : {}),
      });
    } catch {
      // Unknown workspace id or invalid billing_plan_slug FK — entitlements still stored
    }
  } else if (planSlug) {
    try {
      await pool.query(
        `UPDATE workspaces SET billing_plan_slug = $2, updated_at = now() WHERE id = $1`,
        [workspaceId, planSlug],
      );
    } catch {
      // FK violation on unknown slug — non-fatal; entitlements still applied
    }
  }

  return "applied";
}

async function handleSubscriptionDeleted(
  workspaceId: string,
): Promise<"applied"> {
  const pool = getPool();
  await clearWorkspacePaidSubscription(pool, workspaceId);
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

  const pool = getPool();
  const customerId = typeof session.customer === "string"
    ? session.customer
    : (session.customer as Stripe.Customer | null)?.id;

  // Eagerly apply entitlement if line items have a known price (Checkout expanded line_items).
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
        if (customerId) {
          const planSlug = normalizeBillingPlanSlug(config);
          try {
            await setWorkspaceStripeBilling(pool, workspaceId, {
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              ...(planSlug ? { billing_plan_slug: planSlug } : {}),
            });
          } catch {
            /* non-fatal */
          }
        }
        return "applied";
      }
    }
  }

  if (customerId) {
    try {
      await setWorkspaceStripeBilling(pool, workspaceId, {
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
      });
    } catch {
      // Non-fatal — workspace linkage is best-effort in F.34
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
