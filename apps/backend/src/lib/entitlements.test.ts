/**
 * F.30 — Unit tests for the entitlement service.
 *
 * Tests:
 *  1. resolvePathKey — matches deriveWorkspaceId for sample paths.
 *  2. extractBearerToken — parses/rejects Authorization headers.
 *  3. mergeEntitlements — D.20 ∩ DB composition rule (pure logic).
 *  4. assertModeAllowed / assertModelTierAllowed — throws correctly.
 *  5. isEntitlementsEnforced — env kill-switch.
 *  6. F.29 repository mock tests for path_key + entitlements repos.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  resolvePathKey,
  extractBearerToken,
  mergeEntitlements,
  assertModeAllowed,
  assertModelTierAllowed,
  isEntitlementsEnforced,
  EntitlementError,
  type ResolvedEntitlements,
} from "./entitlements.service.js";
import { deriveWorkspaceId } from "../types/request-identity.js";
import type { WorkspaceEntitlementRow } from "@repo/database";

// ---------------------------------------------------------------------------
// resolvePathKey — must match deriveWorkspaceId exactly
// ---------------------------------------------------------------------------

describe("resolvePathKey", () => {
  it("matches deriveWorkspaceId for Unix-style paths", () => {
    const path = "/Users/test/my-project";
    expect(resolvePathKey(path)).toBe(deriveWorkspaceId(path));
  });

  it("matches deriveWorkspaceId for paths with trailing slash", () => {
    const path = "/Users/test/my-project/";
    expect(resolvePathKey(path)).toBe(deriveWorkspaceId(path));
  });

  it("returns 16 hex characters", () => {
    const result = resolvePathKey("/some/workspace");
    expect(result).toMatch(/^[0-9a-f]{16}$/);
  });

  it("returns '0'.repeat(16) for empty path", () => {
    expect(resolvePathKey("")).toBe("0".repeat(16));
    expect(resolvePathKey("   ")).not.toBe("0".repeat(16)); // whitespace is NOT empty
  });

  it("is deterministic across calls", () => {
    const p = "/Users/alice/proj";
    expect(resolvePathKey(p)).toBe(resolvePathKey(p));
  });

  it("produces different keys for different paths", () => {
    expect(resolvePathKey("/a/b")).not.toBe(resolvePathKey("/a/c"));
  });
});

// ---------------------------------------------------------------------------
// extractBearerToken
// ---------------------------------------------------------------------------

describe("extractBearerToken", () => {
  it("returns token from valid Bearer header", () => {
    expect(extractBearerToken("Bearer mytoken123")).toBe("mytoken123");
  });

  it("is case-insensitive on 'Bearer' keyword", () => {
    expect(extractBearerToken("bearer abc")).toBe("abc");
    expect(extractBearerToken("BEARER xyz")).toBe("xyz");
  });

  it("returns null for undefined header", () => {
    expect(extractBearerToken(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractBearerToken("")).toBeNull();
  });

  it("returns null for non-Bearer schemes", () => {
    expect(extractBearerToken("Basic dXNlcjpwYXNz")).toBeNull();
    expect(extractBearerToken("ApiKey abc")).toBeNull();
  });

  it("trims whitespace around the token", () => {
    expect(extractBearerToken("Bearer   mytoken  ")).toBe("mytoken");
  });
});

// ---------------------------------------------------------------------------
// isEntitlementsEnforced
// ---------------------------------------------------------------------------

describe("isEntitlementsEnforced", () => {
  const ORIG = process.env["VIPER_ENTITLEMENTS_ENFORCE"];

  afterEach(() => {
    if (ORIG === undefined) delete process.env["VIPER_ENTITLEMENTS_ENFORCE"];
    else process.env["VIPER_ENTITLEMENTS_ENFORCE"] = ORIG;
  });

  it("returns false when unset (default off)", () => {
    delete process.env["VIPER_ENTITLEMENTS_ENFORCE"];
    expect(isEntitlementsEnforced()).toBe(false);
  });

  it("returns false when set to '0'", () => {
    process.env["VIPER_ENTITLEMENTS_ENFORCE"] = "0";
    expect(isEntitlementsEnforced()).toBe(false);
  });

  it("returns true when set to '1'", () => {
    process.env["VIPER_ENTITLEMENTS_ENFORCE"] = "1";
    expect(isEntitlementsEnforced()).toBe(true);
  });

  it("returns true when set to 'true'", () => {
    process.env["VIPER_ENTITLEMENTS_ENFORCE"] = "true";
    expect(isEntitlementsEnforced()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// mergeEntitlements — composition rule: DB ∩ D.20 env
// ---------------------------------------------------------------------------

const ALL_TIERS_SET = new Set(["auto", "premium"] as const);
const mockConfig = { entitledModelTiers: ALL_TIERS_SET };

describe("mergeEntitlements — null planRow (allow-all from DB)", () => {
  it("returns all modes when planRow is null", () => {
    const { allowedModes } = mergeEntitlements(null, mockConfig);
    expect([...allowedModes].sort()).toEqual(["agent", "ask", "debug", "plan"]);
  });

  it("returns all tiers when planRow is null and env allows all", () => {
    const { allowedModelTiers } = mergeEntitlements(null, mockConfig);
    expect([...allowedModelTiers].sort()).toEqual(["auto", "premium"]);
  });

  it("respects D.20 env cap even when planRow is null", () => {
    const restrictedConfig = { entitledModelTiers: new Set(["auto"] as const) };
    const { allowedModelTiers } = mergeEntitlements(null, restrictedConfig);
    expect([...allowedModelTiers].sort()).toEqual(["auto"]);
    expect(allowedModelTiers.has("premium")).toBe(false);
  });
});

describe("mergeEntitlements — planRow restricts modes", () => {
  const readOnlyPlan: WorkspaceEntitlementRow = {
    workspace_id: "ws-uuid",
    allowed_modes: ["ask", "plan"],
    allowed_model_tiers: null,
    flags: {},
    updated_at: "2026-01-01T00:00:00Z",
  };

  it("only allows modes from DB plan", () => {
    const { allowedModes } = mergeEntitlements(readOnlyPlan, mockConfig);
    expect(allowedModes.has("ask")).toBe(true);
    expect(allowedModes.has("plan")).toBe(true);
    expect(allowedModes.has("debug")).toBe(false);
    expect(allowedModes.has("agent")).toBe(false);
  });

  it("allows all tiers when plan specifies null tiers", () => {
    const { allowedModelTiers } = mergeEntitlements(readOnlyPlan, mockConfig);
    expect([...allowedModelTiers].sort()).toEqual(["auto", "premium"]);
  });
});

describe("mergeEntitlements — planRow restricts tiers", () => {
  const freePlan: WorkspaceEntitlementRow = {
    workspace_id: "ws-uuid",
    allowed_modes: null,
    allowed_model_tiers: ["auto", "fast"],
    flags: {},
    updated_at: "2026-01-01T00:00:00Z",
  };

  it("only allows tiers from DB plan (legacy fast maps to auto)", () => {
    const { allowedModelTiers } = mergeEntitlements(freePlan, mockConfig);
    expect(allowedModelTiers.has("auto")).toBe(true);
    expect(allowedModelTiers.has("premium")).toBe(false);
  });

  it("intersection: DB allows premium but env doesn't → premium blocked", () => {
    const envWithoutPremium = { entitledModelTiers: new Set(["auto"] as const) };
    const premiumPlan: WorkspaceEntitlementRow = {
      workspace_id: "ws-uuid",
      allowed_modes: null,
      allowed_model_tiers: ["auto", "premium"],
      flags: {},
      updated_at: "2026-01-01T00:00:00Z",
    };
    const { allowedModelTiers } = mergeEntitlements(premiumPlan, envWithoutPremium);
    expect(allowedModelTiers.has("premium")).toBe(false);
    expect(allowedModelTiers.has("auto")).toBe(true);
  });
});

describe("mergeEntitlements — both restrictions", () => {
  it("applies both mode and tier restrictions from DB plan", () => {
    const strictPlan: WorkspaceEntitlementRow = {
      workspace_id: "ws-uuid",
      allowed_modes: ["ask"],
      allowed_model_tiers: ["fast"],
      flags: { some_flag: true },
      updated_at: "2026-01-01T00:00:00Z",
    };
    const { allowedModes, allowedModelTiers } = mergeEntitlements(strictPlan, mockConfig);
    expect([...allowedModes]).toEqual(["ask"]);
    expect([...allowedModelTiers]).toEqual(["auto"]);
  });
});

// ---------------------------------------------------------------------------
// assertModeAllowed
// ---------------------------------------------------------------------------

describe("assertModeAllowed", () => {
  const resolved: ResolvedEntitlements = {
    workspaceId: "ws-uuid",
    pathKey: "abc123",
    allowedModes: new Set(["ask", "plan"]),
    allowedModelTiers: new Set(["auto"]),
    flags: {},
    userId: "user-uuid",
  };

  it("does not throw when mode is allowed", () => {
    expect(() => assertModeAllowed(resolved, "ask")).not.toThrow();
    expect(() => assertModeAllowed(resolved, "plan")).not.toThrow();
  });

  it("throws EntitlementError 403 when mode is not allowed", () => {
    expect(() => assertModeAllowed(resolved, "debug")).toThrow(EntitlementError);
    expect(() => assertModeAllowed(resolved, "agent")).toThrow(EntitlementError);
    try {
      assertModeAllowed(resolved, "debug");
    } catch (err) {
      expect(err instanceof EntitlementError).toBe(true);
      expect((err as EntitlementError).statusCode).toBe(403);
      expect((err as EntitlementError).message).toMatch(/debug/);
    }
  });

  it("is a no-op when resolved is null (enforcement off)", () => {
    expect(() => assertModeAllowed(null, "agent")).not.toThrow();
    expect(() => assertModeAllowed(null, "debug")).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// assertModelTierAllowed
// ---------------------------------------------------------------------------

describe("assertModelTierAllowed", () => {
  const resolved: ResolvedEntitlements = {
    workspaceId: "ws-uuid",
    pathKey: "abc123",
    allowedModes: new Set(["ask"]),
    allowedModelTiers: new Set(["auto", "premium"]),
    flags: {},
    userId: "user-uuid",
  };

  const autoOnly: ResolvedEntitlements = {
    ...resolved,
    allowedModelTiers: new Set(["auto"]),
  };

  it("does not throw when tier is allowed", () => {
    expect(() => assertModelTierAllowed(resolved, "auto")).not.toThrow();
    expect(() => assertModelTierAllowed(resolved, "premium")).not.toThrow();
  });

  it("throws EntitlementError 403 when tier is not allowed", () => {
    expect(() => assertModelTierAllowed(autoOnly, "premium")).toThrow(EntitlementError);
    try {
      assertModelTierAllowed(autoOnly, "premium");
    } catch (err) {
      expect((err as EntitlementError).statusCode).toBe(403);
      expect((err as EntitlementError).message).toMatch(/premium/);
    }
  });

  it("is a no-op when resolved is null (enforcement off)", () => {
    expect(() => assertModelTierAllowed(null, "premium")).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// F.29 database repository tests for new path_key / entitlements repos
// (mock Pool, same pattern as packages/database tests)
// ---------------------------------------------------------------------------

import type { Pool } from "pg";

function makePool(rows: unknown[], rowCount?: number): Pool {
  return {
    query: vi.fn().mockResolvedValue({ rows, rowCount: rowCount ?? rows.length }),
  } as unknown as Pool;
}

function makeUniqueViolationPool(): Pool {
  const err = Object.assign(new Error("duplicate key"), { code: "23505" });
  return { query: vi.fn().mockRejectedValue(err) } as unknown as Pool;
}

import {
  getWorkspaceByPathKey,
  upsertWorkspaceByPathKey,
  upsertWorkspaceEntitlements,
  getWorkspaceEntitlements,
  deleteWorkspaceEntitlements,
} from "@repo/database";

const WS_ROW = {
  id: "ws-uuid-1",
  name: "Test WS",
  slug: null,
  path_key: "abc1234567890def",
  created_by_user_id: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const ENT_ROW: WorkspaceEntitlementRow = {
  workspace_id: "ws-uuid-1",
  allowed_modes: ["ask", "plan"],
  allowed_model_tiers: ["auto"],
  flags: { beta: true },
  updated_at: "2026-01-01T00:00:00Z",
};

describe("getWorkspaceByPathKey", () => {
  it("returns workspace when path_key matches", async () => {
    const pool = makePool([WS_ROW]);
    const result = await getWorkspaceByPathKey(pool, WS_ROW.path_key!);
    expect(result).toEqual(WS_ROW);
    const call0 = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const [sql, params] = call0;
    expect(sql).toMatch(/WHERE path_key = /i);
    expect(params[0]).toBe(WS_ROW.path_key);
  });

  it("returns null when not found", async () => {
    const pool = makePool([]);
    expect(await getWorkspaceByPathKey(pool, "notfound")).toBeNull();
  });
});

describe("upsertWorkspaceByPathKey", () => {
  it("returns workspace row on insert", async () => {
    const pool = makePool([WS_ROW]);
    const result = await upsertWorkspaceByPathKey(pool, WS_ROW.path_key!);
    expect(result).toEqual(WS_ROW);
    const call0a = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const [sql, params] = call0a;
    expect(sql).toMatch(/ON CONFLICT.*DO UPDATE/is);
    expect(params[1]).toBe(WS_ROW.path_key);
  });

  it("uses custom name when provided", async () => {
    const pool = makePool([WS_ROW]);
    await upsertWorkspaceByPathKey(pool, WS_ROW.path_key!, "My Custom Workspace");
    const call0b = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const [, params] = call0b;
    expect(params[0]).toBe("My Custom Workspace");
  });

  it("falls back to path_key as name when not provided", async () => {
    const pool = makePool([WS_ROW]);
    await upsertWorkspaceByPathKey(pool, WS_ROW.path_key!);
    const call0c = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const [, paramsC] = call0c;
    expect(paramsC[0]).toBe(WS_ROW.path_key);
  });
});

describe("upsertWorkspaceEntitlements", () => {
  it("returns entitlement row on upsert", async () => {
    const pool = makePool([ENT_ROW]);
    const result = await upsertWorkspaceEntitlements(pool, {
      workspace_id: "ws-uuid-1",
      allowed_modes: ["ask", "plan"],
      allowed_model_tiers: ["auto"],
      flags: { beta: true },
    });
    expect(result).toEqual(ENT_ROW);
    const call0e = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const [sql] = call0e;
    expect(sql).toMatch(/ON CONFLICT.*DO UPDATE/is);
  });

  it("sets null for omitted allowed_modes", async () => {
    const pool = makePool([{ ...ENT_ROW, allowed_modes: null }]);
    await upsertWorkspaceEntitlements(pool, { workspace_id: "ws-uuid-1" });
    const call0f = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const [, params] = call0f;
    expect(params[1]).toBeNull();
  });
});

describe("getWorkspaceEntitlements", () => {
  it("returns row when found", async () => {
    const pool = makePool([ENT_ROW]);
    expect(await getWorkspaceEntitlements(pool, "ws-uuid-1")).toEqual(ENT_ROW);
  });

  it("returns null when not found (allow-all fallback)", async () => {
    const pool = makePool([]);
    expect(await getWorkspaceEntitlements(pool, "nonexistent")).toBeNull();
  });
});

describe("deleteWorkspaceEntitlements", () => {
  it("returns true when deleted", async () => {
    const pool = makePool([], 1);
    expect(await deleteWorkspaceEntitlements(pool, "ws-uuid-1")).toBe(true);
  });

  it("returns false when not found", async () => {
    const pool = makePool([], 0);
    expect(await deleteWorkspaceEntitlements(pool, "nonexistent")).toBe(false);
  });
});
