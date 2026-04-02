/**
 * F.34 — Unit tests for stripe-webhook.service.ts
 *
 * All Stripe SDK calls and DB calls are mocked — no network, no Postgres.
 *
 * Coverage:
 *  1. isStripeWebhookEnabled()   — env flag parsing
 *  2. getWebhookSecret()         — primary + fallback env vars
 *  3. loadPlanEntitlements()     — JSON parse, malformed, empty
 *  4. verifyStripeEvent()        — success + failure paths (mock constructEvent)
 *  5. processStripeWebhook()     — idempotency (duplicate), missing workspace_id,
 *                                  subscription.updated applied, subscription.deleted,
 *                                  checkout.session.completed, unhandled event type
 */

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockInsertWebhookEvent,
  mockUpsertEntitlements,
  mockDeleteEntitlements,
  mockGetPool,
} = vi.hoisted(() => ({
  mockInsertWebhookEvent: vi.fn(),
  mockUpsertEntitlements: vi.fn(),
  mockDeleteEntitlements: vi.fn(),
  mockGetPool: vi.fn().mockReturnValue({
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  }),
}));

vi.mock("@repo/database", () => ({
  getPool: mockGetPool,
  insertWebhookEventIfNew: mockInsertWebhookEvent,
  upsertWorkspaceEntitlements: mockUpsertEntitlements,
  deleteWorkspaceEntitlements: mockDeleteEntitlements,
}));

const { mockWorkflowLog } = vi.hoisted(() => ({ mockWorkflowLog: vi.fn() }));
vi.mock("../services/assistant.service.js", () => ({
  workflowLog: mockWorkflowLog,
}));

// Mock Stripe constructEvent
const mockConstructEvent = vi.fn();
vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: mockConstructEvent,
    },
  })),
}));

import {
  isStripeWebhookEnabled,
  getWebhookSecret,
  loadPlanEntitlements,
  verifyStripeEvent,
  processStripeWebhook,
} from "./stripe-webhook.service.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSubscriptionEvent(
  type: string,
  workspaceId: string | null,
  priceId = "price_abc",
): object {
  return {
    id: `evt_${Math.random().toString(36).slice(2)}`,
    type,
    data: {
      object: {
        id: "sub_test",
        object: "subscription",
        metadata: workspaceId ? { workspace_id: workspaceId } : {},
        items: {
          data: [
            {
              price: { id: priceId, object: "price" },
            },
          ],
        },
      },
    },
  };
}

function makeCheckoutEvent(workspaceId: string | null): object {
  return {
    id: `evt_checkout_${Math.random().toString(36).slice(2)}`,
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test",
        object: "checkout.session",
        metadata: workspaceId ? { workspace_id: workspaceId } : {},
        subscription: "sub_test",
        customer: "cus_test",
      },
    },
  };
}

// ---------------------------------------------------------------------------
// 1. isStripeWebhookEnabled
// ---------------------------------------------------------------------------

describe("isStripeWebhookEnabled", () => {
  afterEach(() => {
    delete process.env.VIPER_STRIPE_WEBHOOK_ENABLED;
  });

  it("returns false when env unset", () => {
    expect(isStripeWebhookEnabled()).toBe(false);
  });

  it("returns true when set to '1'", () => {
    process.env.VIPER_STRIPE_WEBHOOK_ENABLED = "1";
    expect(isStripeWebhookEnabled()).toBe(true);
  });

  it("returns true when set to 'true' (case insensitive)", () => {
    process.env.VIPER_STRIPE_WEBHOOK_ENABLED = "true";
    expect(isStripeWebhookEnabled()).toBe(true);
  });

  it("returns false for other values", () => {
    process.env.VIPER_STRIPE_WEBHOOK_ENABLED = "yes";
    expect(isStripeWebhookEnabled()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. getWebhookSecret
// ---------------------------------------------------------------------------

describe("getWebhookSecret", () => {
  afterEach(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.VIPER_STRIPE_WEBHOOK_SECRET;
  });

  it("returns undefined when neither env var set", () => {
    expect(getWebhookSecret()).toBeUndefined();
  });

  it("returns STRIPE_WEBHOOK_SECRET when set", () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_primary";
    expect(getWebhookSecret()).toBe("whsec_primary");
  });

  it("returns VIPER_STRIPE_WEBHOOK_SECRET as fallback", () => {
    process.env.VIPER_STRIPE_WEBHOOK_SECRET = "whsec_fallback";
    expect(getWebhookSecret()).toBe("whsec_fallback");
  });
});

// ---------------------------------------------------------------------------
// 3. loadPlanEntitlements
// ---------------------------------------------------------------------------

describe("loadPlanEntitlements", () => {
  afterEach(() => {
    delete process.env.VIPER_STRIPE_PRICE_ENTITLEMENTS;
  });

  it("returns empty map when env not set", () => {
    expect(loadPlanEntitlements()).toEqual({});
  });

  it("parses valid JSON map", () => {
    process.env.VIPER_STRIPE_PRICE_ENTITLEMENTS = JSON.stringify({
      price_pro: { allowed_model_tiers: ["standard", "premium"], flags: { monthly_request_quota: 1000 } },
    });
    const map = loadPlanEntitlements();
    expect(map["price_pro"]).toBeDefined();
    expect(map["price_pro"]!.flags?.["monthly_request_quota"]).toBe(1000);
  });

  it("returns empty map for malformed JSON", () => {
    process.env.VIPER_STRIPE_PRICE_ENTITLEMENTS = "{not valid json}";
    expect(loadPlanEntitlements()).toEqual({});
  });

  it("returns empty map for non-object JSON", () => {
    process.env.VIPER_STRIPE_PRICE_ENTITLEMENTS = "[1,2,3]";
    expect(loadPlanEntitlements()).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// 4. verifyStripeEvent
// ---------------------------------------------------------------------------

describe("verifyStripeEvent", () => {
  it("returns parsed event on valid signature", () => {
    const fakeEvent = { id: "evt_valid", type: "customer.subscription.updated" };
    mockConstructEvent.mockReturnValueOnce(fakeEvent);
    const result = verifyStripeEvent(Buffer.from("{}"), "t=1,v1=abc", "whsec_test");
    expect(result).toEqual(fakeEvent);
    expect(mockConstructEvent).toHaveBeenCalledWith(Buffer.from("{}"), "t=1,v1=abc", "whsec_test");
  });

  it("throws when signature is invalid", () => {
    mockConstructEvent.mockImplementationOnce(() => {
      throw new Error("No signatures found matching the expected signature for payload");
    });
    expect(() => verifyStripeEvent(Buffer.from("{}"), "bad_sig", "whsec_test")).toThrow(
      "No signatures found",
    );
  });
});

// ---------------------------------------------------------------------------
// 5. processStripeWebhook
// ---------------------------------------------------------------------------

describe("processStripeWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default pool mock
    mockGetPool.mockReturnValue({
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    });
    // Default: insert succeeds (not a duplicate)
    mockInsertWebhookEvent.mockResolvedValue({ stripe_event_id: "evt_1" });
    mockUpsertEntitlements.mockResolvedValue({});
    mockDeleteEntitlements.mockResolvedValue(true);
  });

  afterEach(() => {
    delete process.env.VIPER_STRIPE_PRICE_ENTITLEMENTS;
  });

  it("returns duplicate when stripe_event_id already processed", async () => {
    mockInsertWebhookEvent.mockResolvedValueOnce(null); // null = already exists
    const event = makeSubscriptionEvent("customer.subscription.updated", "ws-uuid-123");
    const result = await processStripeWebhook(event as never);
    expect(result.status).toBe("duplicate");
    expect(mockUpsertEntitlements).not.toHaveBeenCalled();
  });

  it("returns ignored when metadata.workspace_id missing", async () => {
    const event = makeSubscriptionEvent("customer.subscription.updated", null);
    const result = await processStripeWebhook(event as never);
    expect(result.status).toBe("ignored");
    expect(result.reason).toMatch(/missing metadata/i);
    expect(mockUpsertEntitlements).not.toHaveBeenCalled();
  });

  it("applies entitlements for subscription.updated with known price", async () => {
    process.env.VIPER_STRIPE_PRICE_ENTITLEMENTS = JSON.stringify({
      price_abc: { allowed_model_tiers: ["standard"], flags: { monthly_request_quota: 500 } },
    });
    const event = makeSubscriptionEvent("customer.subscription.updated", "ws-uuid-abc", "price_abc");
    const result = await processStripeWebhook(event as never);
    expect(result.status).toBe("applied");
    expect(mockUpsertEntitlements).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ workspace_id: "ws-uuid-abc" }),
    );
  });

  it("ignores subscription.updated when price not in plan map", async () => {
    // No VIPER_STRIPE_PRICE_ENTITLEMENTS set → empty map
    const event = makeSubscriptionEvent("customer.subscription.updated", "ws-uuid-abc", "price_unknown");
    const result = await processStripeWebhook(event as never);
    expect(result.status).toBe("ignored");
    expect(mockUpsertEntitlements).not.toHaveBeenCalled();
  });

  it("deletes entitlements for subscription.deleted", async () => {
    const event = makeSubscriptionEvent("customer.subscription.deleted", "ws-uuid-abc");
    const result = await processStripeWebhook(event as never);
    expect(result.status).toBe("applied");
    expect(mockDeleteEntitlements).toHaveBeenCalledWith(expect.anything(), "ws-uuid-abc");
  });

  it("handles checkout.session.completed (links customer; ignored without matching price)", async () => {
    const event = makeCheckoutEvent("ws-uuid-abc");
    const result = await processStripeWebhook(event as never);
    // No line_items in mock → ignored (entitlements set by subscription.updated)
    expect(result.status).toBe("ignored");
    expect(result.workspaceId).toBe("ws-uuid-abc");
  });

  it("returns ignored for unhandled event types", async () => {
    const event = {
      id: "evt_unknown",
      type: "invoice.payment_succeeded",
      data: {
        object: {
          metadata: { workspace_id: "ws-uuid-abc" },
        },
      },
    };
    const result = await processStripeWebhook(event as never);
    expect(result.status).toBe("ignored");
  });

  it("emits billing:webhook:received workflowLog", async () => {
    const event = makeSubscriptionEvent("customer.subscription.updated", null);
    await processStripeWebhook(event as never);
    expect(mockWorkflowLog).toHaveBeenCalledWith(
      "billing:webhook:received",
      expect.anything(),
      expect.objectContaining({ event_type: "customer.subscription.updated" }),
    );
  });

  it("emits billing:webhook:applied on success", async () => {
    process.env.VIPER_STRIPE_PRICE_ENTITLEMENTS = JSON.stringify({
      price_abc: { flags: {} },
    });
    const event = makeSubscriptionEvent("customer.subscription.updated", "ws-uuid-abc", "price_abc");
    await processStripeWebhook(event as never);
    const appliedCall = (mockWorkflowLog as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => c[0] === "billing:webhook:applied",
    );
    expect(appliedCall).toBeDefined();
  });

  it("emits billing:webhook:duplicate when already seen", async () => {
    mockInsertWebhookEvent.mockResolvedValueOnce(null);
    const event = makeSubscriptionEvent("customer.subscription.updated", "ws-uuid-abc");
    await processStripeWebhook(event as never);
    const dupCall = (mockWorkflowLog as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => c[0] === "billing:webhook:duplicate",
    );
    expect(dupCall).toBeDefined();
  });
});
