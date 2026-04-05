/**
 * Billing plan catalog (Neon-editable). Workspaces point at a slug; defaults merge with workspace_entitlements.
 */
import type { Pool } from "pg";
import {
  getWorkspaceEntitlements,
  type WorkspaceEntitlementRow,
} from "./auth-entitlements.repository.js";
import type { WorkspaceRow } from "./auth-workspaces.repository.js";

export interface BillingPlanRow {
  slug: string;
  display_name: string;
  allowed_modes: string[] | null;
  allowed_model_tiers: string[];
  flags: Record<string, unknown>;
  z_ratio_bp: number | null;
  auto_budget_share_bp: number | null;
  premium_budget_share_bp: number | null;
}

export async function getBillingPlanBySlug(
  pool: Pool,
  slug: string,
): Promise<BillingPlanRow | null> {
  const result = await pool.query(
    `SELECT slug, display_name, allowed_modes, allowed_model_tiers, flags,
            z_ratio_bp, auto_budget_share_bp, premium_budget_share_bp
     FROM billing_plans WHERE slug = $1 LIMIT 1`,
    [slug],
  );
  const row = result.rows[0] as
    | {
        slug: string;
        display_name: string;
        allowed_modes: unknown;
        allowed_model_tiers: unknown;
        flags: unknown;
        z_ratio_bp: number | null;
        auto_budget_share_bp: number | null;
        premium_budget_share_bp: number | null;
      }
    | undefined;
  if (!row) return null;
  const tiers = row.allowed_model_tiers;
  const allowed_model_tiers = Array.isArray(tiers)
    ? tiers.map((t) => String(t))
    : ["auto", "premium"];
  return {
    slug: row.slug,
    display_name: row.display_name,
    allowed_modes: (row.allowed_modes as string[] | null) ?? null,
    allowed_model_tiers,
    flags: (row.flags as Record<string, unknown>) ?? {},
    z_ratio_bp: row.z_ratio_bp,
    auto_budget_share_bp: row.auto_budget_share_bp,
    premium_budget_share_bp: row.premium_budget_share_bp,
  };
}

/**
 * Plan defaults first; workspace_entitlements row overrides (shallow flags merge).
 */
export function mergeBillingPlanWithWorkspaceEntitlements(
  workspaceId: string,
  plan: BillingPlanRow,
  ent: WorkspaceEntitlementRow | null,
): WorkspaceEntitlementRow {
  const allowed_modes =
    ent === null ? plan.allowed_modes : ent.allowed_modes ?? plan.allowed_modes;
  const allowed_model_tiers =
    ent === null
      ? plan.allowed_model_tiers
      : ent.allowed_model_tiers ?? plan.allowed_model_tiers;
  const flags = { ...plan.flags, ...(ent?.flags ?? {}) };
  return {
    workspace_id: workspaceId,
    allowed_modes,
    allowed_model_tiers,
    flags,
    updated_at: ent?.updated_at ?? new Date().toISOString(),
  };
}

/**
 * Plan defaults + optional workspace_entitlements row (same merge as F.30 resolver).
 */
export async function loadComposedWorkspaceEntitlements(
  pool: Pool,
  workspace: WorkspaceRow,
): Promise<WorkspaceEntitlementRow> {
  const planSlug = workspace.billing_plan_slug || "free";
  let planTemplate = await getBillingPlanBySlug(pool, planSlug);
  if (!planTemplate) {
    planTemplate = await getBillingPlanBySlug(pool, "free");
  }
  if (!planTemplate) {
    throw new Error(
      "billing_plans catalog is missing the 'free' row. Apply database migration 018_billing_plans.sql.",
    );
  }
  const entRow = await getWorkspaceEntitlements(pool, workspace.id);
  return mergeBillingPlanWithWorkspaceEntitlements(workspace.id, planTemplate, entRow);
}
