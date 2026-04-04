/**
 * F.31 — Unit tests for the usage-events repository.
 * Uses a mock Pool (no real Postgres required).
 */

import { describe, it, expect, vi } from "vitest";
import type { Pool } from "pg";
import {
  insertUsageEvent,
  getUsageEventByRequestId,
  countUsageEventsForDay,
  type UsageEventRow,
  type InsertUsageEventParams,
} from "../usage-events.repository.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePool(rows: unknown[], rowCount?: number): Pool {
  return {
    query: vi.fn().mockResolvedValue({ rows, rowCount: rowCount ?? rows.length }),
  } as unknown as Pool;
}

function makeConflictPool(): Pool {
  return {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  } as unknown as Pool;
}

const BASE_PARAMS: InsertUsageEventParams = {
  request_id: "req-uuid-1",
  workspace_path_key: "abc1234567890def",
  workspace_uuid: null,
  user_uuid: null,
  conversation_id: "conv-1",
  mode: "agent",
  intent: "code_edit",
  provider: "openai",
  primary_model_id: "gpt-4o",
  final_model_id: "gpt-4o",
  route_mode: "auto",
  effective_model_tier: "premium",
  tier_downgraded: false,
  fallback_count: 0,
  latency_ms: 1234,
  input_tokens: 150,
  output_tokens: 300,
  total_tokens: 450,
  tool_call_count: null,
  metadata: { stream: false },
};

const BASE_ROW: UsageEventRow = {
  id: "row-uuid-1",
  occurred_at: "2026-04-02T00:00:00Z",
  ...BASE_PARAMS,
  workspace_uuid: null,
  user_uuid: null,
  tool_call_count: null,
  metadata: { stream: false },
} as UsageEventRow;

// ---------------------------------------------------------------------------
// insertUsageEvent
// ---------------------------------------------------------------------------

describe("insertUsageEvent", () => {
  it("returns the inserted row", async () => {
    const pool = makePool([BASE_ROW]);
    const result = await insertUsageEvent(pool, BASE_PARAMS);
    expect(result).toEqual(BASE_ROW);
  });

  it("calls INSERT ... ON CONFLICT DO NOTHING RETURNING *", async () => {
    const pool = makePool([BASE_ROW]);
    await insertUsageEvent(pool, BASE_PARAMS);
    const call0 = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const [sql] = call0;
    expect(sql).toMatch(/INSERT INTO usage_events/i);
    expect(sql).toMatch(/ON CONFLICT.*DO NOTHING/is);
    expect(sql).toMatch(/RETURNING \*/i);
  });

  it("sends request_id as $1", async () => {
    const pool = makePool([BASE_ROW]);
    await insertUsageEvent(pool, BASE_PARAMS);
    const call0 = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const [, params] = call0;
    expect(params[0]).toBe("req-uuid-1");
  });

  it("sends workspace_path_key as $2", async () => {
    const pool = makePool([BASE_ROW]);
    await insertUsageEvent(pool, BASE_PARAMS);
    const call0 = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const [, params] = call0;
    expect(params[1]).toBe("abc1234567890def");
  });

  it("nulls optional fields when omitted", async () => {
    const pool = makePool([BASE_ROW]);
    const minParams: InsertUsageEventParams = {
      request_id: "req-2",
      workspace_path_key: "key2",
      mode: "ask",
      intent: "question",
      provider: "openai",
      primary_model_id: "gpt-4o-mini",
      final_model_id: "gpt-4o-mini",
      route_mode: "pinned",
      effective_model_tier: "auto",
      tier_downgraded: false,
      fallback_count: 0,
      latency_ms: 500,
    };
    await insertUsageEvent(pool, minParams);
    const call0 = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const [, params] = call0;
    // workspace_uuid ($3), user_uuid ($4), conversation_id ($5)
    expect(params[2]).toBeNull();
    expect(params[3]).toBeNull();
    expect(params[4]).toBeNull();
    // input_tokens ($16), output_tokens ($17), total_tokens ($18), tool_call_count ($19)
    expect(params[15]).toBeNull();
    expect(params[16]).toBeNull();
    expect(params[17]).toBeNull();
    expect(params[18]).toBeNull();
  });

  it("returns null on duplicate request_id (ON CONFLICT DO NOTHING returns empty)", async () => {
    const pool = makeConflictPool();
    const result = await insertUsageEvent(pool, BASE_PARAMS);
    expect(result).toBeNull();
  });

  it("serializes metadata as JSON string in params", async () => {
    const pool = makePool([BASE_ROW]);
    await insertUsageEvent(pool, { ...BASE_PARAMS, metadata: { stream: true, extra: 42 } });
    const call0 = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const [, params] = call0;
    // metadata is $20
    expect(params[19]).toBe(JSON.stringify({ stream: true, extra: 42 }));
  });

  it("defaults metadata to '{}' when not provided", async () => {
    const pool = makePool([BASE_ROW]);
    const { metadata: _m, ...noMeta } = BASE_PARAMS;
    await insertUsageEvent(pool, noMeta);
    const call0 = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const [, params] = call0;
    expect(params[19]).toBe("{}");
  });

  it("populates workspace_uuid and user_uuid when provided", async () => {
    const pool = makePool([BASE_ROW]);
    await insertUsageEvent(pool, {
      ...BASE_PARAMS,
      workspace_uuid: "ws-uuid-1",
      user_uuid: "user-uuid-1",
    });
    const call0 = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const [, params] = call0;
    expect(params[2]).toBe("ws-uuid-1");
    expect(params[3]).toBe("user-uuid-1");
  });

  it("sets tier_downgraded=true correctly", async () => {
    const pool = makePool([{ ...BASE_ROW, tier_downgraded: true }]);
    const result = await insertUsageEvent(pool, { ...BASE_PARAMS, tier_downgraded: true });
    expect(result?.tier_downgraded).toBe(true);
    const call0 = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const [, params] = call0;
    // tier_downgraded is $13
    expect(params[12]).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getUsageEventByRequestId
// ---------------------------------------------------------------------------

describe("getUsageEventByRequestId", () => {
  it("returns matching row", async () => {
    const pool = makePool([BASE_ROW]);
    const result = await getUsageEventByRequestId(pool, "req-uuid-1");
    expect(result).toEqual(BASE_ROW);
    const call0 = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const [sql, params] = call0;
    expect(sql).toMatch(/WHERE request_id = /i);
    expect(params[0]).toBe("req-uuid-1");
  });

  it("returns null when not found", async () => {
    const pool = makePool([]);
    expect(await getUsageEventByRequestId(pool, "nonexistent")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// countUsageEventsForDay (F.33)
// ---------------------------------------------------------------------------

describe("countUsageEventsForDay", () => {
  it("returns count string from DB", async () => {
    const pool = makePool([{ cnt: "7" }]);
    const result = await countUsageEventsForDay(pool, "abc1234567890def", "2026-04-02");
    expect(result).toBe("7");
  });

  it("returns '0' when no rows found", async () => {
    const pool = makePool([]);
    const result = await countUsageEventsForDay(pool, "abc1234567890def", "2026-04-02");
    expect(result).toBe("0");
  });

  it("passes workspace_path_key as $1 and dayUtc as $2 (used twice)", async () => {
    const pool = makePool([{ cnt: "3" }]);
    await countUsageEventsForDay(pool, "mykey", "2026-04-01");
    const call0 = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const [sql, params] = call0;
    expect(params[0]).toBe("mykey");
    expect(params[1]).toBe("2026-04-01");
    // Both $2 references in the WHERE clause use the same param index
    expect(sql).toMatch(/workspace_path_key = \$1/i);
    expect(sql).toMatch(/\$2/);
  });

  it("SQL uses half-open interval [day, day+1)", async () => {
    const pool = makePool([{ cnt: "0" }]);
    await countUsageEventsForDay(pool, "key", "2026-04-01");
    const call0 = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const [sql] = call0;
    expect(sql).toMatch(/occurred_at >= /i);
    expect(sql).toMatch(/occurred_at < /i);
    expect(sql).toMatch(/INTERVAL '1 day'/i);
  });
});
