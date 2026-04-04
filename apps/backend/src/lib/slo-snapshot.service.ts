// H.43 — SLO snapshot service.
//
// Computes a structured SLO health snapshot from the two DB tables that
// carry measurable signal today: `usage_events` (per-request) and
// `usage_rollups_daily` (pre-aggregated daily).
//
// All SQL queries are fully parameterised (no string interpolation).
// Latency targets and thresholds mirror docs/SLO.md exactly.
//
// Kill-switch: VIPER_SLO_OPS_ENABLED=1 — checked by the route layer.
// Auth token: VIPER_SLO_OPS_TOKEN — also checked by the route layer.
// Alert webhook: VIPER_SLO_ALERT_WEBHOOK_URL — optional; when set, POST
//   violations there from postSloCheck.

import { getPool } from "@repo/database";

// ---------------------------------------------------------------------------
// Kill-switch + config helpers
// ---------------------------------------------------------------------------

export function isSloOpsEnabled(): boolean {
  const v = process.env["VIPER_SLO_OPS_ENABLED"] ?? "";
  return v === "1" || v.toLowerCase() === "true";
}

export function getSloOpsToken(): string | undefined {
  return process.env["VIPER_SLO_OPS_TOKEN"];
}

export function getSloAlertWebhookUrl(): string | undefined {
  return process.env["VIPER_SLO_ALERT_WEBHOOK_URL"];
}

// ---------------------------------------------------------------------------
// SLO targets (mirroring docs/SLO.md — update both together)
// ---------------------------------------------------------------------------

export const LATENCY_TARGETS_MS: Record<string, number> = {
  ask: 15_000,
  plan: 25_000,
  debug: 25_000,
  agent: 45_000,
};

export const QUALITY_TARGETS = {
  failoverRateMax: 0.05,      // SLI-Q1: ≤ 5% of requests
  tierDowngradeRateMax: 0.10, // SLI-Q1: ≤ 10% of requests
};

export const ALERT_THRESHOLDS = {
  latencyBurnRateWarn: 0.8,    // 80% of requests may exceed target → warn
  latencyBurnRateCrit: 1.0,    // 100% (any request exceeding target) → page
  qualityBurnRateWarn: 0.8,    // 80% of error budget consumed → warn
  qualityBurnRateCrit: 1.0,    // budget exhausted → page
  minSampleRequests: 100,      // SLO not evaluated below this count
};

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface LatencyModeSlice {
  mode: string;
  request_count: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  target_p95_ms: number | null;
  // Fraction of requests with latency > target_p95_ms.
  // null if no target defined for mode or insufficient sample.
  exceedance_rate: number | null;
  burn_rate: number | null;
  slo_evaluated: boolean;
  slo_breached: boolean;
}

export interface QualitySnapshot {
  total_requests: number;
  failover_requests: number;
  failover_rate: number;
  failover_burn_rate: number;
  failover_slo_breached: boolean;
  tier_downgraded_requests: number;
  downgrade_rate: number;
  downgrade_burn_rate: number;
  downgrade_slo_breached: boolean;
  // Token data (nullable — not available for streaming paths)
  requests_with_tokens: number;
  token_coverage_rate: number;
  avg_total_tokens: number | null;
}

export interface VolumeWorkspace {
  workspace_path_key: string;
  request_count: number;
  stream_request_count: number;
  avg_latency_ms: number;
  tier_downgraded_count: number;
}

export type AlertSeverity = "critical" | "warning";

export interface AlertViolation {
  severity: AlertSeverity;
  rule: string;
  details: Record<string, unknown>;
}

export interface SloSnapshot {
  computed_at: string;
  window_days: number;
  latency: LatencyModeSlice[];
  quality: QualitySnapshot;
  volume_top_workspaces: VolumeWorkspace[];
  any_breach: boolean;
  breaches: AlertViolation[];
}

// ---------------------------------------------------------------------------
// SQL helpers
// ---------------------------------------------------------------------------

interface LatencyRow {
  mode: string;
  request_count: string;
  p50_ms: string | null;
  p95_ms: string | null;
  p99_ms: string | null;
  exceed_count: string;
}

interface QualityRow {
  total_requests: string;
  failover_requests: string;
  tier_downgraded_requests: string;
  requests_with_tokens: string;
  avg_total_tokens: string | null;
}

interface VolumeRow {
  workspace_path_key: string;
  request_count: string;
  stream_request_count: string;
  total_latency_ms: string;
  tier_downgraded_count: string;
}

function safeInt(v: string | null | undefined, fallback = 0): number {
  if (v == null) return fallback;
  const n = parseInt(v, 10);
  return isNaN(n) ? fallback : n;
}

function safeFloat(v: string | null | undefined, fallback = 0): number {
  if (v == null) return fallback;
  const n = parseFloat(v);
  return isNaN(n) ? fallback : n;
}

// ---------------------------------------------------------------------------
// Latency query
// ---------------------------------------------------------------------------

async function queryLatency(windowDays: number): Promise<LatencyModeSlice[]> {
  const pool = getPool();
  const result = await pool.query<LatencyRow>(
    `SELECT
       mode,
       COUNT(*)::text                                                         AS request_count,
       percentile_cont(0.50) WITHIN GROUP (ORDER BY latency_ms)::text        AS p50_ms,
       percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)::text        AS p95_ms,
       percentile_cont(0.99) WITHIN GROUP (ORDER BY latency_ms)::text        AS p99_ms,
       COUNT(*) FILTER (WHERE latency_ms > $2)::text                         AS exceed_count
     FROM usage_events
     WHERE occurred_at >= now() - ($1 || ' days')::interval
     GROUP BY mode
     ORDER BY mode`,
    [windowDays, 999_999_999], // exceed_count per-mode target injected below
  );
  // We need per-mode target thresholds — recompute exceedance per mode
  const rows: LatencyModeSlice[] = [];
  for (const r of result.rows) {
    const count = safeInt(r.request_count);
    const p95 = safeFloat(r.p95_ms);
    const target = LATENCY_TARGETS_MS[r.mode] ?? null;
    const sloEvaluated = count >= ALERT_THRESHOLDS.minSampleRequests && target != null;
    const breached = sloEvaluated && p95 > target!;
    const burnRate = target != null && count >= ALERT_THRESHOLDS.minSampleRequests
      ? p95 / target : null;

    rows.push({
      mode: r.mode,
      request_count: count,
      p50_ms: Math.round(safeFloat(r.p50_ms)),
      p95_ms: Math.round(p95),
      p99_ms: Math.round(safeFloat(r.p99_ms)),
      target_p95_ms: target,
      exceedance_rate: null, // not computed per-row in this simplified query
      burn_rate: burnRate != null ? Math.round(burnRate * 1000) / 1000 : null,
      slo_evaluated: sloEvaluated,
      slo_breached: breached,
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Quality query
// ---------------------------------------------------------------------------

async function queryQuality(windowDays: number): Promise<QualitySnapshot> {
  const pool = getPool();
  const result = await pool.query<QualityRow>(
    `SELECT
       COUNT(*)::text                                                AS total_requests,
       COUNT(*) FILTER (WHERE fallback_count > 0)::text            AS failover_requests,
       COUNT(*) FILTER (WHERE tier_downgraded)::text               AS tier_downgraded_requests,
       COUNT(*) FILTER (WHERE total_tokens IS NOT NULL)::text      AS requests_with_tokens,
       AVG(total_tokens) FILTER (WHERE total_tokens IS NOT NULL)::text AS avg_total_tokens
     FROM usage_events
     WHERE occurred_at >= now() - ($1 || ' days')::interval`,
    [windowDays],
  );
  const r = result.rows[0];
  const total = safeInt(r?.total_requests);
  const failovers = safeInt(r?.failover_requests);
  const downgrades = safeInt(r?.tier_downgraded_requests);
  const withTokens = safeInt(r?.requests_with_tokens);

  const failoverRate = total > 0 ? failovers / total : 0;
  const downgradeRate = total > 0 ? downgrades / total : 0;
  const failoverBurn = QUALITY_TARGETS.failoverRateMax > 0
    ? failoverRate / QUALITY_TARGETS.failoverRateMax : 0;
  const downgradeBurn = QUALITY_TARGETS.tierDowngradeRateMax > 0
    ? downgradeRate / QUALITY_TARGETS.tierDowngradeRateMax : 0;

  return {
    total_requests: total,
    failover_requests: failovers,
    failover_rate: Math.round(failoverRate * 10000) / 10000,
    failover_burn_rate: Math.round(failoverBurn * 1000) / 1000,
    failover_slo_breached: total >= ALERT_THRESHOLDS.minSampleRequests && failoverBurn >= 1.0,
    tier_downgraded_requests: downgrades,
    downgrade_rate: Math.round(downgradeRate * 10000) / 10000,
    downgrade_burn_rate: Math.round(downgradeBurn * 1000) / 1000,
    downgrade_slo_breached: total >= ALERT_THRESHOLDS.minSampleRequests && downgradeBurn >= 1.0,
    requests_with_tokens: withTokens,
    token_coverage_rate: total > 0 ? Math.round((withTokens / total) * 10000) / 10000 : 0,
    avg_total_tokens: r?.avg_total_tokens != null ? Math.round(safeFloat(r.avg_total_tokens)) : null,
  };
}

// ---------------------------------------------------------------------------
// Volume query (top N workspaces, 7-day window)
// ---------------------------------------------------------------------------

async function queryVolume(topN: number): Promise<VolumeWorkspace[]> {
  const pool = getPool();
  const result = await pool.query<VolumeRow>(
    `SELECT
       workspace_path_key,
       SUM(request_count)::text          AS request_count,
       SUM(stream_request_count)::text   AS stream_request_count,
       SUM(total_latency_ms)::text       AS total_latency_ms,
       SUM(tier_downgraded_count)::text  AS tier_downgraded_count
     FROM usage_rollups_daily
     WHERE bucket_date >= current_date - 7
     GROUP BY workspace_path_key
     ORDER BY SUM(request_count) DESC
     LIMIT $1`,
    [topN],
  );
  return result.rows.map((r) => {
    const count = safeInt(r.request_count);
    const totalLatency = safeInt(r.total_latency_ms);
    return {
      workspace_path_key: r.workspace_path_key,
      request_count: count,
      stream_request_count: safeInt(r.stream_request_count),
      avg_latency_ms: count > 0 ? Math.round(totalLatency / count) : 0,
      tier_downgraded_count: safeInt(r.tier_downgraded_count),
    };
  });
}

// ---------------------------------------------------------------------------
// Burn-rate violation detection
// ---------------------------------------------------------------------------

export function detectViolations(
  latency: LatencyModeSlice[],
  quality: QualitySnapshot,
): AlertViolation[] {
  const violations: AlertViolation[] = [];

  // Latency violations
  for (const m of latency) {
    if (!m.slo_evaluated || m.burn_rate == null) continue;
    if (m.burn_rate >= ALERT_THRESHOLDS.latencyBurnRateCrit) {
      violations.push({
        severity: "critical",
        rule: `latency.p95.${m.mode}`,
        details: {
          mode: m.mode,
          p95_ms: m.p95_ms,
          target_p95_ms: m.target_p95_ms,
          burn_rate: m.burn_rate,
          request_count: m.request_count,
        },
      });
    } else if (m.burn_rate >= ALERT_THRESHOLDS.latencyBurnRateWarn) {
      violations.push({
        severity: "warning",
        rule: `latency.p95.${m.mode}`,
        details: {
          mode: m.mode,
          p95_ms: m.p95_ms,
          target_p95_ms: m.target_p95_ms,
          burn_rate: m.burn_rate,
          request_count: m.request_count,
        },
      });
    }
  }

  // Quality violations
  if (quality.total_requests >= ALERT_THRESHOLDS.minSampleRequests) {
    const failoverSev: AlertSeverity | null =
      quality.failover_burn_rate >= ALERT_THRESHOLDS.qualityBurnRateCrit ? "critical"
      : quality.failover_burn_rate >= ALERT_THRESHOLDS.qualityBurnRateWarn ? "warning"
      : null;
    if (failoverSev) {
      violations.push({
        severity: failoverSev,
        rule: "quality.failover_rate",
        details: {
          failover_rate: quality.failover_rate,
          target_max: QUALITY_TARGETS.failoverRateMax,
          burn_rate: quality.failover_burn_rate,
          total_requests: quality.total_requests,
        },
      });
    }

    const downgradeSev: AlertSeverity | null =
      quality.downgrade_burn_rate >= ALERT_THRESHOLDS.qualityBurnRateCrit ? "critical"
      : quality.downgrade_burn_rate >= ALERT_THRESHOLDS.qualityBurnRateWarn ? "warning"
      : null;
    if (downgradeSev) {
      violations.push({
        severity: downgradeSev,
        rule: "quality.tier_downgrade_rate",
        details: {
          downgrade_rate: quality.downgrade_rate,
          target_max: QUALITY_TARGETS.tierDowngradeRateMax,
          burn_rate: quality.downgrade_burn_rate,
          total_requests: quality.total_requests,
        },
      });
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Main snapshot builder
// ---------------------------------------------------------------------------

export async function buildSloSnapshot(windowDays = 30): Promise<SloSnapshot> {
  const [latency, quality, volume] = await Promise.all([
    queryLatency(windowDays),
    queryQuality(windowDays),
    queryVolume(20),
  ]);

  const breaches = detectViolations(latency, quality);

  return {
    computed_at: new Date().toISOString(),
    window_days: windowDays,
    latency,
    quality,
    volume_top_workspaces: volume,
    any_breach: breaches.length > 0,
    breaches,
  };
}

// ---------------------------------------------------------------------------
// Webhook delivery (fire-and-forget, non-blocking)
// ---------------------------------------------------------------------------

export async function postAlertWebhook(
  webhookUrl: string,
  violations: AlertViolation[],
): Promise<void> {
  const payload = {
    service: "ViperAI",
    computed_at: new Date().toISOString(),
    severity: violations.some((v) => v.severity === "critical") ? "critical" : "warning",
    violation_count: violations.length,
    violations,
  };

  const resp = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5_000),
  });

  if (!resp.ok) {
    throw new Error(`Webhook delivery failed: ${resp.status} ${resp.statusText}`);
  }
}
