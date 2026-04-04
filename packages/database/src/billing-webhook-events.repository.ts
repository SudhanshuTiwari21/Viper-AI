/**
 * F.34 — Repository for the `billing_webhook_events` idempotency log.
 *
 * One row per inbound Stripe event ID. The PRIMARY KEY (stripe_event_id)
 * enforces that duplicate deliveries never double-apply entitlements:
 *   - insertWebhookEventIfNew: ON CONFLICT DO NOTHING; returns null on dup.
 *   - Callers check for null → skip processing.
 *
 * processing_status values:
 *   'applied'   — entitlements were updated
 *   'ignored'   — event was valid but not actionable (missing metadata, etc.)
 *   'error'     — processing failed; error_message contains reason
 *   'duplicate' — stripe_event_id already existed (set by caller for clarity)
 */
import type { Pool } from "pg";

export type WebhookProcessingStatus = "applied" | "ignored" | "error" | "duplicate";

export interface BillingWebhookEventRow {
  stripe_event_id: string;
  event_type: string;
  workspace_id: string | null;
  processing_status: WebhookProcessingStatus;
  received_at: string;
  error_message: string | null;
}

export interface InsertWebhookEventParams {
  stripe_event_id: string;
  event_type: string;
  workspace_id?: string | null;
  processing_status: WebhookProcessingStatus;
  error_message?: string | null;
}

/**
 * Insert a new webhook event row.
 * Returns the inserted row, or null if stripe_event_id already exists (idempotent).
 */
export async function insertWebhookEventIfNew(
  pool: Pool,
  params: InsertWebhookEventParams,
): Promise<BillingWebhookEventRow | null> {
  const result = await pool.query<BillingWebhookEventRow>(
    `INSERT INTO billing_webhook_events
       (stripe_event_id, event_type, workspace_id, processing_status, error_message)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (stripe_event_id) DO NOTHING
     RETURNING *`,
    [
      params.stripe_event_id,
      params.event_type,
      params.workspace_id ?? null,
      params.processing_status,
      params.error_message ?? null,
    ],
  );
  return result.rows[0] ?? null;
}

/**
 * Update the processing_status of an existing event (e.g. after async processing).
 */
export async function updateWebhookEventStatus(
  pool: Pool,
  stripeEventId: string,
  status: WebhookProcessingStatus,
  errorMessage?: string | null,
): Promise<BillingWebhookEventRow | null> {
  const result = await pool.query<BillingWebhookEventRow>(
    `UPDATE billing_webhook_events
     SET processing_status = $2,
         error_message     = $3
     WHERE stripe_event_id = $1
     RETURNING *`,
    [stripeEventId, status, errorMessage ?? null],
  );
  return result.rows[0] ?? null;
}

/**
 * Check if a webhook event has already been processed.
 */
export async function getWebhookEvent(
  pool: Pool,
  stripeEventId: string,
): Promise<BillingWebhookEventRow | null> {
  const result = await pool.query<BillingWebhookEventRow>(
    `SELECT * FROM billing_webhook_events WHERE stripe_event_id = $1 LIMIT 1`,
    [stripeEventId],
  );
  return result.rows[0] ?? null;
}
