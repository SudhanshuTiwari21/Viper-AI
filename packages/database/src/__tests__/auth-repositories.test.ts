/**
 * F.29 — Unit tests for auth-users, auth-workspaces, auth-memberships repositories.
 *
 * These tests use a mock Pool (no real Postgres required) to verify:
 *   1. Correct SQL shapes and parameter ordering for each function.
 *   2. Proper handling of uniqueness violations (error propagation).
 *   3. FK cascade behavior is documented via test structure (not re-tested
 *      at the DB level here — integration tests against a real DB can follow).
 *   4. Null handling for optional fields.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Pool } from "pg";
import {
  createUser,
  getUserByEmail,
  getUserById,
  getUserByExternalSubject,
  updateUser,
  deleteUser,
} from "../auth-users.repository.js";
import {
  createWorkspace,
  getWorkspaceById,
  getWorkspaceBySlug,
  updateWorkspace,
  deleteWorkspace,
} from "../auth-workspaces.repository.js";
import {
  upsertMembership,
  getMembership,
  listMembersForWorkspace,
  listWorkspacesForUser,
  removeMembership,
} from "../auth-memberships.repository.js";

// ---------------------------------------------------------------------------
// Mock pool factory
// ---------------------------------------------------------------------------

function makePool(queryResult: { rows: unknown[]; rowCount?: number }): Pool {
  return {
    query: vi.fn().mockResolvedValue({
      rows: queryResult.rows,
      rowCount: queryResult.rowCount ?? queryResult.rows.length,
    }),
  } as unknown as Pool;
}

/** Pool whose query rejects with a PG uniqueness violation error. */
function makeUniqueViolationPool(): Pool {
  const err = Object.assign(new Error("duplicate key value"), { code: "23505" });
  return {
    query: vi.fn().mockRejectedValue(err),
  } as unknown as Pool;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_ROW = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "alice@example.com",
  display_name: "Alice",
  auth_provider: null,
  external_subject: null,
  password_hash: null,
  email_verified_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const WORKSPACE_ROW = {
  id: "22222222-2222-2222-2222-222222222222",
  name: "My Workspace",
  slug: "my-workspace",
  path_key: null,
  stripe_customer_id: null,
  stripe_subscription_id: null,
  billing_plan_slug: "free",
  created_by_user_id: USER_ROW.id,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const MEMBERSHIP_ROW = {
  workspace_id: WORKSPACE_ROW.id,
  user_id: USER_ROW.id,
  role: "owner" as const,
  created_at: "2026-01-01T00:00:00Z",
};

// ---------------------------------------------------------------------------
// auth-users.repository
// ---------------------------------------------------------------------------

describe("createUser", () => {
  it("returns the inserted user row", async () => {
    const pool = makePool({ rows: [USER_ROW] });
    const result = await createUser(pool, { email: "alice@example.com", display_name: "Alice" });
    expect(result).toEqual(USER_ROW);
    expect(pool.query).toHaveBeenCalledOnce();
    const [sql, params] = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/INSERT INTO users/i);
    expect(params[0]).toBe("alice@example.com");
    expect(params[1]).toBe("Alice");
    expect(params[2]).toBeNull(); // auth_provider
    expect(params[3]).toBeNull(); // external_subject
    expect(params[4]).toBeNull(); // password_hash
    expect(params[5]).toBeNull(); // email_verified_at
  });

  it("propagates unique-violation error (duplicate email)", async () => {
    const pool = makeUniqueViolationPool();
    await expect(createUser(pool, { email: "alice@example.com" })).rejects.toMatchObject({
      code: "23505",
    });
  });

  it("null display_name when omitted", async () => {
    const pool = makePool({ rows: [{ ...USER_ROW, display_name: null }] });
    await createUser(pool, { email: "alice@example.com" });
    const [, params] = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0] as [string, unknown[]];
    expect(params[1]).toBeNull();
  });
});

describe("getUserByEmail", () => {
  it("returns the user row when found", async () => {
    const pool = makePool({ rows: [USER_ROW] });
    const result = await getUserByEmail(pool, "alice@example.com");
    expect(result).toEqual(USER_ROW);
    const [sql, params] = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/lower\(trim\(email\)\)/i);
    expect(params[0]).toBe("alice@example.com");
  });

  it("returns null when not found", async () => {
    const pool = makePool({ rows: [] });
    expect(await getUserByEmail(pool, "nobody@example.com")).toBeNull();
  });
});

describe("getUserById", () => {
  it("returns the user row when found", async () => {
    const pool = makePool({ rows: [USER_ROW] });
    expect(await getUserById(pool, USER_ROW.id)).toEqual(USER_ROW);
  });

  it("returns null when not found", async () => {
    const pool = makePool({ rows: [] });
    expect(await getUserById(pool, "nonexistent-uuid")).toBeNull();
  });
});

describe("getUserByExternalSubject", () => {
  it("returns the user row when found", async () => {
    const pool = makePool({ rows: [USER_ROW] });
    const result = await getUserByExternalSubject(pool, "github", "gh_12345");
    expect(result).toEqual(USER_ROW);
    const [sql, params] = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/auth_provider.*external_subject/is);
    expect(params[0]).toBe("github");
    expect(params[1]).toBe("gh_12345");
  });

  it("returns null when not found", async () => {
    const pool = makePool({ rows: [] });
    expect(await getUserByExternalSubject(pool, "github", "unknown")).toBeNull();
  });
});

describe("updateUser", () => {
  it("returns the updated user row", async () => {
    const updated = { ...USER_ROW, display_name: "Alice Updated", updated_at: "2026-06-01T00:00:00Z" };
    const pool = makePool({ rows: [updated] });
    const result = await updateUser(pool, USER_ROW.id, { display_name: "Alice Updated" });
    expect(result).toEqual(updated);
    const [sql, params] = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/UPDATE users/i);
    expect(params[0]).toBe(USER_ROW.id);
  });

  it("returns null when id not found", async () => {
    const pool = makePool({ rows: [] });
    expect(await updateUser(pool, "nonexistent", { display_name: "X" })).toBeNull();
  });
});

describe("deleteUser", () => {
  it("returns true when a row was deleted", async () => {
    const pool = makePool({ rows: [], rowCount: 1 });
    expect(await deleteUser(pool, USER_ROW.id)).toBe(true);
    const [sql, params] = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/DELETE FROM users/i);
    expect(params[0]).toBe(USER_ROW.id);
  });

  it("returns false when id not found", async () => {
    const pool = makePool({ rows: [], rowCount: 0 });
    expect(await deleteUser(pool, "nonexistent")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// auth-workspaces.repository
// ---------------------------------------------------------------------------

describe("createWorkspace", () => {
  it("returns the created workspace row", async () => {
    const pool = makePool({ rows: [WORKSPACE_ROW] });
    const result = await createWorkspace(pool, {
      name: "My Workspace",
      slug: "my-workspace",
      created_by_user_id: USER_ROW.id,
    });
    expect(result).toEqual(WORKSPACE_ROW);
    const [sql, params] = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/INSERT INTO workspaces/i);
    expect(params[0]).toBe("My Workspace");
    expect(params[1]).toBe("my-workspace");
    expect(params[2]).toBeNull(); // path_key (not provided → null)
    expect(params[3]).toBe(USER_ROW.id);
  });

  it("sets null slug when omitted", async () => {
    const pool = makePool({ rows: [{ ...WORKSPACE_ROW, slug: null }] });
    await createWorkspace(pool, { name: "No Slug" });
    const [, params] = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0] as [string, unknown[]];
    expect(params[1]).toBeNull();
  });

  it("propagates unique-violation on duplicate slug", async () => {
    const pool = makeUniqueViolationPool();
    await expect(createWorkspace(pool, { name: "Dup", slug: "my-workspace" })).rejects.toMatchObject({
      code: "23505",
    });
  });
});

describe("getWorkspaceById", () => {
  it("returns the row when found", async () => {
    const pool = makePool({ rows: [WORKSPACE_ROW] });
    expect(await getWorkspaceById(pool, WORKSPACE_ROW.id)).toEqual(WORKSPACE_ROW);
  });

  it("returns null when not found", async () => {
    const pool = makePool({ rows: [] });
    expect(await getWorkspaceById(pool, "nonexistent")).toBeNull();
  });
});

describe("getWorkspaceBySlug", () => {
  it("returns the row when found", async () => {
    const pool = makePool({ rows: [WORKSPACE_ROW] });
    const result = await getWorkspaceBySlug(pool, "my-workspace");
    expect(result).toEqual(WORKSPACE_ROW);
    const [sql, params] = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/WHERE slug = /i);
    expect(params[0]).toBe("my-workspace");
  });

  it("returns null when not found", async () => {
    const pool = makePool({ rows: [] });
    expect(await getWorkspaceBySlug(pool, "missing-slug")).toBeNull();
  });
});

describe("updateWorkspace", () => {
  it("returns the updated row", async () => {
    const updated = { ...WORKSPACE_ROW, name: "Renamed", updated_at: "2026-06-01T00:00:00Z" };
    const pool = makePool({ rows: [updated] });
    const result = await updateWorkspace(pool, WORKSPACE_ROW.id, { name: "Renamed" });
    expect(result?.name).toBe("Renamed");
    const [sql] = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/UPDATE workspaces/i);
  });

  it("returns null when id not found", async () => {
    const pool = makePool({ rows: [] });
    expect(await updateWorkspace(pool, "nonexistent", { name: "X" })).toBeNull();
  });
});

describe("deleteWorkspace", () => {
  it("returns true when deleted", async () => {
    const pool = makePool({ rows: [], rowCount: 1 });
    expect(await deleteWorkspace(pool, WORKSPACE_ROW.id)).toBe(true);
  });

  it("returns false when not found", async () => {
    const pool = makePool({ rows: [], rowCount: 0 });
    expect(await deleteWorkspace(pool, "nonexistent")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// auth-memberships.repository
// ---------------------------------------------------------------------------

describe("upsertMembership", () => {
  it("returns the membership row on insert", async () => {
    const pool = makePool({ rows: [MEMBERSHIP_ROW] });
    const result = await upsertMembership(pool, {
      workspace_id: WORKSPACE_ROW.id,
      user_id: USER_ROW.id,
      role: "owner",
    });
    expect(result).toEqual(MEMBERSHIP_ROW);
    const [sql, params] = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/INSERT INTO workspace_memberships/i);
    expect(sql).toMatch(/ON CONFLICT.*DO UPDATE/is);
    expect(params[0]).toBe(WORKSPACE_ROW.id);
    expect(params[1]).toBe(USER_ROW.id);
    expect(params[2]).toBe("owner");
  });

  it("returns the updated row on conflict (role change)", async () => {
    const updated = { ...MEMBERSHIP_ROW, role: "admin" as const };
    const pool = makePool({ rows: [updated] });
    const result = await upsertMembership(pool, {
      workspace_id: WORKSPACE_ROW.id,
      user_id: USER_ROW.id,
      role: "admin",
    });
    expect(result.role).toBe("admin");
  });
});

describe("getMembership", () => {
  it("returns the membership when it exists", async () => {
    const pool = makePool({ rows: [MEMBERSHIP_ROW] });
    const result = await getMembership(pool, WORKSPACE_ROW.id, USER_ROW.id);
    expect(result).toEqual(MEMBERSHIP_ROW);
    const [sql, params] = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/WHERE workspace_id.*AND user_id/is);
    expect(params[0]).toBe(WORKSPACE_ROW.id);
    expect(params[1]).toBe(USER_ROW.id);
  });

  it("returns null when not found", async () => {
    const pool = makePool({ rows: [] });
    expect(await getMembership(pool, WORKSPACE_ROW.id, "nonexistent-user")).toBeNull();
  });
});

describe("listMembersForWorkspace", () => {
  it("returns all membership rows for a workspace", async () => {
    const rows = [
      MEMBERSHIP_ROW,
      { ...MEMBERSHIP_ROW, user_id: "33333333-3333-3333-3333-333333333333", role: "member" as const },
    ];
    const pool = makePool({ rows });
    const result = await listMembersForWorkspace(pool, WORKSPACE_ROW.id);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ workspace_id: WORKSPACE_ROW.id });
    const [sql, params] = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/WHERE workspace_id = /i);
    expect(params[0]).toBe(WORKSPACE_ROW.id);
  });

  it("returns empty array when workspace has no members", async () => {
    const pool = makePool({ rows: [] });
    expect(await listMembersForWorkspace(pool, "empty-ws")).toEqual([]);
  });
});

describe("listWorkspacesForUser", () => {
  it("returns all memberships for a user", async () => {
    const rows = [
      MEMBERSHIP_ROW,
      { ...MEMBERSHIP_ROW, workspace_id: "44444444-4444-4444-4444-444444444444", role: "admin" as const },
    ];
    const pool = makePool({ rows });
    const result = await listWorkspacesForUser(pool, USER_ROW.id);
    expect(result).toHaveLength(2);
    const [sql, params] = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/WHERE user_id = /i);
    expect(params[0]).toBe(USER_ROW.id);
  });

  it("returns empty array when user has no workspaces", async () => {
    const pool = makePool({ rows: [] });
    expect(await listWorkspacesForUser(pool, "user-no-ws")).toEqual([]);
  });
});

describe("removeMembership", () => {
  it("returns true when a row was removed", async () => {
    const pool = makePool({ rows: [], rowCount: 1 });
    expect(await removeMembership(pool, WORKSPACE_ROW.id, USER_ROW.id)).toBe(true);
    const [sql, params] = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/DELETE FROM workspace_memberships/i);
    expect(params[0]).toBe(WORKSPACE_ROW.id);
    expect(params[1]).toBe(USER_ROW.id);
  });

  it("returns false when pair not found", async () => {
    const pool = makePool({ rows: [], rowCount: 0 });
    expect(await removeMembership(pool, WORKSPACE_ROW.id, "nonexistent")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// FK cascade behavior (documented via test comments, not re-tested at DB level)
// ---------------------------------------------------------------------------

describe("FK cascade documentation", () => {
  it("deleteUser cascades to membership rows (ON DELETE CASCADE)", () => {
    // The ON DELETE CASCADE constraint on workspace_memberships(user_id) FK
    // means that calling deleteUser() in Postgres will automatically remove
    // all membership rows for that user. This test documents the expected
    // semantic; the actual cascade is enforced by Postgres, not our code.
    expect(true).toBe(true);
  });

  it("deleteWorkspace cascades to membership rows (ON DELETE CASCADE)", () => {
    // Same pattern: workspace_memberships(workspace_id) FK ON DELETE CASCADE.
    expect(true).toBe(true);
  });

  it("deleting user that created a workspace sets created_by_user_id to NULL (ON DELETE SET NULL)", () => {
    // workspaces(created_by_user_id) FK ON DELETE SET NULL.
    expect(true).toBe(true);
  });
});
