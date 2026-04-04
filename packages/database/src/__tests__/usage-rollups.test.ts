/**
 * F.32 — Unit tests for usage-rollups.repository.ts.
 * Uses mock Pool (no real Postgres required).
 */

import { describe, it, expect, vi } from "vitest";
import type { Pool } from "pg";
import {
  aggregateUsageEventsDaily,
  getRollupForWorkspaceDay,
  listRollupsForWorkspace,
  getAggregationCursor,
  advanceAggregationCursor,
  resolveAggregationWindow,
  type UsageRollupDailyRow,
  type AggregationCursorRow,
} from "../usage-rollups.repository.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePool(rows: unknown[], rowCount?: number): Pool {
  return {
    query: vi.fn().mockResolvedValue({ rows, rowCount: rowCount ?? rows.length }),
  } as unknown as Pool;
}

function makeMultiPool(responses: Array<{ rows: unknown[]; rowCount?: number }>): Pool {
  const fn = vi.fn();
  for (const resp of responses) {
    fn.mockResolvedValueOnce({ rows: resp.rows, rowCount: resp.rowCount ?? resp.rows.length });
  }
  return { query: fn } as unknown as Pool;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ROLLUP_ROW: UsageRollupDailyRow = {
  bucket_date: "2026-04-01",
  workspace_path_key: "abc1234567890def",
  request_count: "10",
  stream_request_count: "4",
  total_latency_ms: "8000",
  sum_input_tokens: null,
  sum_output_tokens: null,
  sum_total_tokens: null,
  tier_downgraded_count: "0",
  sum_fallback_count: "1",
  mode_breakdown: { agent: 7, ask: 3 },
  model_breakdown: { "gpt-4o-mini": 10 },
  last_aggregated_at: "2026-04-02T00:05:00Z",
};

const CURSOR_ROW: AggregationCursorRow = {
  job_name: "daily",
  last_closed_day: "2026-03-31",
  updated_at: "2026-04-01T00:05:00Z",
};

// ---------------------------------------------------------------------------
// aggregateUsageEventsDaily
// ---------------------------------------------------------------------------

describe("aggregateUsageEventsDaily", () => {
  it("returns rowsUpserted from pool rowCount", async () => {
    const pool = makePool([], 3);
    const result = await aggregateUsageEventsDaily(pool, {
      fromDate: "2026-04-01",
      toDate: "2026-04-01",
    });
    expect(result.rowsUpserted).toBe(3);
  });

  it("calculates daysProcessed = 1 for a single-day range", async () => {
    const pool = makePool([], 1);
    const { daysProcessed } = await aggregateUsageEventsDaily(pool, {
      fromDate: "2026-04-01",
      toDate: "2026-04-01",
    });
    expect(daysProcessed).toBe(1);
  });

  it("calculates daysProcessed = 3 for a 3-day range", async () => {
    const pool = makePool([], 5);
    const { daysProcessed } = await aggregateUsageEventsDaily(pool, {
      fromDate: "2026-04-01",
      toDate: "2026-04-03",
    });
    expect(daysProcessed).toBe(3);
  });

  it("passes fromDate and toDate as SQL params $1 and $2", async () => {
    const pool = makePool([], 0);
    await aggregateUsageEventsDaily(pool, { fromDate: "2026-04-01", toDate: "2026-04-02" });
    const call0 = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const [, params] = call0;
    expect(params[0]).toBe("2026-04-01");
    expect(params[1]).toBe("2026-04-02");
  });

  it("SQL contains INSERT INTO usage_rollups_daily and ON CONFLICT DO UPDATE", async () => {
    const pool = makePool([], 0);
    await aggregateUsageEventsDaily(pool, { fromDate: "2026-04-01", toDate: "2026-04-01" });
    const call0 = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const [sql] = call0;
    expect(sql).toMatch(/INSERT INTO usage_rollups_daily/i);
    expect(sql).toMatch(/ON CONFLICT.*DO UPDATE/is);
  });

  it("returns 0 rowsUpserted when no events in range", async () => {
    const pool = makePool([], 0);
    const result = await aggregateUsageEventsDaily(pool, {
      fromDate: "2026-04-01",
      toDate: "2026-04-01",
    });
    expect(result.rowsUpserted).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getRollupForWorkspaceDay
// ---------------------------------------------------------------------------

describe("getRollupForWorkspaceDay", () => {
  it("returns matching row", async () => {
    const pool = makePool([ROLLUP_ROW]);
    const result = await getRollupForWorkspaceDay(pool, "abc1234567890def", "2026-04-01");
    expect(result).toEqual(ROLLUP_ROW);
    const call0 = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const [sql, params] = call0;
    expect(sql).toMatch(/WHERE workspace_path_key = \$1/i);
    expect(params[0]).toBe("abc1234567890def");
    expect(params[1]).toBe("2026-04-01");
  });

  it("returns null when not found", async () => {
    const pool = makePool([]);
    expect(await getRollupForWorkspaceDay(pool, "notfound", "2026-04-01")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// listRollupsForWorkspace
// ---------------------------------------------------------------------------

describe("listRollupsForWorkspace", () => {
  it("returns all rows in date range", async () => {
    const pool = makePool([ROLLUP_ROW, { ...ROLLUP_ROW, bucket_date: "2026-04-02" }]);
    const result = await listRollupsForWorkspace(pool, "abc1234567890def", "2026-04-01", "2026-04-02");
    expect(result).toHaveLength(2);
  });

  it("returns empty array when no rows", async () => {
    const pool = makePool([]);
    expect(await listRollupsForWorkspace(pool, "k", "2026-04-01", "2026-04-02")).toEqual([]);
  });

  it("passes pathKey, fromDate, toDate as params", async () => {
    const pool = makePool([]);
    await listRollupsForWorkspace(pool, "mykey", "2026-03-01", "2026-03-31");
    const call0 = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const [, params] = call0;
    expect(params[0]).toBe("mykey");
    expect(params[1]).toBe("2026-03-01");
    expect(params[2]).toBe("2026-03-31");
  });
});

// ---------------------------------------------------------------------------
// getAggregationCursor
// ---------------------------------------------------------------------------

describe("getAggregationCursor", () => {
  it("returns cursor row when found", async () => {
    const pool = makePool([CURSOR_ROW]);
    expect(await getAggregationCursor(pool, "daily")).toEqual(CURSOR_ROW);
    const call0 = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const [sql, params] = call0;
    expect(sql).toMatch(/WHERE job_name = \$1/i);
    expect(params[0]).toBe("daily");
  });

  it("defaults jobName to 'daily'", async () => {
    const pool = makePool([CURSOR_ROW]);
    await getAggregationCursor(pool);
    const call0 = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const [, params] = call0;
    expect(params[0]).toBe("daily");
  });

  it("returns null when not found", async () => {
    const pool = makePool([]);
    expect(await getAggregationCursor(pool)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// advanceAggregationCursor
// ---------------------------------------------------------------------------

describe("advanceAggregationCursor", () => {
  it("returns updated cursor row", async () => {
    const updated = { ...CURSOR_ROW, last_closed_day: "2026-04-01" };
    const pool = makePool([updated]);
    const result = await advanceAggregationCursor(pool, "2026-04-01");
    expect(result.last_closed_day).toBe("2026-04-01");
  });

  it("SQL uses ON CONFLICT DO UPDATE", async () => {
    const pool = makePool([CURSOR_ROW]);
    await advanceAggregationCursor(pool, "2026-04-01", "daily");
    const call0 = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const [sql, params] = call0;
    expect(sql).toMatch(/ON CONFLICT.*DO UPDATE/is);
    expect(params[0]).toBe("daily");
    expect(params[1]).toBe("2026-04-01");
  });
});

// ---------------------------------------------------------------------------
// resolveAggregationWindow
// ---------------------------------------------------------------------------

describe("resolveAggregationWindow", () => {
  it("returns null when cursor is already at yesterday", async () => {
    const nowUtc = new Date();
    nowUtc.setUTCHours(0, 0, 0, 0);
    const yesterday = new Date(nowUtc.getTime() - 86_400_000).toISOString().slice(0, 10);
    const cursorAtYesterday: AggregationCursorRow = {
      job_name: "daily",
      last_closed_day: yesterday,
      updated_at: "2026-04-01T00:05:00Z",
    };
    const pool = makePool([cursorAtYesterday]);
    const result = await resolveAggregationWindow(pool, 0);
    expect(result).toBeNull();
  });

  it("returns a non-null window when cursor is in the past", async () => {
    // Cursor at a fixed old date; today - 0 lookback days means fromDate = yesterday.
    const cursor: AggregationCursorRow = {
      job_name: "daily",
      last_closed_day: "2026-01-01",
      updated_at: "2026-01-02T00:00:00Z",
    };
    const pool = makePool([cursor]);
    const result = await resolveAggregationWindow(pool, 0);
    expect(result).not.toBeNull();
    // fromDate should not be before cursor+1 day
    expect(result!.fromDate >= "2026-01-02").toBe(true);
    // toDate should be yesterday UTC
    const nowUtc = new Date();
    nowUtc.setUTCHours(0, 0, 0, 0);
    const yesterday = new Date(nowUtc.getTime() - 86_400_000).toISOString().slice(0, 10);
    expect(result!.toDate).toBe(yesterday);
  });

  it("fetches earliest event day when cursor is null", async () => {
    const nullCursor: AggregationCursorRow = {
      job_name: "daily",
      last_closed_day: null,
      updated_at: "2026-01-01T00:00:00Z",
    };
    const pool = makeMultiPool([
      { rows: [nullCursor] },
      { rows: [{ min_day: "2026-03-10" }] },
    ]);
    const result = await resolveAggregationWindow(pool, 2);
    expect(result?.fromDate).toBe("2026-03-10");
  });

  it("returns non-null when cursor is null and no events exist (falls back to yesterday)", async () => {
    const nullCursor: AggregationCursorRow = {
      job_name: "daily",
      last_closed_day: null,
      updated_at: "2026-01-01T00:00:00Z",
    };
    const pool = makeMultiPool([
      { rows: [nullCursor] },
      { rows: [{ min_day: null }] },
    ]);
    const result = await resolveAggregationWindow(pool, 2);
    // Falls back to toDate (yesterday) — fromDate === toDate
    expect(result).not.toBeNull();
    expect(result!.fromDate).toBe(result!.toDate);
  });
});
