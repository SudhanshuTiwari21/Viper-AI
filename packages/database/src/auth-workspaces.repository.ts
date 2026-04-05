/**
 * F.29 — Repository for the `workspaces` table.
 *
 * Logical workspace records keyed by UUID. Their relationship to the path-
 * derived `workspace_id TEXT` used by existing chat/media/feedback tables is
 * deferred to F.30 (the F.30 migration will add a `path_key TEXT` column or
 * a separate mapping table and backfill it).
 */
import type { Pool } from "pg";

export interface WorkspaceRow {
  id: string;
  name: string;
  slug: string | null;
  /** F.30: 16-hex path-derived key; matches deriveWorkspaceId(workspacePath). */
  path_key: string | null;
  /** F.34: Stripe Customer ID, set when billing is linked. */
  stripe_customer_id: string | null;
  /** F.34: current Stripe Subscription ID. */
  stripe_subscription_id: string | null;
  /** Default entitlements + quota template; overridable via workspace_entitlements. */
  billing_plan_slug?: string;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkspaceParams {
  name: string;
  slug?: string | null;
  /** F.30: derive via resolvePathKey(workspacePath) before inserting. */
  path_key?: string | null;
  created_by_user_id?: string | null;
}

/**
 * Create a new workspace and return the row.
 * Throws a Postgres unique-violation (23505) if the slug already exists.
 */
export async function createWorkspace(
  pool: Pool,
  params: CreateWorkspaceParams,
): Promise<WorkspaceRow> {
  const result = await pool.query<WorkspaceRow>(
    `INSERT INTO workspaces (name, slug, path_key, created_by_user_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [params.name, params.slug ?? null, params.path_key ?? null, params.created_by_user_id ?? null],
  );
  return result.rows[0]!;
}

/**
 * F.30: Upsert a workspace keyed by path_key (the deriveWorkspaceId value).
 * If no row exists for this path_key, a new workspace is created with `name`
 * set to the path_key itself (placeholder; can be updated via updateWorkspace).
 * If the row already exists, returns it unchanged (idempotent).
 * Used by the entitlement resolver to lazily materialise workspace rows.
 */
export async function upsertWorkspaceByPathKey(
  pool: Pool,
  path_key: string,
  name?: string,
): Promise<WorkspaceRow> {
  const result = await pool.query<WorkspaceRow>(
    `INSERT INTO workspaces (name, path_key)
     VALUES ($1, $2)
     ON CONFLICT (path_key) DO UPDATE SET updated_at = now()
     RETURNING *`,
    [name ?? path_key, path_key],
  );
  return result.rows[0]!;
}

/** F.30: Fetch a workspace by its path_key. Returns null when not found. */
export async function getWorkspaceByPathKey(
  pool: Pool,
  path_key: string,
): Promise<WorkspaceRow | null> {
  const result = await pool.query<WorkspaceRow>(
    `SELECT * FROM workspaces WHERE path_key = $1 LIMIT 1`,
    [path_key],
  );
  return result.rows[0] ?? null;
}

/** Fetch a workspace by UUID. Returns null if not found. */
export async function getWorkspaceById(
  pool: Pool,
  id: string,
): Promise<WorkspaceRow | null> {
  const result = await pool.query<WorkspaceRow>(
    `SELECT * FROM workspaces WHERE id = $1 LIMIT 1`,
    [id],
  );
  return result.rows[0] ?? null;
}

/** Fetch a workspace by unique slug. Returns null if not found. */
export async function getWorkspaceBySlug(
  pool: Pool,
  slug: string,
): Promise<WorkspaceRow | null> {
  const result = await pool.query<WorkspaceRow>(
    `SELECT * FROM workspaces WHERE slug = $1 LIMIT 1`,
    [slug],
  );
  return result.rows[0] ?? null;
}

export interface UpdateWorkspaceParams {
  name?: string;
  slug?: string | null;
  path_key?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  billing_plan_slug?: string;
}

/** Update workspace name or slug. Returns updated row, or null if id not found. */
/**
 * Phase 6 — after a paid Stripe subscription is confirmed (webhook).
 * Updates customer + subscription ids; optionally sets `billing_plan_slug` (must exist in `billing_plans`).
 */
export async function setWorkspaceStripeBilling(
  pool: Pool,
  workspaceId: string,
  params: {
    stripe_customer_id: string;
    stripe_subscription_id: string;
    billing_plan_slug?: string;
  },
): Promise<void> {
  if (params.billing_plan_slug !== undefined) {
    await pool.query(
      `UPDATE workspaces
       SET stripe_customer_id     = $2,
           stripe_subscription_id = $3,
           billing_plan_slug      = $4,
           updated_at             = now()
       WHERE id = $1`,
      [workspaceId, params.stripe_customer_id, params.stripe_subscription_id, params.billing_plan_slug],
    );
  } else {
    await pool.query(
      `UPDATE workspaces
       SET stripe_customer_id     = $2,
           stripe_subscription_id = $3,
           updated_at             = now()
       WHERE id = $1`,
      [workspaceId, params.stripe_customer_id, params.stripe_subscription_id],
    );
  }
}

/**
 * Phase 6 — subscription ended: drop subscription id, reset plan to `free`.
 * Keeps `stripe_customer_id` for re-checkout. Pair with `deleteWorkspaceEntitlements`.
 */
export async function clearWorkspacePaidSubscription(pool: Pool, workspaceId: string): Promise<void> {
  await pool.query(
    `UPDATE workspaces
     SET stripe_subscription_id = NULL,
         billing_plan_slug      = 'free',
         updated_at             = now()
     WHERE id = $1`,
    [workspaceId],
  );
}

export async function updateWorkspace(
  pool: Pool,
  id: string,
  params: UpdateWorkspaceParams,
): Promise<WorkspaceRow | null> {
  const result = await pool.query<WorkspaceRow>(
    `UPDATE workspaces
     SET name                   = COALESCE($2, name),
         slug                   = COALESCE($3, slug),
         path_key               = COALESCE($4, path_key),
         stripe_customer_id     = COALESCE($5, stripe_customer_id),
         stripe_subscription_id = COALESCE($6, stripe_subscription_id),
         billing_plan_slug      = COALESCE($7, billing_plan_slug),
         updated_at             = now()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      params.name ?? null,
      params.slug ?? null,
      params.path_key ?? null,
      params.stripe_customer_id ?? null,
      params.stripe_subscription_id ?? null,
      params.billing_plan_slug ?? null,
    ],
  );
  return result.rows[0] ?? null;
}

/**
 * Delete a workspace by UUID. Membership rows cascade automatically.
 * Returns true if a row was deleted.
 */
export async function deleteWorkspace(pool: Pool, id: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM workspaces WHERE id = $1`,
    [id],
  );
  return (result.rowCount ?? 0) > 0;
}
