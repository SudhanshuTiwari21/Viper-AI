#!/usr/bin/env node
/**
 * F.32 — Daily usage aggregation CLI script.
 *
 * Invocation (from repo root):
 *   cd packages/database && npm run aggregate-usage
 *   # or directly:
 *   npx tsx src/scripts/run-usage-aggregation.ts
 *
 * Environment variables:
 *   DATABASE_URL              — required (Postgres connection string)
 *   VIPER_USAGE_AGGREGATE_ENABLED — must be "1" or "true" (safety kill-switch)
 *   VIPER_USAGE_AGGREGATE_LOOKBACK_DAYS — default 2; re-processes recent days
 *                                          for late-arriving events
 *
 * Exit codes:
 *   0 — success (including "nothing to process" case)
 *   1 — error (config check failed, DB error, etc.)
 *
 * Idempotency:
 *   Re-running for the same date range is safe — ON CONFLICT DO UPDATE
 *   replaces the existing row with freshly computed aggregates.
 *
 * UTC bucketing:
 *   All dates are computed in UTC. bucket_date = (occurred_at AT TIME ZONE 'UTC')::date.
 *   The script processes closed days only (up to yesterday UTC), never today,
 *   so partial-day counts are never persisted as final.
 */

import "dotenv/config";
import { getPool } from "../database.service.js";
import {
  resolveAggregationWindow,
  aggregateUsageEventsDaily,
  advanceAggregationCursor,
} from "../usage-rollups.repository.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function isEnabled(): boolean {
  const v = process.env["VIPER_USAGE_AGGREGATE_ENABLED"];
  return v === "1" || v?.toLowerCase() === "true";
}

function getLookbackDays(): number {
  const raw = process.env["VIPER_USAGE_AGGREGATE_LOOKBACK_DAYS"];
  if (!raw) return 2;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 2;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (!isEnabled()) {
    console.error(
      "[usage-aggregation] Skipped: VIPER_USAGE_AGGREGATE_ENABLED is not set to 1.\n" +
        "  Set VIPER_USAGE_AGGREGATE_ENABLED=1 to enable the aggregation job.",
    );
    process.exit(0);
  }

  if (!process.env["DATABASE_URL"]) {
    console.error("[usage-aggregation] Error: DATABASE_URL is not set.");
    process.exit(1);
  }

  const pool = getPool();
  const lookbackDays = getLookbackDays();

  console.log(`[usage-aggregation] Starting (lookbackDays=${lookbackDays})`);

  const window = await resolveAggregationWindow(pool, lookbackDays);

  if (!window) {
    console.log("[usage-aggregation] Nothing to process — cursor is already up-to-date.");
    process.exit(0);
  }

  const { fromDate, toDate } = window;
  console.log(`[usage-aggregation] Aggregating ${fromDate} → ${toDate} ...`);

  const result = await aggregateUsageEventsDaily(pool, { fromDate, toDate });

  await advanceAggregationCursor(pool, toDate);

  console.log(
    `[usage-aggregation] Done. days_processed=${result.daysProcessed} rows_upserted=${result.rowsUpserted}`,
  );

  await pool.end();
}

main().catch((err: unknown) => {
  console.error("[usage-aggregation] Fatal error:", err);
  process.exit(1);
});
