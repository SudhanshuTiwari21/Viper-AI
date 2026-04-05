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
  loadComposedWorkspaceEntitlements,
  sumCostUnitsForWorkspaceMonth,
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

function percentUsedInt(used: bigint, limit: bigint): number {
  if (limit <= 0n) return 0;
  return Math.min(100, Math.max(0, Number((used * 100n) / limit)));
}

/** used/limit ≥ threshold (threshold in (0,1]). */
function crossesUsageWarningThreshold(used: bigint, limit: bigint, threshold: number): boolean {
  if (limit <= 0n || threshold <= 0 || threshold > 1) return false;
  const pct = Math.floor(threshold * 100);
  if (pct <= 0) return false;
  return used * 100n >= limit * BigInt(pct);
}

function buildComposerHint(auto: BucketMeterSnapshot, premium: BucketMeterSnapshot): string | null {
  const parts: string[] = [];
  if (auto.showWarning && auto.meter !== "not_applicable" && auto.meter !== "unlimited") {
    parts.push(`Auto: ~${auto.percentUsed}% of included allowance used this month`);
  }
  if (premium.showWarning && premium.meter !== "not_applicable" && premium.meter !== "unlimited") {
    parts.push(`Premium: ~${premium.percentUsed}% of included allowance used this month`);
  }
  if (parts.length === 0) return null;
  return `${parts.join(" · ")}. Pace usage or upgrade if you need more headroom before reset.`;
}

function emptyUsageBilling(threshold: number): UsageBillingSummary {
  const na = (bucket: "auto" | "premium"): BucketMeterSnapshot => ({
    billingBucket: bucket,
    meter: "not_applicable",
    used: "0",
    limit: null,
    remaining: null,
    percentUsed: 0,
    showWarning: false,
    exhausted: false,
  });
  return {
    usageWarningThresholdRatio: threshold,
    showComposerUsageHint: false,
    composerHint: null,
    buckets: { auto: na("auto"), premium: na("premium") },
  };
}

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

/** Per-bucket meter for Auto vs Premium (credits, monthly requests, or N/A). */
export interface BucketMeterSnapshot {
  billingBucket: "auto" | "premium";
  meter: "credits" | "requests" | "unlimited" | "not_applicable";
  used: string;
  limit: string | null;
  remaining: string | null;
  /** Whole percent 0–100 of included allowance consumed. */
  percentUsed: number;
  /** True when usage ≥ usageWarningThresholdRatio of included (e.g. 40%). */
  showWarning: boolean;
  exhausted: boolean;
}

/** Phase 2 — billing UX: thresholds, composer hint, dual-bucket progress. */
export interface UsageBillingSummary {
  usageWarningThresholdRatio: number;
  /** True if any applicable bucket crossed the warning threshold. */
  showComposerUsageHint: boolean;
  /** Short line for under the chat input; null when no warning. */
  composerHint: string | null;
  buckets: {
    auto: BucketMeterSnapshot;
    premium: BucketMeterSnapshot;
  };
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
  /** Auto/Premium meters and composer warning line (best-effort when DB available). */
  usageBilling: UsageBillingSummary;
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

        const composed = await loadComposedWorkspaceEntitlements(pool, workspace);
        flags = composed.flags;
        allowedModes = composed.allowed_modes;
        allowedModelTiers = composed.allowed_model_tiers;
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
  const quotaConfig = parseQuotaConfig(flags);
  const { monthlyRequestQuota, usageWarningThresholdRatio } = quotaConfig;
  const limit = monthlyRequestQuota;

  let remaining: bigint | null = null;
  if (limit !== null) {
    remaining = limit - usedRequests > 0n ? limit - usedRequests : 0n;
  }

  // ---------------------------------------------------------------------------
  // Phase 2 — dual-bucket billing snapshot + composer warning
  // ---------------------------------------------------------------------------
  let usageBilling = emptyUsageBilling(usageWarningThresholdRatio);

  const premiumEntitled =
    allowedModelTiers != null && allowedModelTiers.some((t) => t === "premium" || t === "fast");

  if (process.env["DATABASE_URL"]) {
    try {
      const pool = getPool();
      const creditMode =
        quotaConfig.includedAutoCredits !== null || quotaConfig.includedPremiumCredits !== null;

      let autoUsed = 0n;
      let premiumUsed = 0n;
      if (creditMode) {
        autoUsed = await sumCostUnitsForWorkspaceMonth(pool, pathKey, "auto", today);
        if (premiumEntitled) {
          premiumUsed = await sumCostUnitsForWorkspaceMonth(pool, pathKey, "premium", today);
        }
      }

      const autoLimit = creditMode ? quotaConfig.includedAutoCredits : quotaConfig.monthlyRequestQuota;
      const premiumLimit = premiumEntitled ? quotaConfig.includedPremiumCredits : null;

      const buildBucket = (
        billingBucket: "auto" | "premium",
        used: bigint,
        lim: bigint | null,
        meter: BucketMeterSnapshot["meter"],
      ): BucketMeterSnapshot => {
        if (meter === "not_applicable") {
          return {
            billingBucket,
            meter: "not_applicable",
            used: "0",
            limit: null,
            remaining: null,
            percentUsed: 0,
            showWarning: false,
            exhausted: false,
          };
        }
        if (meter === "unlimited" || lim === null) {
          return {
            billingBucket,
            meter: "unlimited",
            used: used.toString(),
            limit: null,
            remaining: null,
            percentUsed: 0,
            showWarning: false,
            exhausted: false,
          };
        }
        const rem = lim > used ? lim - used : 0n;
        const pct = percentUsedInt(used, lim);
        const warn = crossesUsageWarningThreshold(used, lim, usageWarningThresholdRatio);
        return {
          billingBucket,
          meter,
          used: used.toString(),
          limit: lim.toString(),
          remaining: rem.toString(),
          percentUsed: pct,
          showWarning: warn,
          exhausted: used >= lim,
        };
      };

      let autoSnap: BucketMeterSnapshot;
      let premiumSnap: BucketMeterSnapshot;

      if (creditMode) {
        autoSnap = buildBucket(
          "auto",
          autoUsed,
          quotaConfig.includedAutoCredits,
          quotaConfig.includedAutoCredits === null ? "unlimited" : "credits",
        );
        premiumSnap = !premiumEntitled
          ? buildBucket("premium", 0n, null, "not_applicable")
          : buildBucket(
              "premium",
              premiumUsed,
              quotaConfig.includedPremiumCredits,
              quotaConfig.includedPremiumCredits === null ? "unlimited" : "credits",
            );
      } else {
        // Request-quota plan (e.g. free): counts apply to Auto lane only
        const reqLimit = quotaConfig.monthlyRequestQuota;
        autoSnap = buildBucket(
          "auto",
          usedRequests,
          reqLimit,
          reqLimit === null ? "unlimited" : "requests",
        );
        premiumSnap = !premiumEntitled
          ? buildBucket("premium", 0n, null, "not_applicable")
          : buildBucket("premium", 0n, null, "unlimited");
      }

      const showComposerUsageHint = autoSnap.showWarning || premiumSnap.showWarning;
      usageBilling = {
        usageWarningThresholdRatio,
        showComposerUsageHint,
        composerHint: showComposerUsageHint ? buildComposerHint(autoSnap, premiumSnap) : null,
        buckets: { auto: autoSnap, premium: premiumSnap },
      };
    } catch {
      usageBilling = emptyUsageBilling(usageWarningThresholdRatio);
    }
  } else {
    usageBilling = emptyUsageBilling(usageWarningThresholdRatio);
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
    usageBilling,
  };
}
