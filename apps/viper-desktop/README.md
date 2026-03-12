# Viper Desktop IDE

Electron + React desktop app with embedded code-server (VSCode) and AI chat panel — Cursor-style layout.

## Prerequisites

- Node 18+
- Docker (for code-server)
- Chat API at `http://localhost:3000/api/chat` (optional; stream tokens for AI responses)

## Quick start

1. **Start code-server (VSCode in browser)**

   ```bash
   cd services/ide-runtime && docker compose up -d
   ```

   Editor: http://localhost:8080  
   Workspace: `~/.viper/workspaces` (mounted in container)

2. **Run the desktop app**

   ```bash
   npm install
   npm run dev
   ```

   This builds the Electron main process, starts the Vite dev server, and opens the Electron window with:
   - **Left:** VSCode (iframe to localhost:8080)
   - **Right:** AI Chat panel (streaming prompt input + messages)

## Scripts

- `npm run dev` — Build electron, run Vite + Electron (dev)
- `npm run build` — Vite build + electron-builder
- `npm run build:electron` — Compile Electron main/preload only

## Workspace

All repos live under **`~/.viper/workspaces`**. Mount this in code-server so files opened in the IDE are on disk there.

## Chat API

Chat panel sends prompts to `POST /api/chat` with body `{ prompt: "..." }`. Responses should stream tokens (e.g. SSE or chunked). Override via env when needed.
