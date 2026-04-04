# Release review and pre-release verification

This document is the operator-facing runbook for tagging a release: what must pass, where configuration lives, and how to roll back risky behavior without code deploys. It reflects the repo as of Step Group H (H.45); it does not replace product marketing claims—see [§10 Cursor-Class readiness](CURSOR_COMPETITIVE_ROADMAP.md#10-acceptance-checklist-for-cursor-class-readiness) in the roadmap for honest gaps.

---

## 1. Pre-release verification (required)

From the **repository root**, the minimum bar before tagging a release is:

```bash
npm run quality-gate
```

**What this script runs** (chained, fail-fast order):

| Step | Command (conceptually) | Purpose |
|------|------------------------|---------|
| 1 | `check-types` on `@repo/workspace-tools` | TypeScript correctness for privacy/glob tooling used in agents |
| 2 | `check-types` on `@repo/backend` | Backend compile |
| 3 | `npm test` — `workspace-tools` | Unit tests (e.g. privacy module) |
| 4 | `npm test` — `database` | DB package tests |
| 5 | `npm test` — `backend` | API, services, routes, integration tests |
| 6 | `npm test` — `@repo/eval-harness` | Harness self-tests |
| 7 | `npm run eval` — eval harness | Offline deterministic eval fixtures (pass-rate threshold) |

**Aliases:** `npm run release:check` is defined at the repo root as an alias of `npm run quality-gate` (same behavior, clearer name for release reviewers).

**Not included in `quality-gate` (run separately if you ship those surfaces):**

- Full monorepo `turbo run check-types` / `turbo run build` (desktop, web-app, all packages)
- End-to-end or manual QA of Electron `viper-desktop`

Document any extra gates your team requires in your internal runbook; this file stays repo-canonical.

---

## 2. Environment and operations (production-minded)

**Source of truth:** [`docs/ENV.md`](ENV.md) — do not duplicate full tables here.

**Summarize for operators:**

| Area | What to know |
|------|----------------|
| **Core** | `DATABASE_URL`, `OPENAI_API_KEY`, backend `PORT` / `HOST` as documented |
| **Entitlements / auth** | `VIPER_ENTITLEMENTS_ENFORCE`, workspace membership and `workspace_entitlements` — see F.30 sections in ENV |
| **Quota** | `VIPER_QUOTA_ENFORCE`, `monthly_request_quota` in flags, `VIPER_QUOTA_DEFAULT_MONTHLY_REQUESTS` |
| **Billing** | `VIPER_STRIPE_WEBHOOK_ENABLED`, `STRIPE_WEBHOOK_SECRET` / `VIPER_STRIPE_WEBHOOK_SECRET`, `VIPER_STRIPE_PRICE_ENTITLEMENTS` |
| **Usage UI** | `VIPER_USAGE_UI_ENABLED` for `/usage/summary` |
| **SLO ops** | `VIPER_SLO_OPS_ENABLED`, `VIPER_SLO_OPS_TOKEN`, `VIPER_SLO_ALERT_WEBHOOK_URL` |
| **Router shadow / rollout** | `VIPER_ROUTER_SHADOW_ENABLED`, `VIPER_ROUTER_POLICY_CANDIDATE_PCT` (H.44) |
| **Editor / assistants** | Inline completion, inline edit, git assistant, test assistant — each has its own `VIPER_*_ENABLED` kill-switch in ENV |
| **Privacy** | `.viper/privacy.json` at workspace root (G.40) |

Most product-facing HTTP features follow the **hidden-endpoint pattern**: when the kill-switch is off, routes return **404** so scanners do not discover them. Treat “unset” as **off** unless the ENV doc says otherwise.

---

## 3. Database and migrations

- **Location:** `packages/database/migrations/` (numbered SQL files, e.g. `001_…` through `014_…`).
- **Mirror:** `packages/database/schema.sql` reflects the intended full schema for reference.
- **Runtime:** The backend calls `runMigrations()` from `@repo/database` at startup when `DATABASE_URL` is set (see `apps/backend/src/server.ts`).

**Operator expectation:** Apply migrations (or let the backend migrate on boot) **before** relying on DB-backed features: usage events, rollups, entitlements, billing webhook idempotency, chat media, etc. If `DATABASE_URL` is unset, some features fall back to in-memory or reduced behavior as documented in ENV.

---

## 4. Observability

- **SLO catalog:** [`docs/SLO.md`](SLO.md) — SLIs, windows, error budgets, SQL runbook snippets.
- **Operational APIs (H.43):** [`docs/SLO.md`](SLO.md) §9 — `GET /ops/slo-snapshot`, `POST /ops/slo-check` (require `VIPER_SLO_OPS_ENABLED` and bearer token). Use for dashboards or cron; no Grafana deployment lives in this repo.
- **Workflow logs:** Backend emits structured `[workflow] <stage>` lines when debug flags are on; stages are enumerated in `apps/backend/src/types/workflow-log-schema.ts`.

**Webhooks / cron:** Set `VIPER_SLO_ALERT_WEBHOOK_URL` for SLO breach POSTs; schedule `POST /ops/slo-check` with `Authorization: Bearer …` per ENV.md. No new services are required for H.45.

---

## 5. Rollback mindset (no redeploy required for many flags)

Risky or experimental paths are designed to be **off by default** or **reversible via environment**:

1. **Unset or set to `0` / `false`** the relevant `VIPER_*` flag (see ENV.md).
2. **Restart** the backend process so `process.env` is re-read (module-level config snapshots load at process start).
3. **Expect 404** on optional routes when disabled—clients should treat that as “feature not available,” not as a server bug.

This pattern (F.34-style hidden endpoints) is intentional: production can disable Stripe webhooks, SLO ops, editor assistants, quota enforcement, etc., without rolling back a git tag—only config changes.

For **router candidate rollout** (H.44), set `VIPER_ROUTER_POLICY_CANDIDATE_PCT=0` or unset it to return all traffic to the live routing policy immediately.

---

## 6. Related documents

| Document | Role |
|----------|------|
| [`docs/ENV.md`](ENV.md) | Full variable reference |
| [`docs/SLO.md`](SLO.md) | SLOs and §9 ops interfaces |
| [`docs/EVAL.md`](EVAL.md) | Offline eval harness and fixtures |
| [`docs/CURSOR_COMPETITIVE_ROADMAP.md`](CURSOR_COMPETITIVE_ROADMAP.md) | Roadmap, H.42–H.45 status, §10 readiness |

---

## 7. Revision

| Date | Note |
|------|------|
| 2026-04 | Initial `docs/RELEASE.md` — H.45 |
