/**
 * F.35 — Usage summary service.
 *
 * Computes the "Usage & plan" snapshot for a workspace, combining:
 *   - Monthly used requests (F.33 computeMonthlyUsage — rollups + live tail)
 *   - Effective limit (parseQuotaConfig — flags → env → unlimited)
 *   - Entitlements snapshot (allowed_modes, allowed_model_tiers, flags)
 *   - Optional Stripe billing linkage (stripe_customer_id, stripe_subscription_id)
 *
 * All BigInt values are serialised as decimal strings for safe JSON transport.
 *
 * Kill-switch:
 *   VIPER_USAGE_UI_ENABLED=1 required for the /usage/summary endpoint to respond.
 *   When off → 404 (hidden endpoint, matching F.34 pattern).
 */

import {
  getPool,
  getWorkspaceByPathKey,
  getWorkspaceEntitlements,
} from "@repo/database";
import {
  resolvePathKey,
  type ResolvedEntitlements,
} from "./entitlements.service.js";
import {
  computeMonthlyUsage,
  currentUtcMonthWindow,
  getTodayUtc,
  parseQuotaConfig,
} from "./quota.service.js";

// ---------------------------------------------------------------------------
// Kill-switch
// ---------------------------------------------------------------------------

export function isUsageUiEnabled(): boolean {
  const v = process.env["VIPER_USAGE_UI_ENABLED"] ?? "";
  return v === "1" || v.toLowerCase() === "true";
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EntitlementsSnapshot {
  allowed_modes: string[] | null;
  allowed_model_tiers: string[] | null;
  /** Flags safe subset: omit internal-only keys if any are documented. */
  flags: Record<string, unknown>;
}

export interface StripeLinkage {
  customerId: string;
  subscriptionId: string | null;
}

export interface UsageSummaryResponse {
  pathKey: string;
  month: {
    firstDay: string;
    lastDay: string;
  };
  /** Decimal string (BigInt serialised) */
  usedRequests: string;
  /** Decimal string or null when unlimited */
  limit: string | null;
  /** Decimal string or null when unlimited */
  remaining: string | null;
  entitlements: EntitlementsSnapshot;
  stripe: StripeLinkage | null;
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Compute the usage summary for a workspace.
 *
 * @param workspacePath  raw path from the client (used for path_key derivation)
 * @param entitlements   F.30 resolved entitlements (may be null in local/dev mode)
 * @param todayUtc       injectable for tests; defaults to getTodayUtc()
 */
export async function getUsageSummary(
  workspacePath: string,
  entitlements: ResolvedEntitlements | null,
  todayUtc?: string,
): Promise<UsageSummaryResponse> {
  const pathKey = resolvePathKey(workspacePath);
  const today = todayUtc ?? getTodayUtc();
  const month = currentUtcMonthWindow(today);

  // ---------------------------------------------------------------------------
  // Resolve flags — prefer F.30 resolved entitlements; fall back to direct DB
  // ---------------------------------------------------------------------------
  let flags: Record<string, unknown> = entitlements?.flags ?? {};
  let allowedModes: string[] | null = entitlements
    ? [...entitlements.allowedModes]
    : null;
  let allowedModelTiers: string[] | null = entitlements
    ? [...entitlements.allowedModelTiers]
    : null;
  let stripeCustomerId: string | null = null;
  let stripeSubscriptionId: string | null = null;

  if (!entitlements && process.env["DATABASE_URL"]) {
    try {
      const pool = getPool();
      const workspace = await getWorkspaceByPathKey(pool, pathKey);
      if (workspace) {
        // Stripe linkage
        stripeCustomerId = workspace.stripe_customer_id ?? null;
        stripeSubscriptionId = workspace.stripe_subscription_id ?? null;

        const entRow = await getWorkspaceEntitlements(pool, workspace.id);
        if (entRow) {
          flags = entRow.flags;
          allowedModes = entRow.allowed_modes;
          allowedModelTiers = entRow.allowed_model_tiers;
        }
      }
    } catch {
      // DB unavailable — return best-effort (unlimited, no entitlements)
    }
  } else if (entitlements && process.env["DATABASE_URL"]) {
    // Fetch stripe IDs even when entitlements resolved via F.30
    try {
      const pool = getPool();
      const workspace = await getWorkspaceByPathKey(pool, pathKey);
      if (workspace) {
        stripeCustomerId = workspace.stripe_customer_id ?? null;
        stripeSubscriptionId = workspace.stripe_subscription_id ?? null;
      }
    } catch {
      // Non-fatal — stripe linkage is best-effort
    }
  }

  // ---------------------------------------------------------------------------
  // Compute monthly usage
  // ---------------------------------------------------------------------------
  let usedRequests = 0n;
  if (process.env["DATABASE_URL"]) {
    try {
      usedRequests = await computeMonthlyUsage(pathKey, today);
    } catch {
      // DB unavailable — return 0
    }
  }

  // ---------------------------------------------------------------------------
  // Effective limit
  // ---------------------------------------------------------------------------
  const { monthlyRequestQuota } = parseQuotaConfig(flags);
  const limit = monthlyRequestQuota;

  let remaining: bigint | null = null;
  if (limit !== null) {
    remaining = limit - usedRequests > 0n ? limit - usedRequests : 0n;
  }

  return {
    pathKey,
    month,
    usedRequests: usedRequests.toString(),
    limit: limit !== null ? limit.toString() : null,
    remaining: remaining !== null ? remaining.toString() : null,
    entitlements: {
      allowed_modes: allowedModes,
      allowed_model_tiers: allowedModelTiers,
      flags,
    },
    stripe:
      stripeCustomerId
        ? { customerId: stripeCustomerId, subscriptionId: stripeSubscriptionId }
        : null,
  };
}
