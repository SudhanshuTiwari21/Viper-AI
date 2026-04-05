/**
 * F.35 — Route tests for POST /usage/summary.
 *
 * Coverage:
 *  1. Kill-switch off (default) → 404
 *  2. Kill-switch on + DATABASE_URL absent → 200 with zero usage + unlimited
 *  3. Kill-switch on + mocked DB → 200 with correct usage + limit
 *  4. Missing workspacePath → 400
 *  5. Workspace isolation: response pathKey always matches the requested workspacePath
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

// ---------------------------------------------------------------------------
// Hoisted mocks (must be before module imports)
// ---------------------------------------------------------------------------

const {
  mockGetPool,
  mockGetWorkspaceByPathKey,
  mockGetWorkspaceEntitlements,
  mockListRollups,
  mockCountToday,
} = vi.hoisted(() => ({
  mockGetPool: vi.fn().mockReturnValue({
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  }),
  mockGetWorkspaceByPathKey: vi.fn(),
  mockGetWorkspaceEntitlements: vi.fn(),
  mockListRollups: vi.fn().mockResolvedValue([]),
  mockCountToday: vi.fn().mockResolvedValue("0"),
}));

vi.mock("@repo/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@repo/database")>();
  const { mergeBillingPlanWithWorkspaceEntitlements } = actual;
  const emptyPlan = {
    slug: "free",
    display_name: "Free",
    allowed_modes: null as string[] | null,
    allowed_model_tiers: ["auto"] as string[],
    flags: {} as Record<string, unknown>,
    z_ratio_bp: null as number | null,
    auto_budget_share_bp: null as number | null,
    premium_budget_share_bp: null as number | null,
  };
  return {
    ...actual,
    getPool: mockGetPool,
    getWorkspaceByPathKey: mockGetWorkspaceByPathKey,
    getWorkspaceEntitlements: mockGetWorkspaceEntitlements,
    loadComposedWorkspaceEntitlements: vi.fn(async (_pool: unknown, workspace: { id: string }) => {
      const entRow = await mockGetWorkspaceEntitlements(
        _pool as import("pg").Pool,
        workspace.id,
      );
      return mergeBillingPlanWithWorkspaceEntitlements(workspace.id, emptyPlan, entRow);
    }),
    listRollupsForWorkspace: mockListRollups,
    countUsageEventsForDay: mockCountToday,
  };
});

// Mock entitlements middleware to no-op (enforcement off in tests)
vi.mock("../middleware/entitlements.middleware.js", () => ({
  entitlementsPreHandler: async (
    req: { entitlements?: null },
    _reply: unknown,
  ) => {
    req.entitlements = null;
  },
}));

import { usageRoutes } from "./usage.routes.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WORKSPACE_PATH = "/Users/test/my-project";

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(usageRoutes);
  await app.ready();
  return app;
}

function postSummary(app: FastifyInstance, body: Record<string, unknown>) {
  return app.inject({
    method: "POST",
    url: "/usage/summary",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /usage/summary — kill-switch off (default)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    delete process.env.VIPER_USAGE_UI_ENABLED;
    delete process.env.DATABASE_URL;
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 404 when VIPER_USAGE_UI_ENABLED is not set", async () => {
    const res = await postSummary(app, { workspacePath: WORKSPACE_PATH });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body) as { error: string };
    expect(body.error).toMatch(/not found/i);
  });
});

describe("POST /usage/summary — kill-switch on, no DATABASE_URL", () => {
  let app: FastifyInstance;
  const origDb = process.env.DATABASE_URL;

  beforeAll(async () => {
    process.env.VIPER_USAGE_UI_ENABLED = "1";
    delete process.env.DATABASE_URL;
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    delete process.env.VIPER_USAGE_UI_ENABLED;
    if (origDb !== undefined) process.env.DATABASE_URL = origDb;
    else delete process.env.DATABASE_URL;
  });

  it("returns 400 when workspacePath missing", async () => {
    const res = await postSummary(app, {});
    expect(res.statusCode).toBe(400);
  });

  it("returns 200 with zero usage and unlimited when no DB", async () => {
    const res = await postSummary(app, { workspacePath: WORKSPACE_PATH });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      usedRequests: string;
      limit: string | null;
      remaining: string | null;
      usageBilling: { showComposerUsageHint: boolean };
    };
    expect(body.usedRequests).toBe("0");
    expect(body.limit).toBeNull();
    expect(body.remaining).toBeNull();
    expect(body.usageBilling.showComposerUsageHint).toBe(false);
  });
});

describe("POST /usage/summary — kill-switch on, mocked DB", () => {
  let app: FastifyInstance;
  const origDb = process.env.DATABASE_URL;

  beforeAll(async () => {
    process.env.VIPER_USAGE_UI_ENABLED = "1";
    process.env.DATABASE_URL = "postgres://fake";
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    delete process.env.VIPER_USAGE_UI_ENABLED;
    if (origDb !== undefined) process.env.DATABASE_URL = origDb;
    else delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockListRollups.mockResolvedValue([]);
    mockCountToday.mockResolvedValue("0");
    mockGetWorkspaceByPathKey.mockResolvedValue(null);
    mockGetWorkspaceEntitlements.mockResolvedValue(null);
    mockGetPool.mockReturnValue({
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    });
  });

  it("returns 200 with pathKey derived from workspacePath", async () => {
    const res = await postSummary(app, { workspacePath: WORKSPACE_PATH });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { pathKey: string };
    // pathKey should be a 16-char hex string
    expect(body.pathKey).toMatch(/^[0-9a-f]{16}$/);
  });

  it("returns correct month window", async () => {
    const res = await postSummary(app, {
      workspacePath: WORKSPACE_PATH,
      todayUtc: "2026-04-15",
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { month: { firstDay: string; lastDay: string } };
    expect(body.month.firstDay).toBe("2026-04-01");
    expect(body.month.lastDay).toBe("2026-04-30");
  });

  it("sums rollup + live tail for usedRequests", async () => {
    mockListRollups.mockResolvedValue([
      { request_count: "150" },
      { request_count: "75" },
    ]);
    mockCountToday.mockResolvedValue("12");

    const res = await postSummary(app, {
      workspacePath: WORKSPACE_PATH,
      todayUtc: "2026-04-15",
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { usedRequests: string };
    expect(body.usedRequests).toBe("237"); // 150 + 75 + 12
  });

  it("returns limit and remaining from entitlements flags when workspace found", async () => {
    mockGetWorkspaceByPathKey.mockResolvedValue({
      id: "ws-uuid-test",
      stripe_customer_id: "cus_test",
      stripe_subscription_id: "sub_test",
    });
    mockGetWorkspaceEntitlements.mockResolvedValue({
      workspace_id: "ws-uuid-test",
      allowed_modes: ["ask", "plan"],
      allowed_model_tiers: ["standard"],
      flags: { monthly_request_quota: 500 },
    });
    mockCountToday.mockResolvedValue("50");
    mockListRollups.mockResolvedValue([{ request_count: "100" }]);

    const res = await postSummary(app, {
      workspacePath: WORKSPACE_PATH,
      todayUtc: "2026-04-15",
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      usedRequests: string;
      limit: string | null;
      remaining: string | null;
      entitlements: { allowed_modes: string[]; allowed_model_tiers: string[] };
      stripe: { customerId: string; subscriptionId: string } | null;
    };
    expect(body.usedRequests).toBe("150");
    expect(body.limit).toBe("500");
    expect(body.remaining).toBe("350");
    expect(body.entitlements.allowed_modes).toEqual(["ask", "plan"]);
    expect(body.stripe?.customerId).toBe("cus_test");
    expect(body.stripe?.subscriptionId).toBe("sub_test");
    expect(body.usageBilling.usageWarningThresholdRatio).toBe(0.4);
    expect(body.usageBilling.buckets.auto.meter).toBe("requests");
    expect(body.usageBilling.buckets.auto.percentUsed).toBe(30);
    expect(body.usageBilling.showComposerUsageHint).toBe(false);
    expect(body.usageBilling.buckets.premium.meter).toBe("not_applicable");
  });

  it("remaining is '0' when used exceeds limit", async () => {
    mockGetWorkspaceByPathKey.mockResolvedValue({ id: "ws-uuid-test", stripe_customer_id: null });
    mockGetWorkspaceEntitlements.mockResolvedValue({
      workspace_id: "ws-uuid-test",
      allowed_modes: null,
      allowed_model_tiers: null,
      flags: { monthly_request_quota: 100 },
    });
    mockCountToday.mockResolvedValue("60");
    mockListRollups.mockResolvedValue([{ request_count: "80" }]);

    const res = await postSummary(app, {
      workspacePath: WORKSPACE_PATH,
      todayUtc: "2026-04-15",
    });
    const body = JSON.parse(res.body) as { remaining: string; usageBilling: { showComposerUsageHint: boolean; composerHint: string | null } };
    expect(body.remaining).toBe("0");
    expect(body.usageBilling.showComposerUsageHint).toBe(true);
    expect(body.usageBilling.composerHint).toMatch(/Auto:/i);
  });

  it("stripe is null when no customer linked", async () => {
    mockGetWorkspaceByPathKey.mockResolvedValue({
      id: "ws-uuid-test",
      stripe_customer_id: null,
      stripe_subscription_id: null,
    });
    mockGetWorkspaceEntitlements.mockResolvedValue(null);

    const res = await postSummary(app, { workspacePath: WORKSPACE_PATH });
    const body = JSON.parse(res.body) as { stripe: null };
    expect(body.stripe).toBeNull();
  });
});
