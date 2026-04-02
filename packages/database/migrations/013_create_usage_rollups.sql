-- F.32: Usage aggregation — daily rollup tables.
--
-- Design notes:
--  * Grain: one row per (bucket_date DATE, workspace_path_key TEXT).
--    bucket_date is the UTC calendar date of occurred_at:
--      (occurred_at AT TIME ZONE 'UTC')::date
--    This is stable, timezone-independent, and re-runnable.
--
--  * Idempotency: the aggregation job uses INSERT … ON CONFLICT DO UPDATE (upsert),
--    re-computing the full aggregate for the target day window. Re-running the job
--    for the same day is always safe and produces the same result.
--
--  * Watermark: usage_aggregation_cursor stores the last fully-closed UTC day that
--    was processed. The job advances this forward on success. It is initialized
--    to NULL (job starts from the earliest event day it can find).
--
--  * Token columns are BIGINT NULL: they stay NULL when all source rows have NULL
--    tokens (the F.31 default). They become non-null once token wiring lands.
--
--  * stream_request_count: derived from metadata->>'stream' = 'true'.
--    (F.31 stores metadata.stream as a JSON boolean; cast to text for comparison.)

-- ---------------------------------------------------------------------------
-- Daily rollup table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usage_rollups_daily (
  bucket_date            DATE    NOT NULL,
  workspace_path_key     TEXT    NOT NULL,

  request_count          BIGINT  NOT NULL DEFAULT 0,
  stream_request_count   BIGINT  NOT NULL DEFAULT 0,
  total_latency_ms       BIGINT  NOT NULL DEFAULT 0,

  sum_input_tokens       BIGINT  NULL,
  sum_output_tokens      BIGINT  NULL,
  sum_total_tokens       BIGINT  NULL,

  tier_downgraded_count  BIGINT  NOT NULL DEFAULT 0,
  sum_fallback_count     BIGINT  NOT NULL DEFAULT 0,

  -- JSONB breakdown for F.33 fast-path lookups (mode → count, model → count).
  -- Populated only when aggregation runs; callers should treat absent keys as 0.
  mode_breakdown         JSONB   NOT NULL DEFAULT '{}'::jsonb,
  model_breakdown        JSONB   NOT NULL DEFAULT '{}'::jsonb,

  last_aggregated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (bucket_date, workspace_path_key)
);

CREATE INDEX IF NOT EXISTS idx_usage_rollups_daily_bucket
  ON usage_rollups_daily (bucket_date DESC);

-- ---------------------------------------------------------------------------
-- Watermark cursor — single-row table, one row per named job.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usage_aggregation_cursor (
  job_name           TEXT        PRIMARY KEY,
  last_closed_day    DATE        NULL,   -- last UTC day fully processed; NULL = never run
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the default cursor row so the first SELECT finds it.
INSERT INTO usage_aggregation_cursor (job_name, last_closed_day)
VALUES ('daily', NULL)
ON CONFLICT (job_name) DO NOTHING;
