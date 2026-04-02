/**
 * F.30 — Repository for the `workspace_entitlements` table.
 *
 * Stores per-workspace capability plans:
 *   allowed_modes:       JSON array of ChatMode strings, or NULL = all allowed.
 *   allowed_model_tiers: JSON array of ModelTierSelection strings, or NULL = all allowed.
 *   flags:               JSONB for future feature flags.
 *
 * Composition rule: effective = intersection(DB plan, D.20 env caps).
 * When no row exists for a workspace, callers should treat it as "allow-all"
 * (safe default during rollout — avoids blocking existing workspaces).
 */
import type { Pool } from "pg";

export interface WorkspaceEntitlementRow {
  workspace_id: string;
  /** JSON array of allowed ChatMode strings, or null = all modes allowed. */
  allowed_modes: string[] | null;
  /** JSON array of allowed ModelTierSelection strings, or null = all tiers allowed. */
  allowed_model_tiers: string[] | null;
  /** Arbitrary feature flags for future use. */
  flags: Record<string, unknown>;
  updated_at: string;
}

export interface UpsertEntitlementsParams {
  workspace_id: string;
  allowed_modes?: string[] | null;
  allowed_model_tiers?: string[] | null;
  flags?: Record<string, unknown>;
}

/**
 * Insert or update entitlements for a workspace.
 * Idempotent — safe to call multiple times with the same params.
 */
export async function upsertWorkspaceEntitlements(
  pool: Pool,
  params: UpsertEntitlementsParams,
): Promise<WorkspaceEntitlementRow> {
  const result = await pool.query<WorkspaceEntitlementRow>(
    `INSERT INTO workspace_entitlements (workspace_id, allowed_modes, allowed_model_tiers, flags)
     VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb)
     ON CONFLICT (workspace_id) DO UPDATE
       SET allowed_modes       = EXCLUDED.allowed_modes,
           allowed_model_tiers = EXCLUDED.allowed_model_tiers,
           flags               = EXCLUDED.flags,
           updated_at          = now()
     RETURNING *`,
    [
      params.workspace_id,
      params.allowed_modes !== undefined ? JSON.stringify(params.allowed_modes) : null,
      params.allowed_model_tiers !== undefined ? JSON.stringify(params.allowed_model_tiers) : null,
      JSON.stringify(params.flags ?? {}),
    ],
  );
  return result.rows[0]!;
}

/**
 * Fetch entitlements for a workspace UUID.
 * Returns null when no row exists (caller should treat as "allow-all").
 */
export async function getWorkspaceEntitlements(
  pool: Pool,
  workspace_id: string,
): Promise<WorkspaceEntitlementRow | null> {
  const result = await pool.query<WorkspaceEntitlementRow>(
    `SELECT * FROM workspace_entitlements WHERE workspace_id = $1 LIMIT 1`,
    [workspace_id],
  );
  return result.rows[0] ?? null;
}

/**
 * Delete entitlements for a workspace (resets to "allow-all" on next check).
 * Returns true if a row was deleted.
 */
export async function deleteWorkspaceEntitlements(
  pool: Pool,
  workspace_id: string,
): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM workspace_entitlements WHERE workspace_id = $1`,
    [workspace_id],
  );
  return (result.rowCount ?? 0) > 0;
}
