/**
 * F.34 — Unit tests for billing-webhook-events.repository.ts
 * Uses a mock Pool (no real Postgres required).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  insertWebhookEventIfNew,
  updateWebhookEventStatus,
  getWebhookEvent,
} from "../billing-webhook-events.repository";
import type { Pool } from "pg";

function makePool(rows: unknown[] = [], throwErr?: Error): Pool {
  return {
    query: throwErr
      ? vi.fn().mockRejectedValue(throwErr)
      : vi.fn().mockResolvedValue({ rows, rowCount: rows.length }),
  } as unknown as Pool;
}

const sampleRow = {
  stripe_event_id: "evt_123",
  event_type: "customer.subscription.updated",
  workspace_id: "ws-uuid-abc",
  processing_status: "applied",
  received_at: new Date().toISOString(),
  error_message: null,
};

describe("insertWebhookEventIfNew", () => {
  it("returns the inserted row on first insert", async () => {
    const pool = makePool([sampleRow]);
    const result = await insertWebhookEventIfNew(pool, {
      stripe_event_id: "evt_123",
      event_type: "customer.subscription.updated",
      workspace_id: "ws-uuid-abc",
      processing_status: "applied",
    });
    expect(result).toEqual(sampleRow);
  });

  it("returns null when stripe_event_id already exists (ON CONFLICT DO NOTHING)", async () => {
    const pool = makePool([]); // 0 rows = conflict
    const result = await insertWebhookEventIfNew(pool, {
      stripe_event_id: "evt_123",
      event_type: "customer.subscription.updated",
      processing_status: "duplicate",
    });
    expect(result).toBeNull();
  });

  it("passes correct SQL parameters", async () => {
    const pool = makePool([sampleRow]);
    await insertWebhookEventIfNew(pool, {
      stripe_event_id: "evt_456",
      event_type: "customer.subscription.deleted",
      workspace_id: null,
      processing_status: "ignored",
      error_message: null,
    });
    const [sql, params] = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/ON CONFLICT.*DO NOTHING/i);
    expect(params[0]).toBe("evt_456");
    expect(params[1]).toBe("customer.subscription.deleted");
    expect(params[2]).toBeNull();
    expect(params[3]).toBe("ignored");
    expect(params[4]).toBeNull();
  });

  it("omits workspace_id when not provided (defaults to null)", async () => {
    const pool = makePool([{ ...sampleRow, workspace_id: null }]);
    const result = await insertWebhookEventIfNew(pool, {
      stripe_event_id: "evt_789",
      event_type: "customer.subscription.updated",
      processing_status: "applied",
    });
    expect(result?.workspace_id).toBeNull();
  });
});

describe("updateWebhookEventStatus", () => {
  it("returns updated row on success", async () => {
    const updated = { ...sampleRow, processing_status: "error", error_message: "bad config" };
    const pool = makePool([updated]);
    const result = await updateWebhookEventStatus(pool, "evt_123", "error", "bad config");
    expect(result?.processing_status).toBe("error");
    expect(result?.error_message).toBe("bad config");
  });

  it("returns null if event not found", async () => {
    const pool = makePool([]);
    const result = await updateWebhookEventStatus(pool, "evt_404", "ignored");
    expect(result).toBeNull();
  });
});

describe("getWebhookEvent", () => {
  it("returns the row when found", async () => {
    const pool = makePool([sampleRow]);
    const result = await getWebhookEvent(pool, "evt_123");
    expect(result).toEqual(sampleRow);
  });

  it("returns null when not found", async () => {
    const pool = makePool([]);
    const result = await getWebhookEvent(pool, "evt_missing");
    expect(result).toBeNull();
  });
});
