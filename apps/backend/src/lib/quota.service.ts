/**
 * F.33 — Monthly request quota service.
 *
 * Implements hard (429) and soft (warn) enforcement of monthly chat request
 * quotas. Quota limits are stored in workspace_entitlements.flags JSONB and
 * are read via request.entitlements?.flags. When no limit is configured the
 * entire quota path is a fast no-op (no DB calls).
 *
 * Kill-switch:
 *   VIPER_QUOTA_ENFORCE=1  — required for any quota DB checks or denials.
 *   When unset/false: identical behavior to today (zero DB overhead).
 *
 * Limit sources (in priority order):
 *   1. workspace_entitlements.flags.monthly_request_quota (number)
 *   2. VIPER_QUOTA_DEFAULT_MONTHLY_REQUESTS env var (integer)
 *   3. No limit found → unlimited (allow-all, matching F.30 "missing row = allow-all")
 *
 * Auth coupling:
 *   Quota enforcement works purely by workspace path_key — it does NOT require
 *   VIPER_ENTITLEMENTS_ENFORCE=1. The quota service reads flags from
 *   request.entitlements when available but falls back to resolving the
 *   workspace_entitlements row directly by path_key when entitlements is null.
 *   This means quota can be enforced even in local/dev mode without a bearer token.
 *
 * Quota computation:
 *   Month window: [first_day_of_current_utc_month, last_day_of_current_utc_month]
 *   Closed days (strictly < today UTC): summed from usage_rollups_daily
 *   Today (UTC): counted directly from usage_events (live tail)
 *   Total used = rollup_sum + today_count
 *   All arithmetic uses BigInt to handle large counts safely.
 *
 * HTTP status choice:
 *   429 Too Many Requests — quota exhausted. Preference over 403 because:
 *     * RFC 6585 defines 429 explicitly for rate/quota limiting.
 *     * Clients can distinguish "forbidden" (wrong permissions) vs "too many".
 *
 * Flags keys in workspace_entitlements.flags:
 *   monthly_request_quota       number — max requests in a UTC calendar month
 *   quota_soft_threshold_ratio  number in (0,1] — default 0.8
 */

import {
  getPool,
  getWorkspaceEntitlements,
  getWorkspaceByPathKey,
  listRollupsForWorkspace,
  countUsageEventsForDay,
} from "@repo/database";
import type { ResolvedEntitlements } from "./entitlements.service.js";
import { resolvePathKey } from "./entitlements.service.js";
import { workflowLog } from "../services/assistant.service.js";

// ---------------------------------------------------------------------------
// Env helpers
// ---------------------------------------------------------------------------

export function isQuotaEnforced(): boolean {
  const v = process.env["VIPER_QUOTA_ENFORCE"];
  return v === "1" || v?.toLowerCase() === "true";
}

/** Optional env-level default limit; returns null when unlimited. */
export function getDefaultMonthlyQuota(): bigint | null {
  const raw = process.env["VIPER_QUOTA_DEFAULT_MONTHLY_REQUESTS"];
  if (!raw || raw.trim() === "") return null;
  const n = parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return BigInt(n);
}

// ---------------------------------------------------------------------------
// Flag parsing
// ---------------------------------------------------------------------------

export interface QuotaConfig {
  /** null = unlimited */
  monthlyRequestQuota: bigint | null;
  /** 0 < ratio ≤ 1; default 0.8 */
  softThresholdRatio: number;
}

/**
 * Parse quota config from entitlement flags.
 * Falls back to env default for the limit when the flag is absent.
 * If both are absent → unlimited (null).
 */
export function parseQuotaConfig(flags: Record<string, unknown>): QuotaConfig {
  // Monthly limit: flag takes precedence over env default.
  const flagLimit = flags["monthly_request_quota"];
  let monthlyRequestQuota: bigint | null = null;
  if (typeof flagLimit === "number" && flagLimit > 0) {
    monthlyRequestQuota = BigInt(Math.floor(flagLimit));
  } else {
    monthlyRequestQuota = getDefaultMonthlyQuota();
  }

  // Soft threshold: flag or default 0.8.
  const flagRatio = flags["quota_soft_threshold_ratio"];
  const softThresholdRatio =
    typeof flagRatio === "number" && flagRatio > 0 && flagRatio <= 1 ? flagRatio : 0.8;

  return { monthlyRequestQuota, softThresholdRatio };
}

// ---------------------------------------------------------------------------
// Usage computation
// ---------------------------------------------------------------------------

/** UTC month window for a given UTC date string "YYYY-MM-DD". */
export function currentUtcMonthWindow(todayUtc: string): { firstDay: string; lastDay: string } {
  const [year, month] = todayUtc.split("-").map(Number) as [number, number];
  const firstDay = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
  // Last day of month: first day of NEXT month minus 1 day.
  const nextMonthFirst = new Date(Date.UTC(year, month, 1)); // month is 0-indexed; month = 1-indexed value
  const lastDayDate = new Date(nextMonthFirst.getTime() - 86_400_000);
  const lastDay = lastDayDate.toISOString().slice(0, 10);
  return { firstDay, lastDay };
}

/** Return today's UTC date as "YYYY-MM-DD". Exported for test injection. */
export function getTodayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Compute total requests used in the current UTC calendar month for a workspace.
 *
 * closed_days_sum: sum request_count from usage_rollups_daily for
 *   [firstDay, yesterday] (days strictly before today have closed rollups).
 * today_count: COUNT(*) from usage_events for today UTC.
 *
 * Returns a BigInt for safe arithmetic.
 */
export async function computeMonthlyUsage(
  pathKey: string,
  todayUtc: string,
): Promise<bigint> {
  const pool = getPool();
  const { firstDay } = currentUtcMonthWindow(todayUtc);

  // Yesterday UTC (last closed day).
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

// ---------------------------------------------------------------------------
// Typed quota error
// ---------------------------------------------------------------------------

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
  used: string; // BigInt as decimal string for safe JSON serialization
  limit: string;
  remaining: string;
  status: "ok" | "soft_warning" | "exceeded";
}

// ---------------------------------------------------------------------------
// Core quota check
// ---------------------------------------------------------------------------

/**
 * Check monthly request quota for a workspace before allowing a chat request.
 *
 * - When VIPER_QUOTA_ENFORCE is off: immediate no-op (no DB calls).
 * - When limit is null/unlimited: immediate no-op.
 * - Soft threshold crossed: emits workflowLog("quota:check", ...) but allows request.
 * - Hard limit reached (used >= limit): throws QuotaError(429).
 *
 * @param pathKey      workspace_path_key (from deriveWorkspaceId / resolvePathKey)
 * @param entitlements F.30 resolved entitlements (may be null in local mode)
 * @param identity     for workflowLog
 * @param todayUtc     injectable for tests; defaults to getTodayUtc()
 */
export async function checkMonthlyQuota(
  pathKey: string,
  entitlements: ResolvedEntitlements | null,
  identity: { request_id: string; workspace_id: string; conversation_id: string | null },
  todayUtc?: string,
): Promise<void> {
  // Kill-switch: default off.
  if (!isQuotaEnforced()) return;

  // Resolve flags: prefer entitlements snapshot; fall back to direct DB lookup.
  let flags: Record<string, unknown> = {};
  if (entitlements) {
    flags = entitlements.flags;
  } else {
    // Quota can run without VIPER_ENTITLEMENTS_ENFORCE — look up by path_key.
    if (process.env["DATABASE_URL"]) {
      try {
        const pool = getPool();
        const workspace = await getWorkspaceByPathKey(pool, pathKey);
        if (workspace) {
          const entRow = await getWorkspaceEntitlements(pool, workspace.id);
          if (entRow) flags = entRow.flags;
        }
      } catch {
        // DB unavailable — treat as unlimited (fail-open for quota).
        return;
      }
    }
  }

  const { monthlyRequestQuota, softThresholdRatio } = parseQuotaConfig(flags);

  // No limit configured → no-op.
  if (monthlyRequestQuota === null) return;

  const today = todayUtc ?? getTodayUtc();
  const used = await computeMonthlyUsage(pathKey, today);
  const limit = monthlyRequestQuota;
  const remaining = limit - used > 0n ? limit - used : 0n;

  // Hard limit: used >= limit → deny.
  if (used >= limit) {
    const snapshot: QuotaSnapshot = {
      used: used.toString(),
      limit: limit.toString(),
      remaining: "0",
      status: "exceeded",
    };
    workflowLog("quota:check", identity, {
      status: "exceeded",
      used: used.toString(),
      limit: limit.toString(),
      remaining: "0",
    });
    throw new QuotaError(
      `Monthly request quota exceeded (${used}/${limit}). Quota resets at the start of the next UTC calendar month.`,
      429,
      snapshot,
    );
  }

  // Soft threshold: used >= floor(limit * ratio) → warn but allow.
  const softThreshold = BigInt(Math.floor(Number(limit) * softThresholdRatio));
  if (used >= softThreshold) {
    workflowLog("quota:check", identity, {
      status: "soft_warning",
      used: used.toString(),
      limit: limit.toString(),
      remaining: remaining.toString(),
      soft_threshold: softThreshold.toString(),
    });
  }
  // else: within limits — no log (avoid spamming every request).
}
