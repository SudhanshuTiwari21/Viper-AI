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
| Redis URL      | Not read from env. Pass `options.redisUrl` into `runRepoScanner()` or into `RedisQueueService` in your orchestrator. | No | — |

## Summary

1. **Database** – Set `DATABASE_URL` (e.g. in `.env`) if you use the metadata persistence layer. Run `packages/database/schema.sql` (or migrations under `packages/database/migrations/`) against that database first. D.20 **conversation model preferences** (`conversation_model_preferences`), D.21 **chat feedback** (`chat_feedback`), and E.23 **media objects** (`chat_media`) are stored when `DATABASE_URL` is set; without it, the backend uses an in-memory store for those features.
2. **Redis** – Configure in code when calling the scanner or the queue (e.g. `runRepoScanner(url, branch, { persistMetadata })` and separately push `result.jobs` to Redis using `RedisQueueService` with your Redis URL).
