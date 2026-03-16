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
4. **Run codebase analysis**: Command Palette → “Run Codebase Analysis” (or command `viper.analysis.run`). This calls `POST /analysis/run` with the current workspace path and starts the Codebase Analysis Agent pipeline (scanner, AST, metadata, graph, embeddings).

The IDE is wired to `http://localhost:4000` by default. Override with `VITE_AGENT_API_URL` when building the IDE.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check. Returns `{ "status": "ok" }`. |
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
