# Intent Agent, Context Engine, and Analysis Agent Wiring (Current)

## What this document covers

This doc explains:
1. How the **Intent Agent** works internally (modules + responsibilities).
2. How the **Context Engine** builds and ranks code context (raw context + ranking + context window).
3. How the **Analysis Agent** populates codebase knowledge (scan → AST → metadata → graph → embeddings).
4. How the whole system is wired together right now end-to-end (frontend → backend → pipelines).

All descriptions match the current implementation in the repository.

---

## 1. High-level system architecture (today)

### Frontend responsibilities (viper-desktop)

The chat UI is multi-turn by design and owns chat history:

1. It creates a new local chat session (UUID).
2. It stores session + message history in `localStorage`.
3. On every request, it sends:
   - `conversationId` = current session UUID (per conversation)
   - `messages` = last `N` user/assistant turns (per conversation)
   - `prompt` = latest user message
   - `workspacePath` = active workspace root

### Backend responsibilities (apps/backend)

The backend orchestrates everything statelessly per request:

1. `POST /chat` and `POST /chat/stream` accept `conversationId` + `messages`.
2. `chat.controller.ts` forwards those to `assistant.service.ts`.
3. `assistant.service.ts` runs:
   - Intent pipeline (intent-agent)
   - Tool routing (decide direct LLM vs context engine)
   - Context engine (context-builder + context-ranking) when needed
   - Optional codebase analysis trigger (run-full-analysis) when context engine needs indexed data
4. The backend returns:
   - `intent` + `context` (+ optional `reasoning`)

---

## 2. Live end-to-end request flow (how the system works right now)

### 2.1 Frontend → backend

When you submit a chat prompt in the UI (`ChatPanel`):

1. The UI appends a `user` message to the active session.
2. It creates an empty `assistant` message placeholder (streaming state).
3. It computes `lastMessages` from the current session:
   - Filters out streaming placeholders
   - Keeps last `10` non-streaming messages
4. It calls `sendChatStream(...)` which posts to:
   - `POST /chat/stream`
5. Request body includes:
   - `prompt`
   - `workspacePath`
   - `conversationId`
   - `messages: lastMessages`

### 2.2 Backend route → assistant orchestrator

1. `apps/backend/src/routes/chat.routes.ts`
   - Validates request via `ChatRequestSchema` (zod)
   - Calls `postChat(...)` for `/chat`
   - Calls `postChatStream(...)` for `/chat/stream`
2. `apps/backend/src/controllers/chat.controller.ts`
   - Extracts `{ prompt, workspacePath, conversationId, messages }`
   - Calls `runAssistantPipeline(prompt, workspacePath, conversationId, messages)`
3. `apps/backend/src/services/assistant.service.ts`
   - Builds `historyAwarePrompt` from the provided `messages`
   - Calls the intent pipeline:
     - `runIntentPipeline(historyAwarePrompt, { cacheContext: ... })`
   - Routes with:
     - `routeTools(intentResult.intent, intentResult.entities, intentResult.tasks)`
   - If routing says to use context engine:
     - optionally triggers analysis via `runCodebaseAnalysisIfConfigured(...)`
     - builds raw context from real stores via `buildRawContext(...)`
     - ranks candidates via context-ranking
     - constructs a token-budgeted `contextWindow`
   - Returns `{ intent, context, reasoning? }`

### 2.3 Streaming behavior (`/chat/stream`)

`postChatStream` sets `Content-Type: text/event-stream` and emits:
1. `event: status` for intermediate steps
2. `event: result` with the final `ChatResponse`

The UI listens and resolves once the `result` event arrives.

---

## 3. Intent Agent (packages/agents/intent-agent)

### 3.1 Purpose

The Intent Agent converts a raw user prompt into a structured intent response:
1. Detect intent type (e.g. `CODE_FIX`, `GENERIC`, etc.)
2. Extract entities (files/functions/modules/etc.) from the prompt
3. Plan tasks (what should be done)
4. Build a context request (what code to query)
5. Optionally run an LLM “reasoner” step that outputs:
   - what is implemented
   - what is missing
   - potential issues
   - a recommended next step

### 3.2 Entry point

The backend calls the intent agent through:

`apps/backend/src/lib/intent-agent-loader.ts`
 - `runIntentPipeline(prompt, options?)` loads `@repo/intent-agent` dynamically

### 3.3 Module graph + responsibilities

Inside `packages/agents/intent-agent`:

1. `modules/prompt-normalizer`
   - Inputs: raw prompt string
   - Outputs:
     - `normalized` text
     - `tokens`
     - `references` (files, function-like identifiers, modules, etc.)
   - Key implementation details:
     - noise removal
     - shorthand expansion (`api` → `API`, `auth svc` → `authentication service`, etc.)
     - reference detection (files like `login.ts`, camelCase functions, module keywords, etc.)
2. `modules/intent-classifier`
   - Inputs: `NormalizedPrompt`
   - Outputs: `IntentClassification` with `intentType`
   - Current behavior:
     - LLM-based intent classifier
     - Uses `DISABLE_INTENT_CACHE` and scoped cache keys (see caching section)
3. `modules/entity-extractor`
   - Inputs: `NormalizedPrompt`
   - Outputs: `EntityExtractionResult` (list of extracted entities)
   - Uses prompt references to generate entities (file/function/module/service/api/etc.)
4. `modules/task-planner`
   - Inputs: intent + extracted entities
   - Outputs: a `TaskPlan` describing what to do next
   - Uses task rules mapped by intent type
5. `modules/context-request-builder`
   - Inputs: task plan + entities
   - Outputs: `ContextRequest` describing what to query:
     - `symbolSearch`
     - `embeddingSearch`
     - `dependencyLookup`
6. `modules/context-builder-adapter`
   - Inputs: `ContextRequest`
   - Outputs: `ContextBundle`
   - Current state note:
     - The backend orchestration can run the intent-agent pipeline with `skipReasoning: true`.
       In that mode, intent-agent does not build its own context bundle and does not call the intent reasoner.
       Instead, the backend computes reasoning later using the backend’s own context engine output.
7. `modules/intent-reasoner`
   - Builds an LLM prompt (`reasoning-prompt-builder`)
   - Calls LLM (`llm-client.service.ts`) to produce reasoning JSON
8. `modules/intent-response`
   - Builds the final `IntentResponse` object for the UI:
     - intent + summary
     - reasoning fields (detected/missing/issues/next step)
     - relevant files when present in the context bundle

---

## 4. Context Engine (context-builder + context-ranking)

In this system, the **context engine output shown in the UI** is produced in the backend by:
1. `@repo/context-builder` to build a `RawContextBundle`
2. `@repo/context-ranking` to rank and pack that into a `ContextWindow`

### 4.1 Backend orchestration site

This happens inside `apps/backend/src/services/assistant.service.ts`:

1. `buildRawContext(repo_id, intentResult.contextRequest, adapter)`
2. `generateCandidates(rawContext)`
3. `computeCandidateScores(...)`
4. `combineScores(...)`
5. `selectTopK(...)`
6. `buildContextWindow(...)`

### 4.2 4.2 Raw Context Builder (packages/context-builder)

Function: `packages/context-builder/src/build-raw-context.ts`

`buildRawContext(repo_id, request, adapter)` does:
1. Read request terms:
   - `symbolSearch`
   - `embeddingSearch`
   - `dependencyLookup`
2. Execute adapter queries:
   - `adapter.searchSymbols(term)` for each symbol term
   - `adapter.searchEmbeddings(term)` for each embedding term
   - (optional) `adapter.getDependencies(symbol)` if dependency lookup is enabled
3. Normalize and merge:
   - `normalizeSymbolResults(...)`
   - `normalizeEmbeddingResults(...)`
   - `normalizeDependencyEdges(...)`
   - `mergeRawContext(...)` (dedupe)
4. Output is a unified `RawContextBundle`:
   - `files`
   - `functions`
   - `classes`
   - `embeddings` (chunk matches)
   - `dependencies`

### 4.3 Adapter for real stores (apps/backend adapter)

When DB + embeddings are configured, backend uses:
`apps/backend/src/adapters/context-builder.adapter.ts`

`createContextAdapter({ repo_id, pool, qdrantUrl, openaiApiKey })` implements the adapter interface:
1. `searchSymbols(term)`
   - Queries `graph_nodes` in Postgres
   - Filters by `repo_id` and type in (`function`, `class`)
2. `searchEmbeddings(term)`
   - Calls OpenAI embeddings for the query term
   - Searches Qdrant collection (filtered by `repo_id`)
3. `getDependencies(symbol)`
   - Queries `graph_edges` for dependencies

### 4.4 Ranking engine (packages/context-ranking)

The ranking engine transforms `RawContextBundle` → `ContextWindow`:

1. `generateCandidates(rawContext)`
   - Produces candidate entries:
     - file candidates
     - function/class candidates
     - chunk embedding candidates
2. `computeCandidateScores(candidates, scoringContext)`
   - Computes signal scores per candidate:
     - symbol score
     - embedding score
     - dependency score
     - file importance score
     - recency score
3. `combineScores(...)`
   - Aggregates those into a `finalScore` (weighted)
4. `selectTopK(ranked)`
   - Keeps limits:
     - max files
     - max functions/classes
     - max snippets
5. `buildContextWindow(bundle)`
   - Packs for token budget using priority:
     - snippets first
     - then functions
     - then files
   - Produces:
     - `files[]`
     - `functions[]`
     - `snippets[]`
     - `estimatedTokens`

The assistant response returns this `contextWindow` under `response.context`.

---

## 5. Analysis Agent (packages/agents/codebase-analysis-agent)

### 5.1 Purpose

The Codebase Analysis Agent builds the indexed knowledge needed by the Context Engine:
1. Repo inventory + file classification (Repo Scanner)
2. AST parsing (AST Parser)
3. Metadata extraction and graph event generation (Metadata Extractor)
4. Dependency graph building (Graph Builder)
5. Chunk embeddings + vector store indexing (Embedding Generator)

### 5.2 Entry point and orchestration site

The backend triggers it via:
`apps/backend/src/controllers/analysis.controller.ts`
and ultimately:
`apps/backend/src/services/analysis-options.service.ts`

If `REDIS_URL` is configured, backend calls:
`runFullAnalysis({ workspacePath, repo_id }, options)`

### 5.3 Worker pipeline wiring (runFullAnalysis)

Function: `packages/agents/codebase-analysis-agent/pipeline/run-full-analysis.ts`

High-level sequence:
1. Run repo scanner in-process:
   - `runRepoScanner(input, { persistMetadata? })`
   - produces `scanResult.jobs` for AST parsing
2. If Redis is configured:
   - Push AST parse jobs into Redis queue `DEFAULT_AST_PARSE_QUEUE_NAME`
3. Start workers:
   - AST parser workers
   - metadata extraction workers
   - graph builder workers
   - embedding workers (consume embedding generate events and index into Qdrant)

### 5.4 What gets stored (persistence targets)

When configured:
1. Postgres:
   - graph nodes (`graph_nodes`)
   - graph edges (`graph_edges`)
2. Qdrant:
   - vector collection (default `viper_code`)
3. Redis:
   - job queues and pub/sub channels connecting workers

This is the data used later by `createContextAdapter()` inside the context engine.

---

## 6. Tool routing inside the backend (what decides which pipeline runs)

Backend tool router: `apps/backend/src/router/tool-router/route-tools.ts`

Given:
1. `intent.intentType`
2. `entities`
3. (tasks exist but routing currently uses intent + entities)

It decides:
1. `directLLMResponse`
2. `runContextEngine`
3. `runRanking`
4. `runImplementationAgent` (not implemented in current system)

Example:
1. `GENERIC` → `directLLMResponse: true` (skips context engine)
2. `CODE_SEARCH` → context engine + ranking
3. `CODE_FIX` / `REFACTOR` / etc → context engine + ranking (implementation agent not active)

---

## 7. Cache + multi-turn history scoping (current)

### 7.1 What the frontend sends

On every request:
1. `conversationId` = current chat session UUID
2. `messages` = last N turns (N <= 10)

### 7.2 Cache scoping implementation

Backend now uses scoped cache keys for:
1. Direct LLM cache
2. Intent classifier cache
3. Intent reasoner cache

Helper:
`packages/shared/cache/build-cache-key.ts`

Key strategy:
1. Include `workspaceKey`
2. Include `conversationId`
3. Include `prompt`
4. Include `messagesHash` (hash of last N messages)
5. Include module-specific identifiers

### 7.3 Safety rules

Even with caching enabled by default now:
1. Direct LLM cache only activates when `conversationId` is provided
2. Intent caches only activate when `conversationId` is provided

This avoids accidental cross-conversation reuse.

---

## 8. Current limitations / important behavioral note

Reasoning and context are now aligned:
1. `response.context` is computed from the backend’s context engine output (`contextWindow`) using Postgres + Qdrant.
2. `response.reasoning` is also computed using the same backend-selected `contextWindow` (the backend skips reasoning inside intent-agent and runs reasoning after ranking).

Current limitation:
- The reasoner prompt currently receives `files` + `functions` from `contextWindow`.
  `contextWindow` does not include dependency edges or classes, so the reasoner prompt includes `dependencies/classes` as empty (`None`).

---

## 9. Where to look in code (quick index)

### Frontend
1. `apps/viper-desktop/ui/components/chat-panel.tsx`
2. `apps/viper-desktop/ui/contexts/chat-context.tsx`
3. `apps/viper-desktop/ui/services/agent-api.ts`

### Backend: request routing + orchestration
1. `apps/backend/src/routes/chat.routes.ts`
2. `apps/backend/src/controllers/chat.controller.ts`
3. `apps/backend/src/services/assistant.service.ts`

### Backend: analysis trigger
1. `apps/backend/src/routes/analysis.routes.ts`
2. `apps/backend/src/controllers/analysis.controller.ts`
3. `apps/backend/src/services/analysis-options.service.ts`
4. `packages/agents/codebase-analysis-agent/pipeline/run-full-analysis.ts`

### Backend: real context adapter
1. `apps/backend/src/adapters/context-builder.adapter.ts`

### Intent agent
1. `packages/agents/intent-agent/pipeline/run-intent-pipeline.ts`
2. `packages/agents/intent-agent/modules/*`

### Context engine
1. `packages/context-builder/src/build-raw-context.ts`
2. `packages/context-ranking/src/*`

---

## 10. If you want the next improvement

Now that reasoning is aligned to `contextWindow`, the next improvement is to enrich the reasoning context:
- Option: pass dependency edges and/or class names into the reasoner prompt (derived from backend `rawContext` filtered to the selected top-K).

