-- F.34: Billing tables for Stripe webhook ingestion.
--
-- Design notes:
--  * billing_webhook_events: idempotency log, one row per Stripe event ID.
--    stripe_event_id is the PRIMARY KEY — ON CONFLICT DO NOTHING guarantees
--    duplicate deliveries never double-apply entitlements.
--    processing_status: 'applied' | 'ignored' | 'error' | 'duplicate'
--
--  * workspaces table gains two nullable Stripe FK columns:
--      stripe_customer_id     — set when a Stripe Customer is linked
--      stripe_subscription_id — current active subscription ID
--    These are nullable so existing workspaces are unaffected.
--    Workspace ↔ Stripe routing uses subscription/customer metadata.workspace_id (UUID)
--    as the primary key; these columns are secondary for reverse-lookup.

-- ---------------------------------------------------------------------------
-- Idempotency log for inbound webhook events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing_webhook_events (
  stripe_event_id    TEXT        PRIMARY KEY,
  event_type         TEXT        NOT NULL,
  workspace_id       UUID        NULL REFERENCES workspaces(id) ON DELETE SET NULL,
  processing_status  TEXT        NOT NULL DEFAULT 'applied'
                     CHECK (processing_status IN ('applied', 'ignored', 'error', 'duplicate')),
  received_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  error_message      TEXT        NULL
);

CREATE INDEX IF NOT EXISTS idx_billing_webhook_events_workspace
  ON billing_webhook_events (workspace_id)
  WHERE workspace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_billing_webhook_events_received
  ON billing_webhook_events (received_at DESC);

-- ---------------------------------------------------------------------------
-- Stripe IDs on workspaces (additive, nullable)
-- ---------------------------------------------------------------------------
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS stripe_customer_id     TEXT UNIQUE NULL,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE NULL;
