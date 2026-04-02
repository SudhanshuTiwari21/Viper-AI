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
| Redis URL      | Not read from env. Pass `options.redisUrl` into `runRepoScanner()` or into `RedisQueueService` in your orchestrator. | No | — |

## Summary

1. **Database** – Set `DATABASE_URL` (e.g. in `.env`) if you use the metadata persistence layer. Run `packages/database/schema.sql` (or migrations under `packages/database/migrations/`) against that database first. D.20 **conversation model preferences** (`conversation_model_preferences`) and D.21 **chat feedback** (`chat_feedback`) are stored when `DATABASE_URL` is set; without it, the backend uses an in-memory store for those features.
2. **Redis** – Configure in code when calling the scanner or the queue (e.g. `runRepoScanner(url, branch, { persistMetadata })` and separately push `result.jobs` to Redis using `RedisQueueService` with your Redis URL).
