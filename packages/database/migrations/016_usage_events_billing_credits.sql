-- Credit-based quota: bucket + cost_units per event (see docs/VIPER_USAGE_AND_REVENUE_MODEL.md).

ALTER TABLE usage_events
  ADD COLUMN IF NOT EXISTS billing_bucket TEXT NULL
    CHECK (billing_bucket IS NULL OR billing_bucket IN ('auto', 'premium'));

ALTER TABLE usage_events
  ADD COLUMN IF NOT EXISTS cost_units BIGINT NOT NULL DEFAULT 1;

UPDATE usage_events
SET billing_bucket = CASE
  WHEN effective_model_tier = 'premium' THEN 'premium'
  ELSE 'auto'
END
WHERE billing_bucket IS NULL;

CREATE INDEX IF NOT EXISTS idx_usage_events_workspace_bucket_occurred
  ON usage_events (workspace_path_key, billing_bucket, occurred_at DESC);
