# Viper AI Backend Orchestrator

Central API server that connects the IDE to the AI agents and runs the full context pipeline.

## Run

From repo root or `apps/backend`:

```bash
npm run dev
```

Server listens on `http://0.0.0.0:4000` (override with `PORT` / `HOST`).

## Testing with the IDE

1. **Start the backend** (from repo root): `npm run dev` in `apps/backend` (or `npx tsx apps/backend/src/server.ts`).
2. **Start the IDE** (viper-desktop): open the project, run the app, then open a **workspace folder**.
3. **Chat**: In the chat panel, send a prompt (e.g. “fix login api”). The IDE sends `POST /chat` with `{ prompt, workspacePath }`. You get back **Intent** (from Intent Agent) and **Context** (from Context Builder → Ranking → Context Window).
4. **Run codebase analysis**: In the **Chat** panel, click **“Analyse the Codebase (for development and testing)”**. This uses the **currently opened workspace folder** and calls `POST /analysis/run` to run the full Codebase Analysis Agent pipeline (scanner, AST, metadata, graph, embeddings). You can also use Command Palette → “Run Codebase Analysis”.
5. **Scan only (debug)**: In the Chat panel, click **“Scan only (show report)”** to run only the Repo Scanner and see in chat how the agent understands the repo (files, languages, modules, parse jobs). Or use Command Palette → “Test Codebase Scan (current workspace)”.

The IDE is wired to `http://localhost:4000` by default. Override with `VITE_AGENT_API_URL` when building the IDE.

## Testing with Postman

1. **Discover analysis endpoints**: `GET http://localhost:4000/analysis` returns a JSON description of the Codebase Analysis API (run vs scan, request body format).
2. **Run full analysis** (same as IDE “Analyse the Codebase”):  
   `POST http://localhost:4000/analysis/run`  
   Body (raw JSON): `{ "workspacePath": "C:\\Users\\You\\your-repo" }` (use the **absolute path** to the repo root you have open in the IDE).
3. **Scan only** (debug how the agent sees the repo):  
   `POST http://localhost:4000/analysis/scan`  
   Body: `{ "workspacePath": "C:\\Users\\You\\your-repo" }`  
   Response: `files`, `sourceFiles`, `jobs` (modules, languages, parse jobs).

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check. Returns `{ "status": "ok" }`. |
| GET | `/analysis` | Returns API doc for analysis endpoints (for Postman). |
| POST | `/analysis/scan` | Repo Scanner only. Body: `{ "workspacePath": "/path" }`. Returns `files`, `sourceFiles`, `jobs`. |
| POST | `/analysis/run` | Start codebase analysis. Body: `{ "workspacePath": "/path" }`. |
| POST | `/chat` | Run assistant pipeline. Body: `{ "prompt": "...", "workspacePath": "/path" }`. |
| POST | `/chat/stream` | Same as `/chat` but streams SSE events. |
| POST | `/context/debug` | Debug retrieval. Body: `{ "prompt": "..." }`. Returns full pipeline output. |

## Pipeline (POST /chat)

1. Intent Agent → context request + entities + response  
2. Raw context (Context Builder Engine + adapter)  
3. Candidate generation → scoring → aggregation → top-K  
4. Context window builder  
5. Response: `{ intent, context }` (files, functions, snippets, estimatedTokens)

## Tech

- **Fastify** – HTTP server  
- **Zod** – request validation  
- **SSE** – `/chat/stream` for incremental status + result  

Errors return `{ "error": "message" }` with status 500.
