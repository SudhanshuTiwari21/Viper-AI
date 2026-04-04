/**
 * F.32 — Repository for usage_rollups_daily and usage_aggregation_cursor.
 *
 * Aggregation model:
 *   - Grain: one row per (bucket_date DATE UTC, workspace_path_key TEXT).
 *   - bucket_date: (occurred_at AT TIME ZONE 'UTC')::date — stable, tz-independent.
 *   - Upsert strategy: full recompute for each target day window.
 *     Re-running for the same date range is always safe (idempotent).
 *   - stream_request_count: derived from metadata->>'stream' = 'true'.
 *   - Token sums: NULL when all source rows have NULL tokens (F.31 default).
 *   - mode_breakdown / model_breakdown: JSONB {value → count} for fast lookups.
 *
 * Cursor model:
 *   - usage_aggregation_cursor('daily').last_closed_day tracks the last UTC
 *     calendar day fully processed. Advance it on success.
 *   - NULL means never run; start from the earliest event day found.
 */

import type { Pool } from "pg";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UsageRollupDailyRow {
  bucket_date: string; // "YYYY-MM-DD"
  workspace_path_key: string;
  request_count: string; // BIGINT as string from pg driver
  stream_request_count: string;
  total_latency_ms: string;
  sum_input_tokens: string | null;
  sum_output_tokens: string | null;
  sum_total_tokens: string | null;
  tier_downgraded_count: string;
  sum_fallback_count: string;
  mode_breakdown: Record<string, number>;
  model_breakdown: Record<string, number>;
  last_aggregated_at: string;
}

export interface AggregationCursorRow {
  job_name: string;
  last_closed_day: string | null; // "YYYY-MM-DD" or null
  updated_at: string;
}

export interface AggregationRangeParams {
  /** First UTC date to aggregate (inclusive), e.g. "2026-01-01" */
  fromDate: string;
  /** Last UTC date to aggregate (inclusive), e.g. "2026-01-03" */
  toDate: string;
}

export interface AggregationResult {
  daysProcessed: number;
  rowsUpserted: number;
}

// ---------------------------------------------------------------------------
// Aggregation SQL (full recompute for window)
// ---------------------------------------------------------------------------

const AGGREGATE_SQL = `
WITH base AS (
  SELECT
    (occurred_at AT TIME ZONE 'UTC')::date              AS bucket_date,
    workspace_path_key,
    mode,
    final_model_id,
    (metadata->>'stream') = 'true'                       AS is_stream,
    latency_ms,
    input_tokens,
    output_tokens,
    total_tokens,
    tier_downgraded,
    fallback_count
  FROM usage_events
  WHERE occurred_at >= ($1::date)::timestamptz
    AND occurred_at <  ($2::date + INTERVAL '1 day')::timestamptz
),
by_day AS (
  SELECT
    bucket_date,
    workspace_path_key,
    COUNT(*)                              AS request_count,
    COUNT(*) FILTER (WHERE is_stream)     AS stream_request_count,
    COALESCE(SUM(latency_ms), 0)          AS total_latency_ms,
    NULLIF(SUM(input_tokens),  0)         AS sum_input_tokens,
    NULLIF(SUM(output_tokens), 0)         AS sum_output_tokens,
    NULLIF(SUM(total_tokens),  0)         AS sum_total_tokens,
    COUNT(*) FILTER (WHERE tier_downgraded) AS tier_downgraded_count,
    COALESCE(SUM(fallback_count), 0)      AS sum_fallback_count
  FROM base
  GROUP BY bucket_date, workspace_path_key
),
mode_counts AS (
  SELECT
    bucket_date,
    workspace_path_key,
    jsonb_object_agg(mode, cnt)  AS mode_breakdown
  FROM (
    SELECT bucket_date, workspace_path_key, mode, COUNT(*) AS cnt
    FROM base
    GROUP BY bucket_date, workspace_path_key, mode
  ) sub
  GROUP BY bucket_date, workspace_path_key
),
model_counts AS (
  SELECT
    bucket_date,
    workspace_path_key,
    jsonb_object_agg(final_model_id, cnt) AS model_breakdown
  FROM (
    SELECT bucket_date, workspace_path_key, final_model_id, COUNT(*) AS cnt
    FROM base
    GROUP BY bucket_date, workspace_path_key, final_model_id
  ) sub
  GROUP BY bucket_date, workspace_path_key
)
INSERT INTO usage_rollups_daily (
  bucket_date, workspace_path_key,
  request_count, stream_request_count, total_latency_ms,
  sum_input_tokens, sum_output_tokens, sum_total_tokens,
  tier_downgraded_count, sum_fallback_count,
  mode_breakdown, model_breakdown, last_aggregated_at
)
SELECT
  d.bucket_date,
  d.workspace_path_key,
  d.request_count,
  d.stream_request_count,
  d.total_latency_ms,
  d.sum_input_tokens,
  d.sum_output_tokens,
  d.sum_total_tokens,
  d.tier_downgraded_count,
  d.sum_fallback_count,
  COALESCE(mc.mode_breakdown,  '{}'::jsonb),
  COALESCE(ml.model_breakdown, '{}'::jsonb),
  now()
FROM by_day d
LEFT JOIN mode_counts  mc USING (bucket_date, workspace_path_key)
LEFT JOIN model_counts ml USING (bucket_date, workspace_path_key)
ON CONFLICT (bucket_date, workspace_path_key) DO UPDATE SET
  request_count         = EXCLUDED.request_count,
  stream_request_count  = EXCLUDED.stream_request_count,
  total_latency_ms      = EXCLUDED.total_latency_ms,
  sum_input_tokens      = EXCLUDED.sum_input_tokens,
  sum_output_tokens     = EXCLUDED.sum_output_tokens,
  sum_total_tokens      = EXCLUDED.sum_total_tokens,
  tier_downgraded_count = EXCLUDED.tier_downgraded_count,
  sum_fallback_count    = EXCLUDED.sum_fallback_count,
  mode_breakdown        = EXCLUDED.mode_breakdown,
  model_breakdown       = EXCLUDED.model_breakdown,
  last_aggregated_at    = now()
`;

// ---------------------------------------------------------------------------
// Core aggregation function
// ---------------------------------------------------------------------------

/**
 * Aggregate usage_events into usage_rollups_daily for [fromDate, toDate] UTC.
 *
 * - Idempotent: re-running for the same range produces the same result.
 * - Returns the number of workspace-day rows upserted.
 */
export async function aggregateUsageEventsDaily(
  pool: Pool,
  params: AggregationRangeParams,
): Promise<AggregationResult> {
  const { fromDate, toDate } = params;
  const result = await pool.query(AGGREGATE_SQL, [fromDate, toDate]);

  const from = new Date(fromDate + "T00:00:00Z");
  const to = new Date(toDate + "T00:00:00Z");
  const daysProcessed = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1);

  return { daysProcessed, rowsUpserted: result.rowCount ?? 0 };
}

// ---------------------------------------------------------------------------
// Point lookup helpers
// ---------------------------------------------------------------------------

/**
 * Fetch a single daily rollup row for a workspace on a specific UTC date.
 * Returns null when no aggregate exists (job hasn't run or no events).
 */
export async function getRollupForWorkspaceDay(
  pool: Pool,
  pathKey: string,
  day: string,
): Promise<UsageRollupDailyRow | null> {
  const result = await pool.query<UsageRollupDailyRow>(
    `SELECT * FROM usage_rollups_daily
     WHERE workspace_path_key = $1 AND bucket_date = $2::date LIMIT 1`,
    [pathKey, day],
  );
  return result.rows[0] ?? null;
}

/**
 * List all daily rollup rows for a workspace between two UTC dates (inclusive).
 */
export async function listRollupsForWorkspace(
  pool: Pool,
  pathKey: string,
  fromDate: string,
  toDate: string,
): Promise<UsageRollupDailyRow[]> {
  const result = await pool.query<UsageRollupDailyRow>(
    `SELECT * FROM usage_rollups_daily
     WHERE workspace_path_key = $1
       AND bucket_date BETWEEN $2::date AND $3::date
     ORDER BY bucket_date ASC`,
    [pathKey, fromDate, toDate],
  );
  return result.rows;
}

// ---------------------------------------------------------------------------
// Aggregation cursor
// ---------------------------------------------------------------------------

/**
 * Read the cursor for a named aggregation job ('daily' by default).
 */
export async function getAggregationCursor(
  pool: Pool,
  jobName: string = "daily",
): Promise<AggregationCursorRow | null> {
  const result = await pool.query<AggregationCursorRow>(
    `SELECT * FROM usage_aggregation_cursor WHERE job_name = $1 LIMIT 1`,
    [jobName],
  );
  return result.rows[0] ?? null;
}

/**
 * Advance the watermark cursor to newClosedDay after a successful run.
 * Upserts so it works even if the migration seed row was somehow missing.
 */
export async function advanceAggregationCursor(
  pool: Pool,
  newClosedDay: string,
  jobName: string = "daily",
): Promise<AggregationCursorRow> {
  const result = await pool.query<AggregationCursorRow>(
    `INSERT INTO usage_aggregation_cursor (job_name, last_closed_day)
     VALUES ($1, $2::date)
     ON CONFLICT (job_name) DO UPDATE
       SET last_closed_day = EXCLUDED.last_closed_day,
           updated_at      = now()
     RETURNING *`,
    [jobName, newClosedDay],
  );
  return result.rows[0]!;
}

/**
 * Resolve the next aggregation window based on the stored cursor.
 *
 * fromDate = max(cursor.last_closed_day + 1, toDate - lookbackDays)
 *            or earliest event day when cursor is null
 * toDate   = yesterday UTC (fully closed day)
 *
 * Returns null when the cursor is already up-to-date (nothing to process).
 */
export async function resolveAggregationWindow(
  pool: Pool,
  lookbackDays: number = 2,
  jobName: string = "daily",
): Promise<{ fromDate: string; toDate: string } | null> {
  const cursor = await getAggregationCursor(pool, jobName);

  const nowUtc = new Date();
  nowUtc.setUTCHours(0, 0, 0, 0);
  const toDate = new Date(nowUtc.getTime() - 86_400_000).toISOString().slice(0, 10);

  let fromDate: string;
  if (cursor?.last_closed_day) {
    const lastClosed = new Date(cursor.last_closed_day + "T00:00:00Z");
    // Start from max(nextDay, toDate - lookbackDays) to re-process recent days.
    const nextDay = new Date(lastClosed.getTime() + 86_400_000);
    const lookbackStart = new Date(new Date(toDate + "T00:00:00Z").getTime() - lookbackDays * 86_400_000);
    const from = nextDay < lookbackStart ? lookbackStart : nextDay;
    fromDate = from.toISOString().slice(0, 10);
  } else {
    const earliest = await pool.query<{ min_day: string | null }>(
      `SELECT (MIN(occurred_at) AT TIME ZONE 'UTC')::date::text AS min_day FROM usage_events`,
    );
    fromDate = earliest.rows[0]?.min_day ?? toDate;
  }

  if (fromDate > toDate) return null;
  return { fromDate, toDate };
}
