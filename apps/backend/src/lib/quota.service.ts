/**
 * F.33 — Monthly quota service (request count + usage credits).
 *
 * **Legacy mode:** `workspace_entitlements.flags.monthly_request_quota` — counts HTTP chat
 * completions (existing rollup + today tail).
 *
 * **Credit mode:** `included_auto_usage_credits_monthly` / `included_premium_usage_credits_monthly`
 * — sums `usage_events.cost_units` per `billing_bucket` for the UTC month. Expensive models
 * debit more credits per request (see @repo/model-registry usage credits).
 *
 * Kill-switch: VIPER_QUOTA_ENFORCE=1
 *
 * Flags:
 *   monthly_request_quota — legacy max requests/month (when no credit limits configured)
 *   included_auto_usage_credits_monthly — positive number; omit/null = unlimited Auto credits
 *   included_premium_usage_credits_monthly — positive number; omit/null = unlimited Premium credits
 *   quota_soft_threshold_ratio — soft warn threshold (default 0.8)
 */

import {
  getPool,
  getWorkspaceEntitlements,
  getWorkspaceByPathKey,
  listRollupsForWorkspace,
  countUsageEventsForDay,
  sumCostUnitsForWorkspaceMonth,
} from "@repo/database";
import type { UsageBillingBucket } from "@repo/database";
import type { ResolvedEntitlements } from "./entitlements.service.js";
import { workflowLog } from "../services/assistant.service.js";

export function isQuotaEnforced(): boolean {
  const v = process.env["VIPER_QUOTA_ENFORCE"];
  return v === "1" || v?.toLowerCase() === "true";
}

export function getDefaultMonthlyQuota(): bigint | null {
  const raw = process.env["VIPER_QUOTA_DEFAULT_MONTHLY_REQUESTS"];
  if (!raw || raw.trim() === "") return null;
  const n = parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return BigInt(n);
}

function parsePositiveBigIntFlag(flags: Record<string, unknown>, key: string): bigint | null {
  const v = flags[key];
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return BigInt(Math.floor(v));
  if (typeof v === "string" && v.trim() !== "") {
    const n = parseInt(v.trim(), 10);
    if (Number.isFinite(n) && n > 0) return BigInt(n);
  }
  return null;
}

export interface QuotaConfig {
  monthlyRequestQuota: bigint | null;
  softThresholdRatio: number;
  /** Credit limits; null = unlimited for that bucket. */
  includedAutoCredits: bigint | null;
  includedPremiumCredits: bigint | null;
}

export function usesCreditQuota(config: QuotaConfig): boolean {
  return config.includedAutoCredits !== null || config.includedPremiumCredits !== null;
}

export function parseQuotaConfig(flags: Record<string, unknown>): QuotaConfig {
  const flagLimit = flags["monthly_request_quota"];
  let monthlyRequestQuota: bigint | null = null;
  if (typeof flagLimit === "number" && flagLimit > 0) {
    monthlyRequestQuota = BigInt(Math.floor(flagLimit));
  } else {
    monthlyRequestQuota = getDefaultMonthlyQuota();
  }

  const flagRatio = flags["quota_soft_threshold_ratio"];
  const softThresholdRatio =
    typeof flagRatio === "number" && flagRatio > 0 && flagRatio <= 1 ? flagRatio : 0.8;

  const includedAutoCredits = parsePositiveBigIntFlag(flags, "included_auto_usage_credits_monthly");
  const includedPremiumCredits = parsePositiveBigIntFlag(
    flags,
    "included_premium_usage_credits_monthly",
  );

  return {
    monthlyRequestQuota,
    softThresholdRatio,
    includedAutoCredits,
    includedPremiumCredits,
  };
}

export function getPreflightReserveCredits(bucket: UsageBillingBucket): bigint {
  const autoKey = "VIPER_QUOTA_PREFLIGHT_AUTO_CREDITS";
  const premKey = "VIPER_QUOTA_PREFLIGHT_PREMIUM_CREDITS";
  const raw =
    bucket === "premium"
      ? process.env[premKey] ?? process.env["VIPER_QUOTA_PREFLIGHT_CREDITS"]
      : process.env[autoKey] ?? process.env["VIPER_QUOTA_PREFLIGHT_CREDITS"];
  const fallback = bucket === "premium" ? "25000" : "8000";
  const n = parseInt((raw ?? fallback).trim(), 10);
  if (!Number.isFinite(n) || n < 1) return BigInt(fallback);
  return BigInt(n);
}

export function currentUtcMonthWindow(todayUtc: string): { firstDay: string; lastDay: string } {
  const [year, month] = todayUtc.split("-").map(Number) as [number, number];
  const firstDay = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
  const nextMonthFirst = new Date(Date.UTC(year, month, 1));
  const lastDayDate = new Date(nextMonthFirst.getTime() - 86_400_000);
  const lastDay = lastDayDate.toISOString().slice(0, 10);
  return { firstDay, lastDay };
}

export function getTodayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function computeMonthlyUsage(
  pathKey: string,
  todayUtc: string,
): Promise<bigint> {
  const pool = getPool();
  const { firstDay } = currentUtcMonthWindow(todayUtc);
  const todayDate = new Date(todayUtc + "T00:00:00Z");
  const yesterdayMs = todayDate.getTime() - 86_400_000;
  const yesterday = new Date(yesterdayMs).toISOString().slice(0, 10);

  let rollupSum = 0n;
  if (firstDay <= yesterday) {
    const rows = await listRollupsForWorkspace(pool, pathKey, firstDay, yesterday);
    for (const row of rows) {
      rollupSum += BigInt(row.request_count);
    }
  }

  const todayStr = await countUsageEventsForDay(pool, pathKey, todayUtc);
  const todayCount = BigInt(todayStr);

  return rollupSum + todayCount;
}

export class QuotaError extends Error {
  constructor(
    message: string,
    readonly statusCode: 429,
    readonly quota: QuotaSnapshot,
  ) {
    super(message);
    this.name = "QuotaError";
  }
}

export interface QuotaSnapshot {
  used: string;
  limit: string;
  remaining: string;
  status: "ok" | "soft_warning" | "exceeded";
  /** `credits` when credit buckets are enforced for this check */
  meter?: "credits" | "requests";
  billing_bucket?: UsageBillingBucket;
  /** Whole percent 0–100 for UI (included allowance consumed). */
  percent_used?: string;
}

function percentUsedString(used: bigint, limit: bigint): string {
  if (limit <= 0n) return "0";
  const pct = Number((used * 100n) / limit);
  return String(Math.min(100, Math.max(0, pct)));
}

async function resolveFlagsForQuota(
  pathKey: string,
  entitlements: ResolvedEntitlements | null,
): Promise<Record<string, unknown>> {
  if (entitlements) return entitlements.flags;
  if (process.env["DATABASE_URL"]) {
    try {
      const pool = getPool();
      const workspace = await getWorkspaceByPathKey(pool, pathKey);
      if (workspace) {
        const entRow = await getWorkspaceEntitlements(pool, workspace.id);
        if (entRow) return entRow.flags;
      }
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Pre-flight quota check before accepting a chat request.
 *
 * @param opts.billingBucket — Effective product tier (`auto` | `premium`). Defaults to `auto`;
 *   pass explicitly for correct credit-bucket checks when credit limits are configured.
 */
export async function checkMonthlyQuota(
  pathKey: string,
  entitlements: ResolvedEntitlements | null,
  identity: { request_id: string; workspace_id: string; conversation_id: string | null },
  opts?: { billingBucket?: UsageBillingBucket; todayUtc?: string },
): Promise<void> {
  if (!isQuotaEnforced()) return;

  const flags = await resolveFlagsForQuota(pathKey, entitlements);
  const config = parseQuotaConfig(flags);
  const today = opts?.todayUtc ?? getTodayUtc();
  const billingBucket: UsageBillingBucket = opts?.billingBucket ?? "auto";

  if (usesCreditQuota(config)) {
    const limit =
      billingBucket === "premium" ? config.includedPremiumCredits : config.includedAutoCredits;
    if (limit === null) return;

    if (!process.env["DATABASE_URL"]) return;

    try {
      const pool = getPool();
      const used = await sumCostUnitsForWorkspaceMonth(pool, pathKey, billingBucket, today);
      const reserve = getPreflightReserveCredits(billingBucket);
      const projected = used + reserve;
      const remaining = limit > used ? limit - used : 0n;

      if (used >= limit) {
        const snapshot: QuotaSnapshot = {
          used: used.toString(),
          limit: limit.toString(),
          remaining: "0",
          status: "exceeded",
          meter: "credits",
          billing_bucket: billingBucket,
          percent_used: "100",
        };
        workflowLog("quota:check", identity, {
          status: "exceeded",
          meter: "credits",
          billing_bucket: billingBucket,
          used: used.toString(),
          limit: limit.toString(),
        });
        throw new QuotaError(
          `Included ${billingBucket === "premium" ? "Premium" : "Auto"} usage for this billing period is exhausted. Quota resets at the start of the next UTC calendar month, or switch tiers / upgrade if your plan allows.`,
          429,
          snapshot,
        );
      }

      if (projected > limit) {
        const snapshot: QuotaSnapshot = {
          used: used.toString(),
          limit: limit.toString(),
          remaining: remaining.toString(),
          status: "exceeded",
          meter: "credits",
          billing_bucket: billingBucket,
          percent_used: percentUsedString(used, limit),
        };
        workflowLog("quota:check", identity, {
          status: "exceeded",
          meter: "credits",
          billing_bucket: billingBucket,
          reason: "preflight_reserve",
          used: used.toString(),
          limit: limit.toString(),
          reserve: reserve.toString(),
        });
        throw new QuotaError(
          `Not enough included ${billingBucket === "premium" ? "Premium" : "Auto"} usage remaining for this request (estimated). Try again later this month, use a lighter request, or upgrade.`,
          429,
          snapshot,
        );
      }

      const softThreshold = BigInt(Math.floor(Number(limit) * config.softThresholdRatio));
      if (used >= softThreshold) {
        workflowLog("quota:check", identity, {
          status: "soft_warning",
          meter: "credits",
          billing_bucket: billingBucket,
          used: used.toString(),
          limit: limit.toString(),
          remaining: remaining.toString(),
          percent_used: percentUsedString(used, limit),
        });
      }
    } catch (err) {
      if (err instanceof QuotaError) throw err;
      return;
    }
    return;
  }

  // Legacy: request count
  if (config.monthlyRequestQuota === null) return;

  const monthlyRequestQuota = config.monthlyRequestQuota;
  const softThresholdRatio = config.softThresholdRatio;

  const used = await computeMonthlyUsage(pathKey, today);
  const limit = monthlyRequestQuota;
  const remaining = limit - used > 0n ? limit - used : 0n;

  if (used >= limit) {
    const snapshot: QuotaSnapshot = {
      used: used.toString(),
      limit: limit.toString(),
      remaining: "0",
      status: "exceeded",
      meter: "requests",
      percent_used: "100",
    };
    workflowLog("quota:check", identity, {
      status: "exceeded",
      meter: "requests",
      used: used.toString(),
      limit: limit.toString(),
    });
    throw new QuotaError(
      `Monthly request quota exceeded (${used}/${limit}). Quota resets at the start of the next UTC calendar month.`,
      429,
      snapshot,
    );
  }

  const softThreshold = BigInt(Math.floor(Number(limit) * softThresholdRatio));
  if (used >= softThreshold) {
    workflowLog("quota:check", identity, {
      status: "soft_warning",
      meter: "requests",
      used: used.toString(),
      limit: limit.toString(),
      remaining: remaining.toString(),
      soft_threshold: softThreshold.toString(),
      percent_used: percentUsedString(used, limit),
    });
  }
}
