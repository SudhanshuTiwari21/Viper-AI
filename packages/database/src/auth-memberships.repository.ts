/**
 * F.29 — Repository for the `workspace_memberships` table.
 *
 * Manages the many-to-many relationship between workspaces and users, along
 * with a role field (owner | admin | member). Deleting a workspace or user
 * cascades automatically via FK ON DELETE CASCADE.
 */
import type { Pool } from "pg";

export type MembershipRole = "owner" | "admin" | "member";

export interface WorkspaceMembershipRow {
  workspace_id: string;
  user_id: string;
  role: MembershipRole;
  created_at: string;
}

/**
 * Add (or update the role of) a user in a workspace.
 * Uses INSERT … ON CONFLICT so it is idempotent — safe to call when
 * re-inviting an existing member (role will be updated).
 */
export async function upsertMembership(
  pool: Pool,
  params: {
    workspace_id: string;
    user_id: string;
    role: MembershipRole;
  },
): Promise<WorkspaceMembershipRow> {
  const result = await pool.query<WorkspaceMembershipRow>(
    `INSERT INTO workspace_memberships (workspace_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (workspace_id, user_id)
     DO UPDATE SET role = EXCLUDED.role
     RETURNING *`,
    [params.workspace_id, params.user_id, params.role],
  );
  return result.rows[0]!;
}

/** Fetch a specific membership. Returns null if the pair does not exist. */
export async function getMembership(
  pool: Pool,
  workspace_id: string,
  user_id: string,
): Promise<WorkspaceMembershipRow | null> {
  const result = await pool.query<WorkspaceMembershipRow>(
    `SELECT * FROM workspace_memberships
     WHERE workspace_id = $1 AND user_id = $2
     LIMIT 1`,
    [workspace_id, user_id],
  );
  return result.rows[0] ?? null;
}

/** List all memberships for a workspace (ordered by created_at ascending). */
export async function listMembersForWorkspace(
  pool: Pool,
  workspace_id: string,
): Promise<WorkspaceMembershipRow[]> {
  const result = await pool.query<WorkspaceMembershipRow>(
    `SELECT * FROM workspace_memberships
     WHERE workspace_id = $1
     ORDER BY created_at ASC`,
    [workspace_id],
  );
  return result.rows;
}

/** List all workspaces a user belongs to (ordered by joined date ascending). */
export async function listWorkspacesForUser(
  pool: Pool,
  user_id: string,
): Promise<WorkspaceMembershipRow[]> {
  const result = await pool.query<WorkspaceMembershipRow>(
    `SELECT * FROM workspace_memberships
     WHERE user_id = $1
     ORDER BY created_at ASC`,
    [user_id],
  );
  return result.rows;
}

/**
 * Remove a user from a workspace.
 * Returns true if a row was deleted.
 */
export async function removeMembership(
  pool: Pool,
  workspace_id: string,
  user_id: string,
): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM workspace_memberships
     WHERE workspace_id = $1 AND user_id = $2`,
    [workspace_id, user_id],
  );
  return (result.rowCount ?? 0) > 0;
}
