# ViperAI SLO Catalog — H.42

**Version:** 1.0  
**Effective:** 2026-04  
**Owner:** Platform engineering  
**Review cadence:** Quarterly, or after any major infra change

---

## 1. Scope

### In scope (v1)

| Surface | Endpoint | Notes |
|---|---|---|
| Chat (non-stream) | `POST /chat` | Primary synchronous path |
| Chat (stream) | `POST /chat/stream` | Primary streaming path; latency measured to first token via `workflowLog("request:complete", { latency_ms })` on the server side — **not** client-perceived |
| Editor inline edit | `POST /editor/inline-edit` | When `VIPER_INLINE_EDIT_ENABLED=1` |
| Editor inline completion | `POST /editor/inline-complete` | When `VIPER_INLINE_COMPLETION_ENABLED=1` |
| Git assistant | `POST /git/suggest-commit`, `POST /git/suggest-pr-body` | When `VIPER_COMMIT_ASSISTANT_ENABLED=1` |
| Test assistant | `POST /testing/suggest-commands`, `POST /testing/triage-failure` | When `VIPER_TEST_ASSISTANT_ENABLED=1` |
| Billing webhook | `POST /webhooks/stripe` | When `VIPER_STRIPE_WEBHOOK_ENABLED=1` |

### Out of scope (v1 — document deferrals)

- **Client-perceived latency** on the desktop (Electron IPC, render time, Monaco paint) — no telemetry path exists yet.
- **Exact dollar spend** per workspace — requires Stripe / OpenAI billing API integration (post-F.35).
- **Agent tool accuracy** (whether the LLM used the right tool, whether the file diff was correct) — requires human or LLM-as-judge evaluation (G.41 Tier B, not yet wired).
- **Per-user SLOs** — entitlements exist (F.30) but per-user dashboards are not implemented.
- **Browser runner** (`browser:*` stages) — sessions are ephemeral; Playwright-level timing not persisted.
- **Background analysis** (`analysis:background:*`) — fire-and-forget job, not on the critical path.

---

## 2. Signal inventory

All SLOs below are grounded in the signals the codebase actually emits today.

### 2.1 `usage_events` table (F.31)

Primary per-request record. Written by `recordUsageEvent()` in `apps/backend/src/lib/usage-events.ts` on successful completion of `POST /chat` and `POST /chat/stream`.

| Column | Type | Notes |
|---|---|---|
| `latency_ms` | `integer` | End-to-end server time from `request:start` to `request:complete` (wall clock in the Fastify handler). For streams, this is total stream duration, not TTFT. |
| `tier_downgraded` | `boolean` | `true` when requested tier was reduced by the model router |
| `fallback_count` | `integer` | Number of model failovers within the request (D.18) |
| `mode` | `text` | `ask`, `plan`, `debug`, or `agent` |
| `intent` | `text` | Intent classification result |
| `metadata.stream` | `boolean` (JSONB) | `true` for `POST /chat/stream` |
| `input_tokens` | `integer` (nullable) | Null for streaming responses (OpenAI stream-usage not yet wired) |
| `output_tokens` | `integer` (nullable) | Same caveat |
| `total_tokens` | `integer` (nullable) | Same caveat |
| `effective_model_tier` | `text` | `auto`, `premium`, or `fast` after downgrade resolution |

**Presence in DB = success proxy**: a row in `usage_events` means the request completed without a hard error. Absence (when `VIPER_USAGE_EVENTS=1`) means the request failed before completion.

### 2.2 `usage_rollups_daily` table (F.32)

Pre-aggregated per `(bucket_date, workspace_path_key)`. Updated by the daily aggregation job (`npm run aggregate-usage`).

| Column | Derivation |
|---|---|
| `request_count` | Total completed requests for that day |
| `stream_request_count` | Subset where `metadata->>'stream' = 'true'` |
| `total_latency_ms` | Sum — divide by `request_count` for average |
| `tier_downgraded_count` | Requests where model router downgraded tier |
| `sum_fallback_count` | Total model failover events |
| `mode_breakdown` | JSONB `{mode → count}` |
| `model_breakdown` | JSONB `{final_model_id → count}` |

### 2.3 `workflowLog` stdout (structured JSON, not persisted in DB)

Emitted as structured JSON to stdout at every stage. Currently not persisted to a time-series store — consumption requires log scraping (e.g. via a log aggregator). The `request:complete` event carries `latency_ms`.

Key events for SLO computation:

| Stage | When emitted | SLO relevance |
|---|---|---|
| `request:start` | Begin of every `/chat` request | Start-of-request marker |
| `request:complete` | End of successful `/chat` request | Contains `latency_ms`; paired with `request:start` for latency |
| `usage:event:emitted` | After `insertUsageEvent` succeeds | Confirms persistence; paired count vs `request:complete` for success rate |
| `usage:event:skipped` | `VIPER_USAGE_EVENTS` is off | Not a failure; informational |
| `quota:check` | F.33 quota gate | `status` field: `ok`, `soft_warning`, `hard_deny` |
| `entitlement:checked` | F.30 entitlement gate | Presence = auth overhead |
| `entitlement:denied` | F.30 denial | Counted for policy health SLO |
| `model:route:fallback` | D.18 model failover | Counts toward failover rate |
| `model:tier:denied` | Model tier downgrade | Counted for cost/policy SLO |
| `privacy:path:blocked` | G.40 privacy gate | Counted for safety SLO |
| `edit-gate:blocked` | Context-edit gate | Policy enforcement health |
| `billing:webhook:applied` | F.34 webhook success | Billing pipeline health |
| `billing:webhook:duplicate` | Duplicate delivery | Normal; monitored for anomalies |

---

## 3. SLO definitions

### 3.1 Pillar 1 — Latency

#### SLI-L1: Chat request p95 latency

**What we measure:** The `latency_ms` column in `usage_events`, representing the total server-side wall-clock time from when the Fastify handler begins processing to when the response is complete. For streams this is the total streaming duration (first-byte to last-byte on the server). For non-streams it is the full round-trip on the server.

**Derivation query (30-day rolling):**
```sql
SELECT
  percentile_cont(0.50) WITHIN GROUP (ORDER BY latency_ms) AS p50_ms,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_ms,
  percentile_cont(0.99) WITHIN GROUP (ORDER BY latency_ms) AS p99_ms
FROM usage_events
WHERE occurred_at >= now() - INTERVAL '30 days';
```

**Targets:**

| Mode | p50 target | p95 target | Measurement window |
|---|---|---|---|
| `ask` (non-stream) | ≤ 5 s | ≤ 15 s | 30-day rolling |
| `agent` (stream) | ≤ 8 s | ≤ 45 s | 30-day rolling |
| `plan` / `debug` | ≤ 6 s | ≤ 25 s | 30-day rolling |
| Inline completion | ≤ 2 s | ≤ 6 s | 30-day rolling |
| Inline edit | ≤ 5 s | ≤ 20 s | 30-day rolling |
| Git/test assistant | ≤ 8 s | ≤ 30 s | 30-day rolling |

**Minimum sample size:** 100 completed requests per mode per window before the SLO is evaluated. Below this threshold the SLO is in "pending" state (no alert, no burn-rate computation).

**Known limitation:** `latency_ms` for streaming is total server-side stream duration, not time-to-first-token (TTFT). TTFT requires the `onToken` callback latency to be captured and persisted separately — deferred to H.43 instrumentation work.

---

#### SLI-L2: Inline completion p95 latency (feature gate)

Same derivation as SLI-L1 but filtered to editor endpoints (not in `usage_events` yet — these endpoints do not write usage events in G.36/G.37; latency must be scraped from workflowLog until a usage event write is added).

**Alternative measurement (today):** Scrape `workflowLog("editor:inline-complete:completed")` paired with `("editor:inline-complete:requested")` from stdout. Both carry `request_id` and timestamp.

---

### 3.2 Pillar 2 — Quality (successful completion rate)

#### SLI-Q1: Chat success rate

**Definition:** The fraction of `POST /chat` and `POST /chat/stream` requests that produce a `usage:event:emitted` workflowLog entry (= successfully completed and metered) relative to all requests that emitted `request:start`.

**Proxy query (from rollups, 30-day rolling):**
```sql
-- When VIPER_USAGE_EVENTS=1:
-- success = rows in usage_events / expected_requests (from server logs)
-- Simpler: compare request_count across days and look for gaps

SELECT
  SUM(request_count)                            AS completed,
  SUM(tier_downgraded_count)                    AS tier_downgrades,
  SUM(sum_fallback_count)                       AS total_failovers,
  1.0 * SUM(tier_downgraded_count)
        / NULLIF(SUM(request_count), 0)         AS downgrade_rate,
  1.0 * SUM(sum_fallback_count)
        / NULLIF(SUM(request_count), 0)         AS avg_failovers_per_request
FROM usage_rollups_daily
WHERE bucket_date >= current_date - 30;
```

**Targets:**

| SLI | Target | Window |
|---|---|---|
| Chat success rate (completed/started) | ≥ 99.0% | 30-day rolling |
| Model failover rate (`fallback_count > 0`) | ≤ 5% of requests | 30-day rolling |
| Tier downgrade rate | ≤ 10% of requests | 30-day rolling |

**Minimum sample size:** 500 requests per window.

**What "failure" means here:** A request that emits `request:start` but not `request:complete` (server crash, timeout, client disconnect). `ClientDisconnectedError` is excluded from the failure count (user-initiated). 5xx responses from the backend count as failures.

---

#### SLI-Q2: Tool-error rate (agentic mode)

**Definition:** Fraction of agentic requests (`mode = "agent"`) where `tool_call_count > 0` AND the request still completed successfully.

**Note:** The inverse — tool calls that failed mid-loop — is not directly measured today (tool errors are caught in `step-runner.ts` and surfaced as text, not as a structured failure event). This SLO is **pending** until `toolError` events are persisted.

**Target (future):** Tool-error rate ≤ 2% of agentic requests with tool calls.

---

#### SLI-Q3: Billing webhook processing success rate

**Definition:** Fraction of received Stripe webhooks that are successfully applied (`billing:webhook:applied`) relative to all received (`billing:webhook:received`).

**Targets:**

| SLI | Target | Window |
|---|---|---|
| Webhook success rate | ≥ 99.5% | 30-day rolling |
| Duplicate delivery rate | ≤ 20% | 30-day rolling (Stripe delivers at-least-once; up to 20% duplicates is normal) |

**Measurement:** Scrape workflowLog counts for `billing:webhook:received`, `billing:webhook:applied`, `billing:webhook:ignored`, `billing:webhook:duplicate`.

---

### 3.3 Pillar 3 — Safety / policy enforcement health

This pillar measures **policy system health**: whether the enforcement mechanisms are operating correctly, not whether users are misbehaving.

#### SLI-S1: Quota enforcement health

**Definition:** When `VIPER_QUOTA_ENFORCE=1`, the fraction of requests that receive a `quota:check` workflowLog event. A missing `quota:check` on a completed request (when enforcement is on) indicates a bug in the enforcement path.

**Target:** `quota:check` coverage = 100% of `request:complete` events when `VIPER_QUOTA_ENFORCE=1`.

**Secondary:** Hard-deny rate (`quota:check` with `status: hard_deny`). This is **informational**, not an alert condition — hard denials are correct behavior. Monitor for unexpected spikes (e.g. misconfigured quotas).

---

#### SLI-S2: Entitlement enforcement health

**Definition:** When `VIPER_ENTITLEMENTS_ENFORCE=1`, the fraction of requests where `entitlement:checked` is emitted before `request:complete`.

**Target:** Coverage = 100% of requests reaching the entitlement middleware when enforcement is on.

**Secondary:** `entitlement:denied` rate. Same note as quota — denials are expected; alert only on sudden spikes (> 5× baseline) that may indicate misconfiguration.

---

#### SLI-S3: Privacy policy enforcement coverage

**Definition:** When the privacy gate (G.40) is active, all file-read paths in workspace tools pass through `checkPrivacy()`. This is a **code-level invariant** (enforced in `read-file.tool.ts`, `edit-file.tool.ts`, `create-file.tool.ts`, `search-text.tool.ts`) rather than a runtime rate.

**Observable signal:** `privacy:path:blocked` workflowLog events. These are emitted when the execution engine (workspace.tool.ts) blocks a path. Monitor for:
- **Volume anomalies:** A sudden spike in `privacy:path:blocked` events may indicate a misconfigured `.viper/privacy.json` deny-glob that is too broad.
- **Zero events over a long period** (when the feature is enabled and files are being read): may indicate the privacy gate path was accidentally bypassed.

**Target:** No more than 1% of file reads should result in `privacy:path:blocked` under normal workloads (adjustable per workspace via config). Alert if blocked rate exceeds 10% in a 1-hour window (likely a misconfigured denyGlob).

---

#### SLI-S4: Model tier policy enforcement

**Definition:** `model:tier:denied` events relative to total requests. Monitors whether the tier-enforcement path is firing when expected.

**Target:** Tier downgrade rate ≤ 10% of requests over 30 days (see SLI-Q1 above). Alert if downgrade rate exceeds 50% in a 1-hour window (likely a misconfigured `VIPER_ALLOWED_MODEL_TIERS`).

---

### 3.4 Pillar 4 — Cost

#### SLI-C1: Token consumption rate (where available)

**Definition:** Average `total_tokens` per request, available only for **non-stream** paths where OpenAI returns a `usage` object. Streaming tokens are null in F.31 (deferred to a future streaming-usage instrumentation task).

**Derivation query:**
```sql
SELECT
  date_trunc('day', occurred_at AT TIME ZONE 'UTC') AS day_utc,
  AVG(total_tokens)          FILTER (WHERE total_tokens IS NOT NULL) AS avg_tokens_non_null,
  COUNT(*)                   FILTER (WHERE total_tokens IS NOT NULL) AS requests_with_tokens,
  COUNT(*)                                                           AS total_requests,
  1.0 * COUNT(*) FILTER (WHERE total_tokens IS NOT NULL)
      / NULLIF(COUNT(*), 0)                                         AS token_coverage_rate
FROM usage_events
WHERE occurred_at >= now() - INTERVAL '30 days'
GROUP BY 1
ORDER BY 1 DESC;
```

**Targets:**

| SLI | Target | Notes |
|---|---|---|
| Token coverage rate | N/A (informational for now) | Will become a gate when stream-usage is wired |
| Avg tokens/request (non-stream) | Alert if 7-day moving avg exceeds 3× the prior 30-day avg | Spike = runaway context or prompt-injection |

**Note:** Exact dollar cost requires mapping `final_model_id` to per-token pricing. This is not implemented in the codebase today (no price catalog). Use `model_breakdown` from rollups as a leading indicator of relative cost distribution.

---

#### SLI-C2: Request volume per workspace

**Definition:** Requests per workspace per day, derived from `usage_rollups_daily.request_count` per `workspace_path_key`.

**Target:** No hard threshold at the service level — this feeds into quota configuration (F.33 `monthly_request_quota` flag). Operators should set `monthly_request_quota` in `workspace_entitlements.flags` for cost-capped workspaces.

**Alert condition:** Any single workspace generating > 10× its 7-day rolling average in a single day (anomaly detection — may indicate abuse or a runaway agent loop).

---

#### SLI-C3: Model failover / degradation rate

**Definition:** Fraction of requests where `fallback_count > 0` (model failover fired, D.18). Failovers are more expensive than direct calls (additional latency + potential model cost difference).

**Derivation:** `sum_fallback_count / request_count` from `usage_rollups_daily`.

**Target:** Failover rate ≤ 5% of requests over 30 days.

---

## 4. Error budgets

### Formula

For any SLO expressed as a success rate (e.g. ≥ 99.0%):

```
error_budget_total    = (1 - target) × total_requests_in_window
error_budget_consumed = bad_requests_in_window
error_budget_remaining = error_budget_total - error_budget_consumed
burn_rate             = error_budget_consumed / error_budget_total
```

**Example:** Chat success rate target = 99.0%, 30-day window, 10,000 requests.
- Total error budget = 0.01 × 10,000 = **100 bad requests**
- If 80 failed: burn rate = 80/100 = **80%** (elevated but not exhausted)
- If 120 failed: burn rate = 120/100 = **120%** (exhausted — page)

### Burn-rate alerts (manual / on-call, v1)

Until a proper alerting pipeline is wired (H.43), operators should run the following queries manually or on a cron basis:

| Condition | Action |
|---|---|
| Burn rate > 100% (SLO exhausted) | Immediate investigation + incident declared |
| Burn rate > 80% in 24 hours | On-call review within 2 hours |
| p95 latency > 2× target for 1 hour | On-call review within 4 hours |
| Tier downgrade rate > 50% in 1 hour | Immediate — likely misconfigured `VIPER_ALLOWED_MODEL_TIERS` |
| Privacy blocked rate > 10% in 1 hour | Review `.viper/privacy.json` config |
| Billing webhook success rate < 95% in 24 hours | On-call review + Stripe dashboard check |

---

## 5. Measurement windows and minimum sample sizes

| SLO | Window | Min sample | Notes |
|---|---|---|---|
| SLI-L1 (latency p95) | 30-day rolling | 100 req/mode | Per-mode split |
| SLI-Q1 (success rate) | 30-day rolling | 500 req | Global |
| SLI-Q1 (failover rate) | 30-day rolling | 500 req | |
| SLI-Q3 (webhook health) | 30-day rolling | 50 webhooks | |
| SLI-S1 (quota coverage) | 24-hour | 10 req | Only when enforcement on |
| SLI-S3 (privacy coverage) | 1-hour | N/A (code-level) | Alert on anomalous spike |
| SLI-C1 (tokens) | 30-day rolling | 100 req with tokens | Token coverage ~0% on stream today |
| SLI-C3 (failover rate) | 30-day rolling | 500 req | |

---

## 6. SLO tracking queries (copy-paste runbook)

### Chat latency distribution (30 days)
```sql
SELECT
  mode,
  COUNT(*)                                                   AS requests,
  ROUND(AVG(latency_ms))                                     AS avg_ms,
  ROUND(percentile_cont(0.50) WITHIN GROUP (ORDER BY latency_ms)) AS p50_ms,
  ROUND(percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)) AS p95_ms,
  ROUND(percentile_cont(0.99) WITHIN GROUP (ORDER BY latency_ms)) AS p99_ms
FROM usage_events
WHERE occurred_at >= now() - INTERVAL '30 days'
GROUP BY mode
ORDER BY mode;
```

### Success and failover rates (30 days)
```sql
SELECT
  COUNT(*)                                                   AS total_requests,
  SUM(CASE WHEN fallback_count > 0 THEN 1 ELSE 0 END)       AS failover_requests,
  SUM(CASE WHEN tier_downgraded   THEN 1 ELSE 0 END)        AS downgraded_requests,
  ROUND(100.0 * SUM(CASE WHEN fallback_count > 0 THEN 1 ELSE 0 END)
        / NULLIF(COUNT(*), 0), 2)                           AS failover_rate_pct,
  ROUND(100.0 * SUM(CASE WHEN tier_downgraded THEN 1 ELSE 0 END)
        / NULLIF(COUNT(*), 0), 2)                           AS downgrade_rate_pct
FROM usage_events
WHERE occurred_at >= now() - INTERVAL '30 days';
```

### Daily request volume per workspace (last 30 rollup days)
```sql
SELECT
  bucket_date,
  workspace_path_key,
  request_count,
  stream_request_count,
  ROUND(total_latency_ms::numeric / NULLIF(request_count::numeric, 0)) AS avg_latency_ms,
  tier_downgraded_count,
  sum_fallback_count
FROM usage_rollups_daily
WHERE bucket_date >= current_date - 30
ORDER BY bucket_date DESC, request_count DESC;
```

### Token coverage and averages (30 days, non-stream only)
```sql
SELECT
  COUNT(*)                                                AS total_requests,
  COUNT(*) FILTER (WHERE total_tokens IS NOT NULL)       AS requests_with_tokens,
  ROUND(AVG(total_tokens) FILTER (WHERE total_tokens IS NOT NULL)) AS avg_total_tokens,
  ROUND(AVG(input_tokens) FILTER (WHERE input_tokens IS NOT NULL)) AS avg_input_tokens,
  ROUND(AVG(output_tokens) FILTER (WHERE output_tokens IS NOT NULL)) AS avg_output_tokens
FROM usage_events
WHERE occurred_at >= now() - INTERVAL '30 days'
  AND (metadata->>'stream')::boolean IS DISTINCT FROM true;
```

---

## 7. Non-goals (explicit deferrals)

The following are **out of scope** for v1 SLOs and will be addressed in subsequent steps:

| Deferred item | Earliest step |
|---|---|
| Time-to-first-token (TTFT) for streaming paths | H.43 — requires capturing first-token callback timestamp |
| Client-perceived end-to-end latency (Electron IPC + render) | H.43 — requires desktop telemetry agent |
| Per-user SLOs / per-user quota dashboards | Post-F.30 — auth/entitlement is functional but UI dashboards not built |
| Exact dollar spend per workspace | Requires OpenAI + Stripe billing API integration (post-F.35) |
| LLM output quality score (coherence, factual accuracy) | G.41 Tier B — LLM-as-judge eval not yet wired |
| Agent tool accuracy (correct tool selection, correct diff) | G.41 Tier B |
| Automated alerting / PagerDuty / Slack integration | H.43 — dashboards and alerting step |
| SLO burn-rate dashboards (Grafana / Datadog) | H.43 |
| Streaming token counting | Requires OpenAI streaming usage API wiring (F.32+ follow-up) |
| Cross-workspace aggregate SLOs | Requires multi-tenant aggregation view |
| Browser runner TTFP (time-to-first-pixel) | E.26 follow-up |

---

## 8. Revision history

| Date | Version | Change |
|---|---|---|
| 2026-04 | 1.0 | Initial catalog — H.42 |
| 2026-04 | 1.1 | Added §9 operational interfaces — H.43 |

---

## 9. Operational interfaces (H.43)

### 9.1 JSON snapshot API

**Endpoint:** `GET /ops/slo-snapshot`

**Kill-switch:** `VIPER_SLO_OPS_ENABLED=1` required (returns 404 when off).

**Auth:** `Authorization: Bearer <VIPER_SLO_OPS_TOKEN>` (returns 401 when token missing or wrong; returns 401 when `VIPER_SLO_OPS_TOKEN` is not configured).

**Response shape:**

```jsonc
{
  "computed_at": "2026-04-01T12:00:00.000Z",
  "window_days": 30,
  "latency": [
    {
      "mode": "agent",
      "request_count": 4800,
      "p50_ms": 18200,
      "p95_ms": 41000,
      "p99_ms": 60000,
      "target_p95_ms": 45000,
      "burn_rate": 0.911,   // actual_p95 / target_p95
      "slo_evaluated": true,
      "slo_breached": false
    }
  ],
  "quality": {
    "total_requests": 10000,
    "failover_requests": 320,
    "failover_rate": 0.032,
    "failover_burn_rate": 0.64,  // failover_rate / 0.05
    "failover_slo_breached": false,
    "tier_downgraded_requests": 500,
    "downgrade_rate": 0.05,
    "downgrade_burn_rate": 0.5,
    "downgrade_slo_breached": false,
    "requests_with_tokens": 2000,
    "token_coverage_rate": 0.2,
    "avg_total_tokens": 820
  },
  "volume_top_workspaces": [
    {
      "workspace_path_key": "sha256-prefix...",
      "request_count": 1200,
      "stream_request_count": 900,
      "avg_latency_ms": 14800,
      "tier_downgraded_count": 22
    }
  ],
  "any_breach": false,
  "breaches": []
}
```

**Quick check:**

```bash
VIPER_SLO_OPS_ENABLED=1 VIPER_SLO_OPS_TOKEN=secret \
  node -e "require('./apps/backend/dist/server.js')" &
curl -s -H "Authorization: Bearer secret" \
  http://localhost:4000/ops/slo-snapshot | jq .any_breach
```

### 9.2 Alerting endpoint

**Endpoint:** `POST /ops/slo-check`

Same kill-switch and auth as `GET /ops/slo-snapshot`.

Runs the same snapshot computation, checks SLI values against the alert thresholds in §4, and:

1. Emits `slo:alert:fired` (workflowLog) when violations found; `slo:check:ok` otherwise.
2. POSTs violations to `VIPER_SLO_ALERT_WEBHOOK_URL` when configured.

**Response:**

```jsonc
// No violations
{ "ok": true, "computed_at": "...", "violations": [] }

// Violations found
{
  "ok": false,
  "computed_at": "...",
  "violation_count": 2,
  "violations": [
    { "severity": "critical", "rule": "latency.p95.agent", "details": { ... } },
    { "severity": "warning",  "rule": "quality.failover_rate", "details": { ... } }
  ]
}
```

### 9.3 Running on a cron

Add to your scheduler (e.g. cron, GitHub Actions scheduled workflow, systemd timer):

```bash
#!/usr/bin/env bash
set -euo pipefail
RESULT=$(curl -sf -X POST \
  -H "Authorization: Bearer ${VIPER_SLO_OPS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{}' \
  "${VIPER_BACKEND_URL}/ops/slo-check")
OK=$(echo "$RESULT" | jq -r .ok)
if [ "$OK" != "true" ]; then
  echo "SLO breach detected:" >&2
  echo "$RESULT" | jq .violations >&2
  exit 1
fi
echo "SLO check passed"
```

Set `VIPER_SLO_ALERT_WEBHOOK_URL` to a Slack incoming webhook, PagerDuty Events API v2 endpoint, or any generic HTTPS webhook to receive structured alerts automatically.

### 9.4 Alert thresholds summary

These values are hardcoded in `apps/backend/src/lib/slo-snapshot.service.ts` and mirror §4 of this document:

| Condition | Threshold | Severity |
|---|---|---|
| Latency burn rate (`actual_p95 / target_p95`) | ≥ 1.0 | critical |
| Latency burn rate | ≥ 0.8 | warning |
| Quality failover burn rate | ≥ 1.0 | critical |
| Quality failover burn rate | ≥ 0.8 | warning |
| Quality tier-downgrade burn rate | ≥ 1.0 | critical |
| Quality tier-downgrade burn rate | ≥ 0.8 | warning |
| Minimum sample size for SLO evaluation | 100 requests | — |

### 9.5 Deferrals from H.43

- **Grafana / Datadog dashboards:** connect to the JSON snapshot API above; use `curl` + `jq` for now.
- **PagerDuty / Opsgenie OAuth:** use the generic `VIPER_SLO_ALERT_WEBHOOK_URL` with PagerDuty Events v2 or Opsgenie alert API.
- **TTFT (time-to-first-token):** requires capturing first-token callback in the streaming path; deferred to H.44+.
- **Client-side (Electron) telemetry:** still deferred per §7 above.
