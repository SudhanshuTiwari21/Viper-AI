/**
 * F.33 — Unit tests for quota.service.ts.
 *
 * Tests:
 *  1. isQuotaEnforced() — env kill-switch.
 *  2. getDefaultMonthlyQuota() — env parsing.
 *  3. parseQuotaConfig() — flag parsing, defaults, BigInt coercion.
 *  4. currentUtcMonthWindow() — month boundary calculation.
 *  5. computeMonthlyUsage() — rollup + today live-tail BigInt arithmetic.
 *  6. checkMonthlyQuota() — enforcement off → no DB; unlimited → no DB;
 *                           hard deny → QuotaError(429);
 *                           soft warn → workflowLog but no throw;
 *                           below threshold → no log.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockListRollups, mockCountToday, mockGetPool, mockGetWorkspaceByPathKey, mockGetWorkspaceEntitlements } =
  vi.hoisted(() => ({
    mockListRollups: vi.fn(),
    mockCountToday: vi.fn(),
    mockGetPool: vi.fn().mockReturnValue({}),
    mockGetWorkspaceByPathKey: vi.fn(),
    mockGetWorkspaceEntitlements: vi.fn(),
  }));

vi.mock("@repo/database", () => ({
  getPool: mockGetPool,
  listRollupsForWorkspace: mockListRollups,
  countUsageEventsForDay: mockCountToday,
  getWorkspaceByPathKey: mockGetWorkspaceByPathKey,
  getWorkspaceEntitlements: mockGetWorkspaceEntitlements,
}));

const { mockWorkflowLog } = vi.hoisted(() => ({ mockWorkflowLog: vi.fn() }));
vi.mock("../services/assistant.service.js", () => ({
  workflowLog: mockWorkflowLog,
}));

import {
  isQuotaEnforced,
  getDefaultMonthlyQuota,
  parseQuotaConfig,
  currentUtcMonthWindow,
  computeMonthlyUsage,
  checkMonthlyQuota,
  QuotaError,
} from "./quota.service.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const IDENTITY = {
  request_id: "req-1",
  workspace_id: "abc1234567890def",
  conversation_id: null,
};

// ---------------------------------------------------------------------------
// isQuotaEnforced
// ---------------------------------------------------------------------------

describe("isQuotaEnforced", () => {
  const ORIG = process.env["VIPER_QUOTA_ENFORCE"];
  afterEach(() => {
    if (ORIG === undefined) delete process.env["VIPER_QUOTA_ENFORCE"];
    else process.env["VIPER_QUOTA_ENFORCE"] = ORIG;
  });

  it("returns false when unset (default off)", () => {
    delete process.env["VIPER_QUOTA_ENFORCE"];
    expect(isQuotaEnforced()).toBe(false);
  });

  it("returns false for '0'", () => {
    process.env["VIPER_QUOTA_ENFORCE"] = "0";
    expect(isQuotaEnforced()).toBe(false);
  });

  it("returns true for '1'", () => {
    process.env["VIPER_QUOTA_ENFORCE"] = "1";
    expect(isQuotaEnforced()).toBe(true);
  });

  it("returns true for 'true'", () => {
    process.env["VIPER_QUOTA_ENFORCE"] = "true";
    expect(isQuotaEnforced()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getDefaultMonthlyQuota
// ---------------------------------------------------------------------------

describe("getDefaultMonthlyQuota", () => {
  const ORIG = process.env["VIPER_QUOTA_DEFAULT_MONTHLY_REQUESTS"];
  afterEach(() => {
    if (ORIG === undefined) delete process.env["VIPER_QUOTA_DEFAULT_MONTHLY_REQUESTS"];
    else process.env["VIPER_QUOTA_DEFAULT_MONTHLY_REQUESTS"] = ORIG;
  });

  it("returns null when unset", () => {
    delete process.env["VIPER_QUOTA_DEFAULT_MONTHLY_REQUESTS"];
    expect(getDefaultMonthlyQuota()).toBeNull();
  });

  it("returns null for empty string", () => {
    process.env["VIPER_QUOTA_DEFAULT_MONTHLY_REQUESTS"] = "";
    expect(getDefaultMonthlyQuota()).toBeNull();
  });

  it("returns BigInt for positive integer", () => {
    process.env["VIPER_QUOTA_DEFAULT_MONTHLY_REQUESTS"] = "1000";
    expect(getDefaultMonthlyQuota()).toBe(1000n);
  });

  it("returns null for negative value", () => {
    process.env["VIPER_QUOTA_DEFAULT_MONTHLY_REQUESTS"] = "-5";
    expect(getDefaultMonthlyQuota()).toBeNull();
  });

  it("returns null for non-numeric string", () => {
    process.env["VIPER_QUOTA_DEFAULT_MONTHLY_REQUESTS"] = "unlimited";
    expect(getDefaultMonthlyQuota()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseQuotaConfig
// ---------------------------------------------------------------------------

describe("parseQuotaConfig", () => {
  const ORIG = process.env["VIPER_QUOTA_DEFAULT_MONTHLY_REQUESTS"];
  afterEach(() => {
    if (ORIG === undefined) delete process.env["VIPER_QUOTA_DEFAULT_MONTHLY_REQUESTS"];
    else process.env["VIPER_QUOTA_DEFAULT_MONTHLY_REQUESTS"] = ORIG;
  });

  it("returns null limit when no flag and no env default", () => {
    delete process.env["VIPER_QUOTA_DEFAULT_MONTHLY_REQUESTS"];
    const { monthlyRequestQuota } = parseQuotaConfig({});
    expect(monthlyRequestQuota).toBeNull();
  });

  it("parses monthly_request_quota flag as BigInt", () => {
    const { monthlyRequestQuota } = parseQuotaConfig({ monthly_request_quota: 500 });
    expect(monthlyRequestQuota).toBe(500n);
  });

  it("flag takes precedence over env default", () => {
    process.env["VIPER_QUOTA_DEFAULT_MONTHLY_REQUESTS"] = "9999";
    const { monthlyRequestQuota } = parseQuotaConfig({ monthly_request_quota: 100 });
    expect(monthlyRequestQuota).toBe(100n);
  });

  it("falls back to env default when no flag", () => {
    process.env["VIPER_QUOTA_DEFAULT_MONTHLY_REQUESTS"] = "250";
    const { monthlyRequestQuota } = parseQuotaConfig({});
    expect(monthlyRequestQuota).toBe(250n);
  });

  it("ignores non-positive flag values", () => {
    delete process.env["VIPER_QUOTA_DEFAULT_MONTHLY_REQUESTS"];
    const { monthlyRequestQuota } = parseQuotaConfig({ monthly_request_quota: 0 });
    expect(monthlyRequestQuota).toBeNull();
  });

  it("defaults softThresholdRatio to 0.8 when absent", () => {
    const { softThresholdRatio } = parseQuotaConfig({});
    expect(softThresholdRatio).toBe(0.8);
  });

  it("parses quota_soft_threshold_ratio", () => {
    const { softThresholdRatio } = parseQuotaConfig({ quota_soft_threshold_ratio: 0.9 });
    expect(softThresholdRatio).toBe(0.9);
  });

  it("ignores invalid ratio (out of range)", () => {
    const { softThresholdRatio } = parseQuotaConfig({ quota_soft_threshold_ratio: 1.5 });
    expect(softThresholdRatio).toBe(0.8);
  });
});

// ---------------------------------------------------------------------------
// currentUtcMonthWindow
// ---------------------------------------------------------------------------

describe("currentUtcMonthWindow", () => {
  it("returns correct window for mid-month", () => {
    const { firstDay, lastDay } = currentUtcMonthWindow("2026-04-15");
    expect(firstDay).toBe("2026-04-01");
    expect(lastDay).toBe("2026-04-30");
  });

  it("returns correct window for January (31 days)", () => {
    const { firstDay, lastDay } = currentUtcMonthWindow("2026-01-10");
    expect(firstDay).toBe("2026-01-01");
    expect(lastDay).toBe("2026-01-31");
  });

  it("returns correct window for February in non-leap year", () => {
    const { firstDay, lastDay } = currentUtcMonthWindow("2026-02-14");
    expect(firstDay).toBe("2026-02-01");
    expect(lastDay).toBe("2026-02-28");
  });

  it("returns correct window for February in leap year", () => {
    const { firstDay, lastDay } = currentUtcMonthWindow("2024-02-10");
    expect(firstDay).toBe("2024-02-01");
    expect(lastDay).toBe("2024-02-29");
  });

  it("handles December → January boundary", () => {
    const { firstDay, lastDay } = currentUtcMonthWindow("2026-12-25");
    expect(firstDay).toBe("2026-12-01");
    expect(lastDay).toBe("2026-12-31");
  });
});

// ---------------------------------------------------------------------------
// computeMonthlyUsage
// ---------------------------------------------------------------------------

describe("computeMonthlyUsage", () => {
  beforeEach(() => {
    mockListRollups.mockReset();
    mockCountToday.mockReset();
  });

  it("sums rollup request_count strings + today count as BigInt", async () => {
    mockListRollups.mockResolvedValue([
      { request_count: "100" },
      { request_count: "50" },
      { request_count: "25" },
    ]);
    mockCountToday.mockResolvedValue("15");
    const total = await computeMonthlyUsage("key1", "2026-04-15");
    expect(total).toBe(190n); // 100+50+25+15
  });

  it("returns today count only when first day of month (no rollup days before today)", async () => {
    mockCountToday.mockResolvedValue("7");
    // When today IS the first of the month, firstDay > yesterday so rollup query is skipped.
    const total = await computeMonthlyUsage("key1", "2026-04-01");
    expect(total).toBe(7n);
    expect(mockListRollups).not.toHaveBeenCalled();
  });

  it("handles empty rollups (treat missing days as 0)", async () => {
    mockListRollups.mockResolvedValue([]);
    mockCountToday.mockResolvedValue("3");
    const total = await computeMonthlyUsage("key1", "2026-04-10");
    expect(total).toBe(3n);
  });

  it("handles large numbers safely with BigInt", async () => {
    mockListRollups.mockResolvedValue([
      { request_count: "999999999" },
      { request_count: "999999998" },
    ]);
    mockCountToday.mockResolvedValue("1000000000");
    const total = await computeMonthlyUsage("key1", "2026-04-15");
    expect(total).toBe(2999999997n);
  });
});

// ---------------------------------------------------------------------------
// checkMonthlyQuota
// ---------------------------------------------------------------------------

describe("checkMonthlyQuota — enforcement off", () => {
  const ORIG = process.env["VIPER_QUOTA_ENFORCE"];
  beforeEach(() => {
    delete process.env["VIPER_QUOTA_ENFORCE"];
    mockListRollups.mockReset();
    mockCountToday.mockReset();
    mockWorkflowLog.mockClear();
  });
  afterEach(() => {
    if (ORIG === undefined) delete process.env["VIPER_QUOTA_ENFORCE"];
    else process.env["VIPER_QUOTA_ENFORCE"] = ORIG;
  });

  it("does not call DB and does not throw when enforcement is off", async () => {
    await checkMonthlyQuota("key", null, IDENTITY);
    expect(mockListRollups).not.toHaveBeenCalled();
    expect(mockCountToday).not.toHaveBeenCalled();
  });
});

describe("checkMonthlyQuota — unlimited (no limit configured)", () => {
  const ORIG_ENFORCE = process.env["VIPER_QUOTA_ENFORCE"];
  const ORIG_DEFAULT = process.env["VIPER_QUOTA_DEFAULT_MONTHLY_REQUESTS"];

  beforeEach(() => {
    process.env["VIPER_QUOTA_ENFORCE"] = "1";
    delete process.env["VIPER_QUOTA_DEFAULT_MONTHLY_REQUESTS"];
    mockListRollups.mockReset();
    mockCountToday.mockReset();
    mockWorkflowLog.mockClear();
  });
  afterEach(() => {
    if (ORIG_ENFORCE === undefined) delete process.env["VIPER_QUOTA_ENFORCE"];
    else process.env["VIPER_QUOTA_ENFORCE"] = ORIG_ENFORCE;
    if (ORIG_DEFAULT === undefined) delete process.env["VIPER_QUOTA_DEFAULT_MONTHLY_REQUESTS"];
    else process.env["VIPER_QUOTA_DEFAULT_MONTHLY_REQUESTS"] = ORIG_DEFAULT;
  });

  it("does not query DB when flags have no quota and no env default", async () => {
    // entitlements with no flags → unlimited
    const entitlements = {
      workspaceId: "ws-1",
      pathKey: "abc1234567890def",
      allowedModes: new Set(["agent"] as const),
      allowedModelTiers: new Set(["auto"] as const),
      flags: {},
      userId: null,
    };
    await checkMonthlyQuota("key", entitlements, IDENTITY);
    expect(mockListRollups).not.toHaveBeenCalled();
    expect(mockCountToday).not.toHaveBeenCalled();
  });
});

describe("checkMonthlyQuota — hard deny (429)", () => {
  const ORIG_ENFORCE = process.env["VIPER_QUOTA_ENFORCE"];
  const ORIG_DEFAULT = process.env["VIPER_QUOTA_DEFAULT_MONTHLY_REQUESTS"];

  beforeEach(() => {
    process.env["VIPER_QUOTA_ENFORCE"] = "1";
    process.env["VIPER_QUOTA_DEFAULT_MONTHLY_REQUESTS"] = "100";
    mockListRollups.mockReset();
    mockCountToday.mockReset();
    mockWorkflowLog.mockClear();
  });
  afterEach(() => {
    if (ORIG_ENFORCE === undefined) delete process.env["VIPER_QUOTA_ENFORCE"];
    else process.env["VIPER_QUOTA_ENFORCE"] = ORIG_ENFORCE;
    if (ORIG_DEFAULT === undefined) delete process.env["VIPER_QUOTA_DEFAULT_MONTHLY_REQUESTS"];
    else process.env["VIPER_QUOTA_DEFAULT_MONTHLY_REQUESTS"] = ORIG_DEFAULT;
  });

  it("throws QuotaError(429) when used >= limit", async () => {
    mockListRollups.mockResolvedValue([{ request_count: "90" }]);
    mockCountToday.mockResolvedValue("10"); // 100 total = at limit
    const entitlements = {
      workspaceId: "ws-1",
      pathKey: "abc1234567890def",
      allowedModes: new Set(["agent"] as const),
      allowedModelTiers: new Set(["auto"] as const),
      flags: { monthly_request_quota: 100 },
      userId: null,
    };
    await expect(
      checkMonthlyQuota("key", entitlements, IDENTITY, "2026-04-15"),
    ).rejects.toThrow(QuotaError);
  });

  it("QuotaError.statusCode is 429", async () => {
    mockListRollups.mockResolvedValue([{ request_count: "101" }]);
    mockCountToday.mockResolvedValue("0");
    const entitlements = {
      workspaceId: "ws-1",
      pathKey: "abc1234567890def",
      allowedModes: new Set(["agent"] as const),
      allowedModelTiers: new Set(["auto"] as const),
      flags: { monthly_request_quota: 100 },
      userId: null,
    };
    try {
      await checkMonthlyQuota("key", entitlements, IDENTITY, "2026-04-15");
      expect.fail("should have thrown");
    } catch (err) {
      expect(err instanceof QuotaError).toBe(true);
      expect((err as QuotaError).statusCode).toBe(429);
      expect((err as QuotaError).quota.status).toBe("exceeded");
      expect((err as QuotaError).quota.remaining).toBe("0");
    }
  });

  it("emits workflowLog('quota:check', ...) on hard deny", async () => {
    mockListRollups.mockResolvedValue([{ request_count: "200" }]);
    mockCountToday.mockResolvedValue("0");
    const entitlements = {
      workspaceId: "ws-1",
      pathKey: "key",
      allowedModes: new Set(["agent"] as const),
      allowedModelTiers: new Set(["auto"] as const),
      flags: { monthly_request_quota: 100 },
      userId: null,
    };
    try {
      await checkMonthlyQuota("key", entitlements, IDENTITY, "2026-04-15");
    } catch {
      // expected
    }
    expect(mockWorkflowLog).toHaveBeenCalledWith(
      "quota:check",
      IDENTITY,
      expect.objectContaining({ status: "exceeded" }),
    );
  });
});

describe("checkMonthlyQuota — soft warning", () => {
  const ORIG_ENFORCE = process.env["VIPER_QUOTA_ENFORCE"];

  beforeEach(() => {
    process.env["VIPER_QUOTA_ENFORCE"] = "1";
    mockListRollups.mockReset();
    mockCountToday.mockReset();
    mockWorkflowLog.mockClear();
  });
  afterEach(() => {
    if (ORIG_ENFORCE === undefined) delete process.env["VIPER_QUOTA_ENFORCE"];
    else process.env["VIPER_QUOTA_ENFORCE"] = ORIG_ENFORCE;
  });

  it("allows request but emits workflowLog when at soft threshold (80% default)", async () => {
    // limit=100, used=80 → at 80% threshold
    mockListRollups.mockResolvedValue([{ request_count: "70" }]);
    mockCountToday.mockResolvedValue("10"); // 80 total
    const entitlements = {
      workspaceId: "ws-1",
      pathKey: "key",
      allowedModes: new Set(["agent"] as const),
      allowedModelTiers: new Set(["auto"] as const),
      flags: { monthly_request_quota: 100 },
      userId: null,
    };
    await expect(
      checkMonthlyQuota("key", entitlements, IDENTITY, "2026-04-15"),
    ).resolves.toBeUndefined(); // does not throw

    expect(mockWorkflowLog).toHaveBeenCalledWith(
      "quota:check",
      IDENTITY,
      expect.objectContaining({ status: "soft_warning" }),
    );
  });

  it("does NOT emit log when well below threshold", async () => {
    // limit=100, used=10 → well below 80%
    mockListRollups.mockResolvedValue([{ request_count: "5" }]);
    mockCountToday.mockResolvedValue("5");
    const entitlements = {
      workspaceId: "ws-1",
      pathKey: "key",
      allowedModes: new Set(["agent"] as const),
      allowedModelTiers: new Set(["auto"] as const),
      flags: { monthly_request_quota: 100 },
      userId: null,
    };
    await checkMonthlyQuota("key", entitlements, IDENTITY, "2026-04-15");
    expect(mockWorkflowLog).not.toHaveBeenCalled();
  });
});
