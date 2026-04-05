# Environment variables

## Where to set them

- **Root:** Create a `.env` at the repo root (copy from `.env.example`). Many tools and apps load this by default.
- **Per app:** If you run an app from a subdirectory (e.g. `packages/agents/codebase-analysis-agent`), you can put a `.env` there, or ensure the root `.env` is loaded (e.g. via `dotenv` or your runtime).

## Variables

| Variable        | Where it's used | Required | Default |
|----------------|------------------|----------|---------|
| `DATABASE_URL` | `packages/database` – `getPool()` in `database.service.ts` | No (has default) | `postgresql://localhost:5432/viper` |
| `VIPER_ALLOWED_MODEL_TIERS` | D.20: backend `workflow-flags` — comma-separated subset of `auto`, `fast`, `premium` for server-side tier entitlements | No | `auto,fast,premium` (all) |
| `VIPER_PREMIUM_REQUIRES_ENTITLEMENT` | D.20: when `true`, **premium** is removed from the entitled set unless `VIPER_PREMIUM_ENTITLED` allows it | No | `false` |
| `VIPER_PREMIUM_ENTITLED` | D.20: when premium entitlement gate is on, `false`/`0` disallows premium (downgrade to next allowed tier) | No | `true` (premium allowed if gate on) |
| `VIPER_MODEL_TELEMETRY` | D.21: `1` emits a structured JSON line to stdout per request with route outcome telemetry (model IDs, failover, tier, latency). Suitable for ops scraping without full debug mode. | No | off |
| `VIPER_MEDIA_STORAGE_DIR` | E.23: absolute or relative path for local-disk media bytes (images uploaded via `POST /media/upload`). Created automatically. Only used when `DATABASE_URL` is set (in-memory mode skips disk). | No | `<os.tmpdir()>/.viper-media` |
| `VIPER_MEDIA_TTL_HOURS` | E.23: if set to a positive number, uploaded media objects receive an `expires_at` timestamp (now + N hours). `GET /media/:mediaId` returns **410 Gone** for expired objects. No automatic cleanup job runs — call `listExpiredChatMedia()` from the database repository for a manual sweep. | No | unset (no TTL) |
| `VIPER_BROWSER_TOOLS` | E.26: `1` or `true` to enable browser runner tools (`browser_navigate`, `browser_screenshot`, `browser_assert_text`, `browser_wait_for_selector`, `browser_run_recipe`) in the agentic loop. Default **off** — set this to expose browser tools to the agent. Also requires `npx playwright install chromium`. | No | off |
| `VIPER_BROWSER_ALLOWED_ORIGINS` | E.26: comma-separated list of additional allowed URL origins for browser navigation (e.g. `https://staging.example.com,http://dev.local:8080`). Only `http(s)://localhost` and `http(s)://127.0.0.1` are allowed by default. `file:`, `data:`, `javascript:`, `blob:` are always blocked. | No | unset (loopback only) |
| `VIPER_BROWSER_SESSION_TIMEOUT_MS` | E.26: max lifetime (ms) of a browser session before it is force-closed. | No | `300000` (5 min) |
| `VIPER_BROWSER_NAV_TIMEOUT_MS` | E.26: per-navigation timeout (ms) passed to Playwright's `page.goto`. | No | `30000` (30 s) |
| `VIPER_BROWSER_MAX_NAV_COUNT` | E.26: max number of navigations allowed per session. | No | `20` |
| `VIPER_BROWSER_SCREENSHOT_MAX_BYTES` | E.26: max raw PNG bytes returned in a `browser_screenshot` result (excess is truncated). | No | `204800` (200 KB) |
| `VIPER_BROWSER_MAX_RECIPE_STEPS` | E.27: max number of steps allowed in a single `browser_run_recipe` call. | No | `20` |
| `VIPER_BROWSER_ASSERT_TIMEOUT_MS` | E.27: timeout (ms) for `browser_wait_for_selector` and `browser_assert_text` operations. | No | `5000` (5 s) |
| `VIPER_BROWSER_MAX_SELECTOR_LEN` | E.27: max length (chars) of a CSS selector passed to recipe steps. Rejects suspiciously long selectors. | No | `512` |
| `VIPER_ENTITLEMENTS_ENFORCE` | F.30: `1` or `true` enables workspace entitlement enforcement on `/chat` and `/chat/stream`. When off (default) the middleware is a fast no-op — **all existing clients and tests behave as today with no token required**. When on, requests must supply `Authorization: Bearer <token>` and the resolved user must be a member of the workspace. | No | off (`0`) |
| `VIPER_DEV_BEARER_TOKEN` | F.30: dev-mode bearer token string. When a request's `Authorization: Bearer <value>` matches this, the backend resolves the user via `VIPER_DEV_USER_EMAIL` instead of a real OAuth flow. Only active when `VIPER_ENTITLEMENTS_ENFORCE=1`. | No | unset |
| `VIPER_DEV_USER_EMAIL` | F.30: email of the dev user resolved when `VIPER_DEV_BEARER_TOKEN` matches. Must correspond to a row in the `users` table. | No | unset |
| `VIPER_USAGE_EVENTS` | F.31: `1` or `true` enables DB insert of one `usage_events` row per successful `/chat` and `/chat/stream` request. Default **off** — zero DB work and no behavior change when unset. Requires `DATABASE_URL`. | No | off |
| `VIPER_USAGE_EVENTS_STDOUT` | F.31: `1` or `true` emits a JSON line to stdout per usage event (`_type: "viper.usage.event"`) independently of the DB switch. Useful for log pipelines without enabling full debug mode. | No | off |
| `VIPER_USAGE_AGGREGATE_ENABLED` | F.32: `1` or `true` required for `npm run aggregate-usage` (CLI script) to execute. Safety kill-switch so accidental cron misconfiguration does nothing. Default **off** — the script exits 0 with a message when unset. | No | off |
| `VIPER_USAGE_AGGREGATE_LOOKBACK_DAYS` | F.32: number of recent days to re-process on each aggregation run (for late-arriving events). The job sets `fromDate = max(cursor+1day, yesterday - N)`. Default `2`. | No | `2` |
| `VIPER_QUOTA_ENFORCE` | F.33: `1` or `true` enables monthly request quota checks on `/chat` and `/chat/stream`. When off (default), quota logic is a **complete no-op** — no DB calls, identical behavior to today. | No | off |
| `VIPER_QUOTA_DEFAULT_MONTHLY_REQUESTS` | F.33: optional server-wide default monthly request limit (positive integer). Applied when `workspace_entitlements.flags.monthly_request_quota` is absent. Empty/unset = **unlimited** (matching F.30 allow-all default). | No | unset (unlimited) |
| `VIPER_STRIPE_WEBHOOK_ENABLED` | F.34: `1` or `true` required for `POST /webhooks/stripe` to do anything. When off (default), the endpoint returns **404** — the route appears to not exist to external scanners. | No | off |
| `STRIPE_WEBHOOK_SECRET` | F.34: Stripe webhook signing secret (starts with `whsec_`). Required when `VIPER_STRIPE_WEBHOOK_ENABLED=1`. Never logged — only referenced during HMAC verification. Alias: `VIPER_STRIPE_WEBHOOK_SECRET`. | Yes (when enabled) | unset |
| `VIPER_STRIPE_WEBHOOK_SECRET` | F.34: Fallback alias for `STRIPE_WEBHOOK_SECRET`. `STRIPE_WEBHOOK_SECRET` is preferred. | Yes (when enabled) | unset |
| `VIPER_STRIPE_PRICE_ENTITLEMENTS` | F.34 + Phase 6: JSON map **Stripe Price ID → config** `{ allowed_modes?, allowed_model_tiers?, flags?, billing_plan_slug? }`. **`billing_plan_slug`** must match a row in `billing_plans` (e.g. `free`, `pro_20`, `plus_40`); on `customer.subscription.updated` / Checkout with expanded `line_items`, the webhook sets `workspaces.billing_plan_slug` and Stripe customer/subscription ids. Example: `{"price_abc":{"billing_plan_slug":"pro_20","allowed_model_tiers":["auto","premium"],"flags":{}}}`. Updates apply only when subscription `status` is `active`, `trialing`, or `past_due`. `customer.subscription.deleted` resets the workspace to `billing_plan_slug = free`, clears `stripe_subscription_id`, and removes the `workspace_entitlements` row. | No | unset |
| `VIPER_USAGE_UI_ENABLED` | F.35: `1` or `true` enables `POST /usage/summary` endpoint. When off (default), the endpoint returns **404** — hidden from scanners, same pattern as F.34. When on, the endpoint returns month-to-date usage, quota limit, and entitlement snapshot for the supplied `workspacePath`. | No | off |
| `VIPER_INLINE_COMPLETION_ENABLED` | G.36: `1` or `true` enables `POST /editor/inline-complete` endpoint. When off (default), returns **404**. Controls server-side execution; the desktop also gates on `VITE_INLINE_COMPLETION_ENABLED` at build time. | No | off |
| `VIPER_INLINE_COMPLETION_MODEL` | G.36: OpenAI model used for inline completions. Defaults to `gpt-4o-mini` (fast, low latency). Override with any chat-completion capable model. | No | `gpt-4o-mini` |
| `VITE_INLINE_COMPLETION_ENABLED` | G.36 (desktop, **build-time**): `true` or `1` enables the Monaco inline completions provider (ghost-text UI). When off, the provider is never registered and no requests are made. Must be set at Vite build time (compiled in). | No | off |
| `VIPER_INLINE_EDIT_ENABLED` | G.37: `1` or `true` enables `POST /editor/inline-edit` endpoint. When off (default), returns **404** (hidden endpoint). | No | off |
| `VIPER_INLINE_EDIT_MODEL` | G.37: OpenAI model used for AI inline edits. Defaults to `gpt-4o`. | No | `gpt-4o` |
| `VIPER_COMMIT_ASSISTANT_ENABLED` | G.38: `1` or `true` enables `POST /git/suggest-commit` and `POST /git/suggest-pr-body` endpoints. When off (default), returns **404** (hidden endpoint). | No | off |
| `VIPER_COMMIT_ASSISTANT_MODEL` | G.38: OpenAI model for commit/PR message generation. Defaults to `gpt-4o-mini` (fast). | No | `gpt-4o-mini` |
| `VIPER_TEST_ASSISTANT_ENABLED` | G.39: `1` or `true` enables `POST /testing/suggest-commands` and `POST /testing/triage-failure` endpoints. When off (default), returns **404** (hidden endpoint). | No | off |
| `VIPER_TEST_ASSISTANT_MODEL` | G.39: OpenAI model for test command suggestion and failure triage. Defaults to `gpt-4o-mini`. | No | `gpt-4o-mini` |
| Redis URL      | Not read from env. Pass `options.redisUrl` into `runRepoScanner()` or into `RedisQueueService` in your orchestrator. | No | — |

### LLM providers (`@repo/model-registry` + backend orchestrator)

| Variable | Description | Required | Default |
|---|---|---|-----|
| `OPENAI_API_KEY` | OpenAI API key for chat, embeddings, and tool-calling loops. | Yes (for OpenAI-backed chat) | unset |
| `OPENAI_MODEL` | Pinned **model id** for `VIPER_MODEL_ROUTE_DEFAULT=pinned` auto tier (see `workflow-flags.ts`). Use OpenAI ids from `@repo/model-registry` (e.g. `gpt-4o-mini`, `gpt-4o`). Claude ids in the registry are ignored for pinned resolution until the Anthropic adapter lands — they fall back to the fast OpenAI default. | No | `gpt-4o-mini` |
| `ANTHROPIC_API_KEY` | Reserved for upcoming Anthropic Messages API support in the agentic loop. | No | unset |
| `VIPER_ANTHROPIC_CHAT_ENABLED` | Reserved kill-switch for that adapter (`1` / `true` when implemented). | No | off |

### G.40 Privacy boundary configuration

No environment variables are required. Privacy policy is **on by default** — the built-in denylist (`.env`, `*.pem`, `.ssh/**`, `secrets/**`, etc.) is always applied to every workspace file read or write made via `@repo/workspace-tools`.

To customise the policy for a workspace, create `.viper/privacy.json` at the **workspace root** (the directory opened by the user):

```json
{
  "denyGlobs": ["**/internal-data/**"],
  "allowGlobs": [".env.example"],
  "redactPatterns": []
}
```

| Field | Type | Description |
|---|---|---|
| `denyGlobs` | `string[]` | Additional glob patterns to block (on top of built-in list). Standard `**` / `*` glob syntax. |
| `allowGlobs` | `string[]` | Glob exceptions that un-block paths matched by config `denyGlobs`. Does **not** override the built-in denylist. |
| `redactPatterns` | `string[]` | Reserved for future DLP content redaction — not implemented in MVP; accepted but ignored. |

The config file is loaded from disk and cached for 60 seconds per workspace root. Missing or malformed files fall back to built-in defaults only.

**Observability:** When a path is blocked, the backend logs `privacy:path:blocked` with a 12-character SHA-256 hash of the path (no raw path in logs) and the matching rule name. The workflow stage `privacy:path:blocked` is registered in `VALID_WORKFLOW_STAGES`.

### F.33 `workspace_entitlements.flags` keys

These JSONB keys are stored per-workspace in the `workspace_entitlements` table (managed via `upsertWorkspaceEntitlements`):

| Flag key | Type | Description |
|---|---|---|
| `monthly_request_quota` | `number` | Max completed chat requests per UTC calendar month. 0 or absent = unlimited (falls through to env default). |
| `included_auto_usage_credits_monthly` | `number` | Credit cap for Auto bucket (see F.33 credit mode). |
| `included_premium_usage_credits_monthly` | `number` | Credit cap for Premium bucket. |
| `quota_soft_threshold_ratio` | `number` (0, 1] | Fraction of limit at which `workflowLog("quota:check", ..., { status: "soft_warning" })` fires. Default `0.8`. |
| `usage_warning_threshold_ratio` | `number` (0, 1] | When used ≥ this fraction of included allowance, `POST /usage/summary` sets `usageBilling.showComposerUsageHint` and `composerHint` for in-app messaging. Default `0.4` (40%). Also set on `billing_plans.flags` in Neon. |

### H.44 Router policy shadow traffic + staged rollout

| Variable | Default | Description |
|---|---|---|
| `VIPER_ROUTER_SHADOW_ENABLED` | `""` (off) | Set to `1` or `true` to enable shadow evaluation. When on, every auto-routed request also runs the candidate policy (`v2-plan-complex-premium`) and emits `router:shadow:compare` via `workflowLog`. **The model actually used is unchanged — observe-only.** Requires `VIPER_DEBUG_ASSISTANT=1` or `VIPER_DEBUG_WORKFLOW=1` to surface the comparison in logs. |
| `VIPER_ROUTER_POLICY_CANDIDATE_PCT` | `0` | Integer 0–100. Fraction of auto-routed requests (determined by deterministic workspace+conversation hash) that use the **candidate policy as the live routing decision** (real staged rollout, not shadow-only). `0` = off (default); `100` = full rollout. |

**Candidate policy delta (`v2-plan-complex-premium`):**

| Mode | Intent | Live → tier | Candidate → tier |
|---|---|---|---|
| `plan` | `CODE_FIX`, `IMPLEMENT_FEATURE`, `REFACTOR`, `PROJECT_SETUP` | `fast` | **`premium`** |
| `plan` | other intents | `fast` | `fast` (unchanged) |
| `ask`, `debug`, `agent` | any | (unchanged) | (unchanged) |

All other routing rules are identical between live and candidate.

**Ramp guide:**

```bash
# Start shadow: compare live vs candidate without changing anything
VIPER_ROUTER_SHADOW_ENABLED=1
VIPER_DEBUG_WORKFLOW=1

# After confidence, ramp rollout gradually
VIPER_ROUTER_POLICY_CANDIDATE_PCT=1   # ~1% of auto traffic
VIPER_ROUTER_POLICY_CANDIDATE_PCT=5
VIPER_ROUTER_POLICY_CANDIDATE_PCT=25
VIPER_ROUTER_POLICY_CANDIDATE_PCT=100  # full rollout

# Roll back instantly
VIPER_ROUTER_POLICY_CANDIDATE_PCT=0   # or unset
```

**New workflow stages** (registered in `VALID_WORKFLOW_STAGES`):

| Stage | When |
|---|---|
| `router:shadow:compare` | Shadow is on + auto path: candidate decision computed and compared. Payload includes `live_model_id`, `shadow_model_id`, `agreement`, `live_reason`, `shadow_reason`, `candidate_label`. |
| `router:policy:rollout` | Workspace is in the staged-rollout bucket (candidate is the live decision). |

### H.43 SLO Ops / Alerting

| Variable | Required | Description |
|---|---|---|
| `VIPER_SLO_OPS_ENABLED` | No | Set to `1` or `true` to enable `/ops/slo-snapshot` and `/ops/slo-check`. When absent or falsy both endpoints return **404** (hidden endpoint pattern). |
| `VIPER_SLO_OPS_TOKEN` | Yes (when enabled) | Bearer token for `Authorization: Bearer <token>` header on both ops endpoints. When unset all requests return **401** (safety default — never exposes data without a token). |
| `VIPER_SLO_ALERT_WEBHOOK_URL` | No | HTTPS URL to POST alert violations to when `POST /ops/slo-check` detects SLO breaches. Payload: `{ service, computed_at, severity, violation_count, violations[] }`. When absent, violations are only logged via `workflowLog`. |

**Workflow stages emitted** (both registered in `VALID_WORKFLOW_STAGES`):

| Stage | When |
|---|---|
| `slo:check:ok` | `POST /ops/slo-check` completes with zero violations. |
| `slo:alert:fired` | `POST /ops/slo-check` detects at least one SLO breach. |

**cURL examples:**

```bash
# Snapshot
curl -s -H "Authorization: Bearer $VIPER_SLO_OPS_TOKEN" \
     http://localhost:4000/ops/slo-snapshot | jq .

# Cron check (exit code 0 = ok, violation_count 0; output includes violations)
curl -s -X POST -H "Authorization: Bearer $VIPER_SLO_OPS_TOKEN" \
     -H "Content-Type: application/json" -d '{}' \
     http://localhost:4000/ops/slo-check | jq .
```

### Web app auth (email/password + Google OAuth)

Used by `apps/web-app` BFF routes under `/api/auth/*` and `apps/backend` routes under `/auth/*`. Requires `DATABASE_URL` and applied migrations (including `017_web_auth_password_sessions_oauth.sql`).

| Variable | Where | Required | Default / notes |
|---|---|---|---|
| `VIPER_JWT_SECRET` | Backend signing key for short-lived access JWTs. Alias: `JWT_SECRET`. | **Yes** for auth | Must be ≥ 32 random characters. |
| `JWT_SECRET` | Same as `VIPER_JWT_SECRET` if the latter is unset. | No | — |
| `VIPER_WEB_APP_URL` | Backend: base URL of the Next app (redirects after Google OAuth, email verification links in dev logs). | No | `http://localhost:3000` |
| `VIPER_WEB_APP_ORIGIN` | Backend CORS allowlist (comma-separated origins). Must include the browser origin that calls the API (with `credentials: true`). | No | `http://localhost:3000` |
| `VIPER_API_PUBLIC_URL` | Public base URL of the API (no trailing path). Google redirect URI = `{VIPER_API_PUBLIC_URL}/auth/google/callback`. | No | `http://localhost:4000` (or `PORT`) |
| `VIPER_GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID. | Yes for Google sign-in | — |
| `VIPER_GOOGLE_CLIENT_SECRET` | Google OAuth client secret (server only). | Yes for Google sign-in | — |
| `VIPER_AUTH_SKIP_EMAIL_VERIFICATION` | When truthy, new email/password users are treated as verified without clicking the link. | No | off |
| `VIPER_AUTH_LOG_VERIFY_TOKEN` | Set to `1` to log a one-time email verification URL to stdout in development (never enable in production). Only used when SMTP is **not** configured. | No | off |
| `NEXT_PUBLIC_BACKEND_URL` | Web app (browser): absolute URL of the backend for client-side calls if any. | Recommended | e.g. `http://localhost:4000` |
| `BACKEND_URL` | Web app (server/BFF): backend URL for `fetch` from Route Handlers. If unset, implementations may fall back to `NEXT_PUBLIC_BACKEND_URL`. | Recommended in prod | Same as public API URL |

**Verification email (SMTP):** When `VIPER_SMTP_PASS` is set, signups that require email verification send a **one-time link** from your mailbox (not a separate numeric OTP flow). GoDaddy [Titan Email](https://secureserver.titan.email/) typically uses outbound host `smtp.titan.email`. If SMTP is unset, verification links are not sent (use `VIPER_AUTH_LOG_VERIFY_TOKEN=1` locally or enable `VIPER_AUTH_SKIP_EMAIL_VERIFICATION` for dev only).

| Variable | Required | Default / notes |
|---|---|---|
| `VIPER_SMTP_PASS` | For real verification mail in prod | Alias: `VIPER_SMTP_PASSWORD`. Titan/GoDaddy: the password for the mailbox (or app-specific password if your provider supports it). |
| `VIPER_SMTP_HOST` | No | `smtp.titan.email`. Some accounts use `smtpout.secureserver.net` — check Titan/GoDaddy SMTP help for your product. |
| `VIPER_SMTP_PORT` | No | `465` (implicit TLS). Use `587` with `VIPER_SMTP_SECURE=0` if your provider requires STARTTLS. |
| `VIPER_SMTP_SECURE` | No | If unset, `secure` is **true** when port is `465`, otherwise false. Set `0` for port 587 STARTTLS. |
| `VIPER_SMTP_USER` | No | SMTP login — usually the full email address. Default `info@viperai.tech`. |
| `VIPER_MAIL_FROM` | No | RFC From header. Default `Viper AI <info@viperai.tech>`. Must be allowed by your SMTP provider (often must match or be an alias of the authenticated user). |

**Google Cloud Console:** add authorized redirect URI exactly: `https://<your-api-host>/auth/google/callback` (must match `VIPER_API_PUBLIC_URL`).

### Viper Desktop → web sign-in handoff

The IDE opens `VITE_WEB_APP_URL/login?source=desktop` (and `/signup?source=desktop`) in the system browser. After a successful session, the web app redirects to **`viper://auth/callback?code=…`**; the packaged app registers the **`viper`** protocol so Electron can exchange the code with `POST /auth/oauth/exchange` and store tokens locally.

| Variable | Where | Required | Default / notes |
|---|---|---|---|
| `VITE_WEB_APP_URL` | `apps/viper-desktop` (Vite **build-time**) | Recommended in prod | e.g. `http://localhost:3000` — must match where users sign in (`VIPER_WEB_APP_URL` on the backend for redirects). |

## Summary

1. **Database** – Set `DATABASE_URL` (e.g. in `.env`) if you use the metadata persistence layer. Run `packages/database/schema.sql` (or migrations under `packages/database/migrations/`) against that database first. D.20 **conversation model preferences** (`conversation_model_preferences`), D.21 **chat feedback** (`chat_feedback`), and E.23 **media objects** (`chat_media`) are stored when `DATABASE_URL` is set; without it, the backend uses an in-memory store for those features.
2. **Redis** – Configure in code when calling the scanner or the queue (e.g. `runRepoScanner(url, branch, { persistMetadata })` and separately push `result.jobs` to Redis using `RedisQueueService` with your Redis URL).
