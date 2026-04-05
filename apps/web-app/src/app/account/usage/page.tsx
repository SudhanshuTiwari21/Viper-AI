"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import { Button } from "@/components/ui/button";
import { readAccessToken } from "@/lib/auth-client";
import {
  fetchUsageSummary,
  listExhaustedUsageLabels,
  notificationDedupeKey,
  type UsageBucketMeterSnapshot,
  type UsageSummaryResponse,
} from "@/lib/usage-summary-api";
import { AlertCircle, BarChart3, Bell, Loader2, RefreshCw } from "lucide-react";

const WORKSPACE_PATH_STORAGE_KEY = "viper_account_usage_workspace_path";

function formatNum(s: string): string {
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? s : n.toLocaleString();
}

function barColor(pct: number): string {
  if (pct >= 100) return "#ef4444";
  if (pct >= 80) return "#f59e0b";
  return "#22c55e";
}

function bucketBarColor(bucket: Pick<UsageBucketMeterSnapshot, "exhausted" | "showWarning">): string {
  if (bucket.exhausted) return "#ef4444";
  if (bucket.showWarning) return "#f59e0b";
  return "#22c55e";
}

function BucketRow({ title, bucket }: { title: string; bucket: UsageBucketMeterSnapshot }) {
  if (bucket.meter === "not_applicable") {
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
        <p className="text-xs font-medium text-white/90">{title}</p>
        <p className="text-[11px] text-white/45 mt-0.5">Not applicable for this plan</p>
      </div>
    );
  }

  if (bucket.meter === "unlimited") {
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
        <p className="text-xs font-medium text-white/90">{title}</p>
        <p className="text-[11px] text-white/45 mt-0.5">Unlimited</p>
      </div>
    );
  }

  const pct = bucket.limit ? Math.min(100, bucket.percentUsed) : 0;
  const color = bucketBarColor(bucket);

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 space-y-1.5">
      <div className="flex items-end justify-between gap-2">
        <p className="text-xs font-medium text-white/90">{title}</p>
        {bucket.limit ? (
          <span className="text-[11px] text-white/50 shrink-0">
            {formatNum(bucket.used)} / {formatNum(bucket.limit)}
          </span>
        ) : null}
      </div>
      {bucket.limit ? (
        <div className="h-1.5 w-full rounded-full bg-white/[0.08] overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
        </div>
      ) : null}
      {bucket.remaining !== null ? (
        <p className="text-[11px] text-white/45">{formatNum(bucket.remaining)} remaining this month</p>
      ) : null}
    </div>
  );
}

export default function AccountUsagePage() {
  const [token, setToken] = useState<string | null>(null);
  const [pathInput, setPathInput] = useState("");
  const [summary, setSummary] = useState<UsageSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [endpointDisabled, setEndpointDisabled] = useState(false);
  const [alertsOn, setAlertsOn] = useState(false);
  const [alertStatus, setAlertStatus] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setToken(readAccessToken());
      try {
        const saved = localStorage.getItem(WORKSPACE_PATH_STORAGE_KEY);
        if (saved) setPathInput(saved);
      } catch {
        /* ignore */
      }
    });
  }, []);

  const load = useCallback(async () => {
    const p = pathInput.trim();
    if (!p) {
      setError("Enter the workspace folder path (the same path Viper Desktop uses for this project).");
      return;
    }
    setLoading(true);
    setError(null);
    setEndpointDisabled(false);
    try {
      localStorage.setItem(WORKSPACE_PATH_STORAGE_KEY, p);
    } catch {
      /* ignore */
    }
    const result = await fetchUsageSummary(p, token);
    if (!result.ok) {
      setSummary(null);
      if (result.disabled) setEndpointDisabled(true);
      setError(result.error);
      return;
    }
    setSummary(result.data);
  }, [pathInput, token]);

  useEffect(() => {
    if (!alertsOn || !summary || typeof window === "undefined") return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;

    const labels = listExhaustedUsageLabels(summary);
    if (labels.length === 0) return;

    const key = notificationDedupeKey(summary);
    try {
      if (localStorage.getItem(key)) return;
      const body =
        labels.length === 1
          ? `${labels[0]} is fully used for this billing month.`
          : `Fully used this month: ${labels.join(", ")}.`;
      new Notification("Viper — usage limit reached", { body, icon: "/VIPER.svg" });
      localStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
  }, [alertsOn, summary]);

  useEffect(() => {
    if (!alertsOn || !summary) return;
    const id = window.setInterval(() => {
      void load();
    }, 90_000);
    return () => window.clearInterval(id);
  }, [alertsOn, summary, load]);

  async function requestNotificationPermission() {
    setAlertStatus(null);
    if (typeof Notification === "undefined") {
      setAlertStatus("This browser does not support notifications.");
      return;
    }
    const p = await Notification.requestPermission();
    if (p === "granted") {
      setAlertsOn(true);
      setAlertStatus("Alerts enabled. We’ll notify once per month when a limit is reached.");
    } else {
      setAlertStatus("Permission was not granted.");
    }
  }

  const lim = summary?.limit != null ? parseInt(summary.limit, 10) : 0;
  const requestPct =
    summary?.limit != null && lim > 0
      ? Math.min(100, Math.round((parseInt(summary.usedRequests, 10) / lim) * 100))
      : null;

  return (
    <div className="relative flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 px-4 sm:px-8 py-20">
        <div className="mx-auto max-w-2xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/40 mb-3">Account</p>
          <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-white mb-3">Usage &amp; allowance</h1>
          <p className="text-sm text-white/50 leading-relaxed mb-8">
            Usage is tracked per{" "}
            <strong className="text-white/70 font-medium">workspace path</strong> (the folder you open in Viper
            Desktop). Paste that absolute path here to see included Auto / Premium pools and monthly request totals.
            {token ? null : (
              <>
                {" "}
                <Link href="/login" className="text-white underline-offset-4 hover:underline">
                  Sign in
                </Link>{" "}
                if your org enforces workspace membership — the same session as the desktop app.
              </>
            )}
          </p>

          <div className="rounded-xl border border-white/15 bg-white/[0.03] p-4 sm:p-5 space-y-4">
            <label className="block">
              <span className="text-xs font-medium text-white/60">Workspace path</span>
              <input
                value={pathInput}
                onChange={(e) => setPathInput(e.target.value)}
                placeholder="/Users/you/projects/my-repo"
                className="mt-1.5 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/30"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className="h-9 gap-2 bg-white text-black hover:bg-white/90"
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : <BarChart3 className="size-4" />}
                Load usage
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void load()}
                disabled={loading || !pathInput.trim()}
                className="h-9 gap-2 border-white/20 text-white hover:bg-white/10"
              >
                <RefreshCw className="size-4" />
                Refresh
              </Button>
            </div>

            {endpointDisabled ? (
              <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            ) : error ? (
              <div className="flex gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100/90">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            ) : null}

            {summary?.usageBilling?.showComposerUsageHint && summary.usageBilling.composerHint ? (
              <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-[13px] text-amber-100/90 leading-snug">
                {summary.usageBilling.composerHint}
              </div>
            ) : null}

            {summary ? (
              <div className="space-y-4 pt-2 border-t border-white/10">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-white/40 uppercase tracking-wider">
                    {summary.month.firstDay} — {summary.month.lastDay} (UTC month)
                  </p>
                  {summary.stripe ? (
                    <span className="text-[10px] font-medium text-emerald-400/85">Billing linked</span>
                  ) : null}
                </div>

                <div>
                  <p className="text-xs font-medium text-white/70 mb-2">Chat requests</p>
                  <div className="flex items-end justify-between gap-2 mb-1.5">
                    <span className="text-lg font-medium text-white">{formatNum(summary.usedRequests)}</span>
                    {summary.limit ? (
                      <span className="text-xs text-white/45">/ {formatNum(summary.limit)} limit</span>
                    ) : (
                      <span className="text-xs text-white/45">Unlimited</span>
                    )}
                  </div>
                  {summary.limit && requestPct !== null ? (
                    <div className="h-1.5 w-full rounded-full bg-white/[0.08] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${requestPct}%`,
                          background: barColor(requestPct),
                        }}
                      />
                    </div>
                  ) : null}
                  {summary.remaining !== null ? (
                    <p className="text-[11px] text-white/45 mt-1">{formatNum(summary.remaining)} remaining</p>
                  ) : null}
                </div>

                {summary.usageBilling ? (
                  <div>
                    <p className="text-xs font-medium text-white/70 mb-2">Included allowance (Auto / Premium)</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <BucketRow title="Auto" bucket={summary.usageBilling.buckets.auto} />
                      <BucketRow title="Premium" bucket={summary.usageBilling.buckets.premium} />
                    </div>
                  </div>
                ) : null}

                <div>
                  <p className="text-xs font-medium text-white/70 mb-2">Entitlements</p>
                  <div className="flex flex-wrap gap-1.5">
                    {summary.entitlements.allowed_modes === null ||
                    summary.entitlements.allowed_modes.length === 0 ? (
                      <span className="text-[11px] text-white/45">All modes</span>
                    ) : (
                      summary.entitlements.allowed_modes.map((m) => (
                        <span
                          key={m}
                          className="text-[10px] px-2 py-0.5 rounded-md border border-emerald-500/25 text-emerald-200/90"
                        >
                          {m}
                        </span>
                      ))
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {summary.entitlements.allowed_model_tiers === null ||
                    summary.entitlements.allowed_model_tiers.length === 0 ? (
                      <span className="text-[11px] text-white/45">All model tiers</span>
                    ) : (
                      summary.entitlements.allowed_model_tiers.map((m) => (
                        <span
                          key={m}
                          className="text-[10px] px-2 py-0.5 rounded-md border border-emerald-500/25 text-emerald-200/90"
                        >
                          {m}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-black/30 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-white/80">
                    <Bell className="size-4 text-white/50" />
                    <span className="text-sm font-medium">Browser alerts at 100%</span>
                  </div>
                  <p className="text-[11px] text-white/45 leading-relaxed">
                    Get one notification per UTC month when included allowance or monthly request quota is fully used.
                    We only ping once per workspace per month.
                  </p>
                  {typeof Notification !== "undefined" && Notification.permission === "granted" ? (
                    <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={alertsOn}
                        onChange={(e) => setAlertsOn(e.target.checked)}
                        className="rounded border-white/30"
                      />
                      Poll every 90s while this tab is open
                    </label>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void requestNotificationPermission()}
                      className="border-white/20 text-white hover:bg-white/10"
                    >
                      Enable browser notifications
                    </Button>
                  )}
                  {alertStatus ? <p className="text-[11px] text-white/50">{alertStatus}</p> : null}
                </div>
              </div>
            ) : null}
          </div>

          <p className="mt-8 text-xs text-white/35 leading-relaxed">
            Limits reset on the UTC month boundary shown above. For plan changes, see{" "}
            <Link href="/pricing" className="text-white/55 hover:text-white/80 underline-offset-4 hover:underline">
              Pricing
            </Link>
            .
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
