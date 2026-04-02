/**
 * F.35 — Usage & plan panel.
 *
 * Shows month-to-date request count, quota limit / remaining, and a read-only
 * entitlement snapshot for the current workspace.
 *
 * Panel states:
 *   loading   — spinner while fetching
 *   disabled  — backend returned 404 (VIPER_USAGE_UI_ENABLED not set); hidden
 *   error     — fetch failed (network, 401/403, 500)
 *   data      — render usage meter + entitlements
 *
 * Design: matches Viper IDE sidebar style (viper-sidebar bg, viper-border,
 * viper-accent color vars; typography from extensions-sidebar.tsx).
 */

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Loader2,
  BarChart3,
  Infinity as InfinityIcon,
  AlertCircle,
  CheckCircle2,
  CreditCard,
} from "lucide-react";
import {
  fetchUsageSummary,
  type UsageSummaryResponse,
} from "../services/agent-api.js";

interface UsagePanelProps {
  workspacePath: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(s: string): string {
  const n = parseInt(s, 10);
  if (Number.isNaN(n)) return s;
  return n.toLocaleString();
}

function percentage(used: string, limit: string): number {
  const u = parseInt(used, 10);
  const l = parseInt(limit, 10);
  if (l === 0) return 100;
  return Math.min(100, Math.round((u / l) * 100));
}

function usageBarColor(pct: number): string {
  if (pct >= 100) return "#ef4444"; // red
  if (pct >= 80) return "#f59e0b";  // amber
  return "var(--viper-accent)";      // green
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UsagePanel({ workspacePath }: UsagePanelProps) {
  const [data, setData] = useState<UsageSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disabled, setDisabled] = useState(false);

  const load = useCallback(async () => {
    if (!workspacePath) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchUsageSummary(workspacePath);
      if (result === null) {
        // 404 → endpoint disabled; hide panel gracefully
        setDisabled(true);
        setData(null);
      } else {
        setDisabled(false);
        setData(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load usage data.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [workspacePath]);

  useEffect(() => {
    void load();
  }, [load]);

  // When disabled, render nothing (panel does not clutter UI)
  if (disabled) return null;

  // ---------------------------------------------------------------------------
  // Header shared by all states
  // ---------------------------------------------------------------------------
  const header = (
    <div
      className="flex items-center h-9 px-2 flex-shrink-0 border-b"
      style={{ borderColor: "var(--viper-border)" }}
    >
      <BarChart3 size={13} className="mr-1.5 text-[var(--viper-accent)]" />
      <span className="text-[11px] font-medium uppercase tracking-wider text-[#9ca3af] mr-auto">
        Usage &amp; Plan
      </span>
      <button
        type="button"
        className="p-1 rounded text-[#6b7280] hover:text-[#e5e7eb] hover:bg-white/5 disabled:opacity-40"
        title="Refresh"
        disabled={loading}
        onClick={() => void load()}
      >
        {loading
          ? <Loader2 size={12} className="animate-spin" />
          : <RefreshCw size={12} />}
      </button>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  if (loading && !data) {
    return (
      <div className="flex flex-col flex-shrink-0" style={{ background: "var(--viper-sidebar)" }}>
        {header}
        <div className="px-3 py-4 flex items-center gap-2 text-[#6b7280]">
          <Loader2 size={14} className="animate-spin" />
          <span className="text-xs">Loading usage…</span>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------
  if (error) {
    return (
      <div className="flex flex-col flex-shrink-0" style={{ background: "var(--viper-sidebar)" }}>
        {header}
        <div
          className="mx-2 my-2 px-2 py-1.5 rounded flex items-start gap-1.5"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
        >
          <AlertCircle size={12} className="text-red-400 mt-0.5 shrink-0" />
          <p className="text-[10px] text-red-400 leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // No data yet (before first load)
  // ---------------------------------------------------------------------------
  if (!data) return null;

  const pct = data.limit ? percentage(data.usedRequests, data.limit) : null;
  const barColor = pct !== null ? usageBarColor(pct) : "var(--viper-accent)";

  const modes = data.entitlements.allowed_modes;
  const tiers = data.entitlements.allowed_model_tiers;

  // ---------------------------------------------------------------------------
  // Data state
  // ---------------------------------------------------------------------------
  return (
    <div
      className="flex flex-col flex-shrink-0"
      style={{ background: "var(--viper-sidebar)" }}
    >
      {header}

      <div className="px-3 pt-2.5 pb-3 flex flex-col gap-3">

        {/* Month label */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#6b7280]">
            {data.month.firstDay} – {data.month.lastDay}
          </span>
          {data.stripe && (
            <span className="flex items-center gap-1 text-[9px] text-emerald-400/80">
              <CreditCard size={9} />
              Subscribed
            </span>
          )}
        </div>

        {/* Usage counter */}
        <div className="flex flex-col gap-1">
          <div className="flex items-end justify-between">
            <span className="text-[11px] font-semibold text-[#e5e7eb]">
              {formatNumber(data.usedRequests)}
              <span className="text-[10px] font-normal text-[#6b7280] ml-1">requests</span>
            </span>
            {data.limit ? (
              <span className="text-[10px] text-[#9ca3af]">
                / {formatNumber(data.limit)} limit
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] text-[#6b7280]">
                <InfinityIcon size={11} />
                unlimited
              </span>
            )}
          </div>

          {/* Progress bar (only when there's a limit) */}
          {data.limit && (
            <div
              className="w-full h-1 rounded-full overflow-hidden"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct ?? 0}%`, background: barColor }}
              />
            </div>
          )}

          {/* Remaining */}
          {data.remaining !== null && (
            <p className="text-[10px] text-[#6b7280]">
              {formatNumber(data.remaining)} remaining this month
            </p>
          )}
        </div>

        {/* Divider */}
        <div className="border-t" style={{ borderColor: "var(--viper-border)" }} />

        {/* Entitlements */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-medium text-[#9ca3af] uppercase tracking-wider">
            Entitlements
          </span>

          <EntitlementRow
            label="Modes"
            values={modes}
            allLabel="All modes"
          />
          <EntitlementRow
            label="Model tiers"
            values={tiers}
            allLabel="All tiers"
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small helper row
// ---------------------------------------------------------------------------

function EntitlementRow({
  label,
  values,
  allLabel,
}: {
  label: string;
  values: string[] | null;
  allLabel: string;
}) {
  return (
    <div className="flex items-start gap-1.5">
      <CheckCircle2 size={10} className="text-emerald-400 mt-0.5 shrink-0" />
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[10px] text-[#6b7280]">{label}</span>
        {values === null || values.length === 0 ? (
          <span className="text-[10px] text-[#9ca3af]">{allLabel}</span>
        ) : (
          <div className="flex flex-wrap gap-0.5">
            {values.map((v) => (
              <span
                key={v}
                className="text-[9px] px-1 py-0.5 rounded"
                style={{
                  background: "rgba(34,197,94,0.1)",
                  border: "1px solid rgba(34,197,94,0.2)",
                  color: "var(--viper-accent)",
                }}
              >
                {v}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
