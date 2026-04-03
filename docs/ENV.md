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
| `VIPER_STRIPE_PRICE_ENTITLEMENTS` | F.34: JSON object mapping **Stripe Price ID → entitlement config** `{ allowed_modes?, allowed_model_tiers?, flags? }`. Example: `{"price_pro":{"allowed_model_tiers":["standard","premium"],"flags":{"monthly_request_quota":1000}}}`. If unset or empty, all price IDs are treated as `ignored` (events are accepted but no entitlements change). | No | unset |
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
| `quota_soft_threshold_ratio` | `number` (0, 1] | Fraction of limit at which `workflowLog("quota:check", ..., { status: "soft_warning" })` fires. Default `0.8`. |

## Summary

1. **Database** – Set `DATABASE_URL` (e.g. in `.env`) if you use the metadata persistence layer. Run `packages/database/schema.sql` (or migrations under `packages/database/migrations/`) against that database first. D.20 **conversation model preferences** (`conversation_model_preferences`), D.21 **chat feedback** (`chat_feedback`), and E.23 **media objects** (`chat_media`) are stored when `DATABASE_URL` is set; without it, the backend uses an in-memory store for those features.
2. **Redis** – Configure in code when calling the scanner or the queue (e.g. `runRepoScanner(url, branch, { persistMetadata })` and separately push `result.jobs` to Redis using `RedisQueueService` with your Redis URL).
