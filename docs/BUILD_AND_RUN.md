# Build & run reference (ViperAI monorepo)

Run **all commands from the repository root** unless noted.

## Troubleshooting

### Do not paste `# comments` as part of the command

If you copy lines like:

```text
npm run build:vite -w viper-desktop       # frontend only
```

some environments pass `#`, `frontend`, `only` as **extra CLI args** to `vite` / `next`. That produces errors such as:

- `received "...#/index.html"` / project root contains `"#"`
- `Invalid project directory .../web-app/#`

**Fix:** run **only** the command, one per line, with **no** trailing comment:

```bash
npm run build:vite -w viper-desktop
npm run build -w web-app
```

**Easier (from repo root, no `-w` to remember):**

```bash
npm run build:backend
npm run build:desktop:vite
npm run build:desktop
npm run build:web
```

In `package.json`, **never** put `# ...` inside a `"scripts"` value — `#` is not a comment in JSON; it becomes part of the shell command.

### `zsh: unknown file attribute: v`

Usually a bad paste or a line that isn’t a valid command. Run the exact lines from the **bash** blocks in this file (no extra characters).

### Stray `#` folder under `apps/viper-desktop`

If a directory literally named `#` was created after a bad build, remove it:

```bash
rm -rf "apps/viper-desktop/#"
```

### Chat: “Failed to fetch” (desktop / `/chat/stream`)

- **Don’t stop the backend mid-reply** (e.g. Ctrl+C in the terminal running `npm run dev` for `@repo/backend`). The UI uses SSE; killing the server drops the TCP connection and Chromium/Electron report **`Failed to fetch`**.
- **Long streams**: the backend uses `reply.hijack()` for `/chat/stream`, disables the socket timeout, sets `requestTimeout: 0` / `connectionTimeout: 0` on Fastify, and sends **`keepalive` SSE pings** every few seconds (`SSE_HEARTBEAT_MS`, default `8000`) so the autonomous loop / LLM phases (which can be silent for a long time) don’t look like a dead connection to Electron/Chromium.
- **CORS from Vite (`localhost:5173`)**: hijacked SSE uses `reply.raw.writeHead()` so **`@fastify/cors` does not add headers** to that response. The controller merges **`sseCorsHeaders()`** (`Access-Control-Allow-Origin` = request `Origin` or `*`) so the browser allows the stream.
- **`QDRANT_URL` set but Qdrant not running** → backend logs like `ECONNREFUSED` / `Context adapter searchEmbeddings error TypeError: fetch failed`. Start Qdrant or unset `QDRANT_URL` if you’re not using embeddings yet.
- **Wrong API URL**: desktop must match the backend (`VITE_AGENT_API_URL`, default `http://localhost:4000`). If `localhost` misbehaves (IPv6 vs IPv4), try **`http://127.0.0.1:4000`**.

---

## Prerequisites

```bash
npm install
```

- **Node** ≥ 18  
- **Env**: root `.env` (see `docs/ENV.md` if present) — e.g. `OPENAI_API_KEY`, `DATABASE_URL`, optional `QDRANT_URL`  
- **Services**: Postgres (and Qdrant if you use embeddings) when running the full backend  

---

## One-shot (Turbo)

| Goal | Command |
|------|---------|
| Build everything that defines `build` | `npm run build` |
| Start every workspace `dev` script | `npm run dev` |
| Typecheck all workspaces | `npm run check-types` |

`npm run dev` starts **all** dev processes (backend, web-app, viper-desktop, agent test watchers, etc.) — often too noisy. Prefer **individual run commands** below.

---

## Agent packages — build (per package)

From repo root, use `-w` / `--workspace=` with the **package `name`** from each `package.json`:

| Package | Build command |
|---------|----------------|
| `@repo/intent-agent` | `npm run build -w @repo/intent-agent` |
| `@repo/planner-agent` | `npm run build -w @repo/planner-agent` |
| `@repo/execution-engine` | `npm run build -w @repo/execution-engine` |
| `@repo/implementation-agent` | `npm run build -w @repo/implementation-agent` |
| `@repo/memory-agent` | `npm run build -w @repo/memory-agent` |
| `@repo/reflection-agent` | `npm run build -w @repo/reflection-agent` |
| `@repo/codebase-analysis-agent` | `npm run build -w @repo/codebase-analysis-agent` |

**Copy-paste (all agents):**

```bash
npm run build -w @repo/intent-agent
npm run build -w @repo/planner-agent
npm run build -w @repo/execution-engine
npm run build -w @repo/implementation-agent
npm run build -w @repo/memory-agent
npm run build -w @repo/reflection-agent
npm run build -w @repo/codebase-analysis-agent
```

### Agent packages — other scripts

| Script | Example |
|--------|---------|
| Typecheck only | `npm run check-types -w @repo/execution-engine` |
| Tests | `npm run test -w @repo/planner-agent` |
| Vitest watch (where `dev` exists) | `npm run dev -w @repo/execution-engine` |

`@repo/shared` has **no** `build` script (TS consumed as sources). Use `npm run check-types -w @repo/shared` if needed.

---

## Core library packages — build

| Package | Build command |
|---------|----------------|
| `@repo/context-builder` | `npm run build -w @repo/context-builder` |
| `@repo/context-ranking` | `npm run build -w @repo/context-ranking` |
| `@repo/database` | `npm run build -w @repo/database` |

**Copy-paste:**

```bash
npm run build -w @repo/context-builder
npm run build -w @repo/context-ranking
npm run build -w @repo/database
```

### Database migrations

```bash
npm run migrate -w @repo/database
```

---

## Apps — build

| App | Build command | Notes |
|-----|----------------|--------|
| **Backend** `@repo/backend` | `npm run build -w @repo/backend` | Emits `apps/backend/dist` |
| **Desktop IDE** `viper-desktop` | `npm run build -w viper-desktop` | Vite + electron-builder (installer) |
| **Web** `web-app` | `npm run build -w web-app` | `next build` (needs network for fonts unless configured) |

Vite-only (no Electron pack):

```bash
npm run build:vite -w viper-desktop
```

---

## Apps — run (typical dev)

Use **two terminals** for the AI IDE flow:

### 1) Backend API (orchestrator)

```bash
npm run dev -w @repo/backend
```

Default: **http://localhost:4000** (`PORT` env overrides).

Production-style after compile:

```bash
npm run build -w @repo/backend
npm run start -w @repo/backend
```

> If `start` fails resolving `.ts` workspace packages, keep using **`npm run dev -w @repo/backend`** (uses `tsx`).

### 2) Viper Desktop (Electron + Vite)

```bash
npm run dev -w viper-desktop
```

- Vite: **http://localhost:5173**  
- Point the UI at the API with `VITE_AGENT_API_URL` if not using default `http://localhost:4000`.

### Optional: Next.js web app

```bash
npm run dev -w web-app
```

---

## Suggested order (cold build)

If you are building manually without Turbo dependency order:

1. `@repo/context-builder`  
2. `@repo/context-ranking`  
3. `@repo/database`  
4. `@repo/shared` (no build; optional `check-types`)  
5. `@repo/planner-agent`  
6. `@repo/intent-agent`  
7. `@repo/implementation-agent`  
8. `@repo/execution-engine`  
9. `@repo/memory-agent`  
10. `@repo/reflection-agent`  
11. `@repo/codebase-analysis-agent`  
12. `@repo/backend`  
13. `viper-desktop` / `web-app` as needed  

Or rely on **`npm run build`** at root and let Turbo run tasks in dependency order (packages that define `build`).

---

## Config-only packages (no `build`)

- `@repo/typescript-config`  
- `@repo/eslint-config`  
- `packages/ui` — `check-types` / `lint` only  

---

## Nested module (not an npm workspace)

`packages/agents/codebase-analysis-agent/modules/Repo-Scanner` is **not** listed in root `workspaces`. Build it from that folder only if you maintain it separately:

```bash
cd packages/agents/codebase-analysis-agent/modules/Repo-Scanner && npm run build
```

The main agent package build (`@repo/codebase-analysis-agent`) is what the backend depends on.
