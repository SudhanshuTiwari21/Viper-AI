# Environment variables

## Where to set them

- **Root:** Create a `.env` at the repo root (copy from `.env.example`). Many tools and apps load this by default.
- **Per app:** If you run an app from a subdirectory (e.g. `packages/agents/codebase-analysis-agent`), you can put a `.env` there, or ensure the root `.env` is loaded (e.g. via `dotenv` or your runtime).

## Variables

| Variable        | Where it's used | Required | Default |
|----------------|------------------|----------|---------|
| `DATABASE_URL` | `packages/database` – `getPool()` in `database.service.ts` | No (has default) | `postgresql://localhost:5432/viper` |
| Redis URL      | Not read from env. Pass `options.redisUrl` into `runRepoScanner()` or into `RedisQueueService` in your orchestrator. | No | — |

## Summary

1. **Database** – Set `DATABASE_URL` (e.g. in `.env`) if you use the metadata persistence layer. Run `packages/database/schema.sql` against that database first.
2. **Redis** – Configure in code when calling the scanner or the queue (e.g. `runRepoScanner(url, branch, { persistMetadata })` and separately push `result.jobs` to Redis using `RedisQueueService` with your Redis URL).
