import { getPublicBackendUrl } from "@/lib/backend-url";

/** Mirrors backend usage summary (F.35 + Phase 2 billing fields). */
export interface UsageBucketMeterSnapshot {
  billingBucket: "auto" | "premium";
  meter: "credits" | "requests" | "unlimited" | "not_applicable";
  used: string;
  limit: string | null;
  remaining: string | null;
  percentUsed: number;
  showWarning: boolean;
  exhausted: boolean;
}

export interface UsageBillingSummary {
  usageWarningThresholdRatio: number;
  showComposerUsageHint: boolean;
  composerHint: string | null;
  buckets: {
    auto: UsageBucketMeterSnapshot;
    premium: UsageBucketMeterSnapshot;
  };
}

export interface UsageSummaryResponse {
  pathKey: string;
  month: { firstDay: string; lastDay: string };
  usedRequests: string;
  limit: string | null;
  remaining: string | null;
  entitlements: {
    allowed_modes: string[] | null;
    allowed_model_tiers: string[] | null;
    flags: Record<string, unknown>;
  };
  stripe: { customerId: string; subscriptionId: string | null } | null;
  usageBilling?: UsageBillingSummary;
}

export type UsageSummaryFetchResult =
  | { ok: true; data: UsageSummaryResponse }
  | { ok: false; status: number; error: string; disabled?: boolean };

const BASE = () => getPublicBackendUrl().replace(/\/$/, "");

export async function fetchUsageSummary(
  workspacePath: string,
  accessToken: string | null,
): Promise<UsageSummaryFetchResult> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  let res: Response;
  try {
    res = await fetch(`${BASE()}/usage/summary`, {
      method: "POST",
      headers,
      body: JSON.stringify({ workspacePath }),
    });
  } catch {
    return { ok: false, status: 0, error: "Network error. Is the API reachable?" };
  }

  if (res.status === 404) {
    return {
      ok: false,
      status: 404,
      error: "Usage UI is disabled on the server (set VIPER_USAGE_UI_ENABLED=1).",
      disabled: true,
    };
  }

  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = typeof raw.error === "string" ? raw.error : `Request failed (${res.status})`;
    return { ok: false, status: res.status, error: err };
  }

  return { ok: true, data: raw as unknown as UsageSummaryResponse };
}

/** Human-readable labels for limits that are fully used (for notifications). */
export function listExhaustedUsageLabels(summary: UsageSummaryResponse): string[] {
  const labels: string[] = [];

  if (summary.limit) {
    const rem = summary.remaining;
    if (rem !== null) {
      const n = parseInt(rem, 10);
      if (!Number.isNaN(n) && n <= 0) labels.push("Monthly chat requests");
    }
  }

  const b = summary.usageBilling?.buckets;
  if (b) {
    if (b.auto.exhausted && b.auto.meter !== "not_applicable") labels.push("Auto included allowance");
    if (b.premium.exhausted && b.premium.meter !== "not_applicable")
      labels.push("Premium included allowance");
  }

  return labels;
}

export function notificationDedupeKey(summary: UsageSummaryResponse): string {
  return `viper_usage_limit_notified_${summary.pathKey}_${summary.month.firstDay}`;
}
