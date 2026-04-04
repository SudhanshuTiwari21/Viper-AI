# Intent Agent + Codebase Analysis + Context Engine — Checklist

## Goal

- **Generic prompts** (e.g. "Hi! How are you?") → **direct LLM response**, no codebase analysis.
- **Code-related prompts** (e.g. "fix this", "implement X", "where is Y?") → **run codebase analysis** (if needed), then **context engine** → reply with **what's in place**, **what's missing**, **which file / where** (for future implementation-coding-agent).

---

## 1. Context engine validation

- [ ] **No TODOs / missing implementations in `@repo/context-builder`**
  - Status: **Done** — no TODO/FIXME in `packages/context-builder`.
  - `buildRawContext(repo_id, request, adapter)` aggregates symbol search, embedding search, dependency lookup via adapter.

- [x] **Context builder adapter is wired to real data** (done)
  - Current: Intent-agent’s `searchSymbols`, `searchEmbeddings`, `getDependencies` are **stubs** (return `[]`).
  - Required: Backend must pass a **real adapter** that:
    - `searchSymbols(term)` → query Postgres (e.g. metadata/symbols from repository_files or graph_nodes).
    - `searchEmbeddings(term)` → query Qdrant (embedding search), return `{ text, score, file?, symbol? }`.
    - `getDependencies(symbol)` → query Postgres (graph_edges / graph_nodes).
  - Action: Implement backend adapter (or intent-agent adapter impl that uses `@repo/database` + Qdrant client) and inject it when calling `buildRawContext` (e.g. instead of `getIntentAgentAdapter()` returning stub implementations).

- [ ] **Context request shape**
  - `ContextRequest`: `symbolSearch`, `embeddingSearch`, `dependencyLookup` — populated by intent-agent’s context-request-builder from tasks/entities. No changes needed in context-builder types.

---

## 2. Intent agent: generic vs code-related

- [x] **Add `GENERIC` intent type** (done)
  - Added `"GENERIC"` to `IntentType`; keyword rules give it empty list so no-match prompts get GENERIC.
  - `intent-scoring.ts`: `bestIntent ?? "GENERIC"`; with GENERIC first in rules, zero-keyword prompts get GENERIC.
  - `route-tools.ts`: `case "GENERIC"` → `{ runContextEngine: false, directLLMResponse: true }`.

- [x] **LLM-based intent classification** (done — replaces keyword detection)
  - Intent is now classified via a single LLM call: `classifyIntentWithLLM(userMessage)` in `intent-classifier/llm-intent-classifier.service.ts`. Prompt asks for one of GENERIC, CODE_FIX, FEATURE_IMPLEMENTATION, REFACTOR, CODE_EXPLANATION, CODE_SEARCH, etc.
  - `classifyIntent(normalizedPrompt)` is async and returns the LLM result; pipeline awaits it. Keyword-based scoring is no longer used for classification.

---

## 3. Heavy prompt engineering for intent agent (LLM)

- [x] **Intent reasoning prompt** (done — user request primary, intent as hint)
  - **Before:** LLM saw only intent/entities/tasks/context and a fixed "What appears to be implemented? What components may be missing? What issues may exist?" — so e.g. "fix login api", "optimize login api", "secure login api" produced nearly identical reasoning.
  - **After:** `buildReasoningPrompt(userPrompt, intent, entities, tasks, context)` in `reasoning-prompt-builder.ts`:
    - **USER REQUEST** (original user message) is **primary** and included at the top so reasoning is driven by the actual question.
    - **NORMALIZED INTENT** is passed as a **hint** (Intent Type: CODE_FIX / etc.), not a replacement for the user’s words.
    - **ENTITIES**, **TASK PLAN**, and **CODEBASE CONTEXT** (files, functions, classes, dependencies) are kept to guide the LLM and reduce hallucination.
    - **YOUR TASK** uses intent-specific focus via `getReasoningInstruction(intentType)` (e.g. CODE_FIX → "Focus on identifying bugs and fixes"; FEATURE_IMPLEMENTATION → "Focus on missing components and implementation steps"; CODE_EXPLANATION → "Focus on explaining existing logic clearly").
    - Model is asked: (1) What is already implemented? (2) What is missing or incomplete? (3) What issues or bugs may exist? (4) What should be done next to satisfy the user's request? — and must return JSON: `detectedComponents`, `missingComponents`, `potentialIssues`, `recommendedNextStep`.
  - **Pipeline:** `runReasoning(originalPrompt, intent, entities, tasks, context)` — pipeline passes the raw `prompt` as first argument so the reasoner always sees the user’s actual request.
  - **Validate:** Run with "fix login api", "optimize login api", and "secure login api" — reasoning output (e.g. `potentialIssues`, `recommendedNextStep`) should differ (bug fix vs performance vs security) instead of being identical.

- [ ] **Response generation**
  - Current: `generateIntentResponse` builds a short summary; `relevantFiles`, `detectedComponents`, `missingComponents`, etc. are optional.
  - For code-related flow: ensure **summary + detected + missing + recommendedNextStep** are surfaced in the API response and formatted in the chat UI as "What's in place" / "What needs to be done" / "Where (file, location)".

- [ ] **System / user prompt for direct LLM (generic)**
  - Current: "You are an AI software engineering assistant. Answer concisely and helpfully."
  - Optional: Tighten for greeting/small-talk so generic replies stay short and natural.

---

## 4. Pipe: intent → (optional) codebase analysis → context → response

- [x] **When to run codebase analysis** — **Current: full run on every code-related request**
  - **Current (Option A):** On every code-related chat request, `runAssistantPipeline` calls `runCodebaseAnalysisIfConfigured(workspacePath, repo_id)` (full analysis), waits `RUN_ANALYSIS_WAIT_MS`, then `buildRawContext`. Cost: slower first reply, more load.
  - **Desired (future):** Run analysis only on **changed code** (incremental/delta), like Docker layer caching — see **§7 Future: Incremental codebase analysis**.
  - Option B: If `REDIS_URL` is unset, analysis is skipped and context uses existing data.

- [ ] **Chat flow (code-related)**
  1. `runIntentPipeline(prompt)` → intent, entities, tasks, contextRequest, **reasoning** (detected/missing/issues/nextStep).
  2. `routeTools(intent, …)` → if not direct LLM, `runContextEngine: true`.
  3. **Context**: `buildRawContext(repo_id, contextRequest, realAdapter)` → rawContext (files, functions, classes, embeddings, dependencies).
  4. **Ranking** (if `runRanking`): candidates → scoring → selectTopK → contextWindow.
  5. **Response**: Return `intent`, `summary`, **reasoning** (detectedComponents, missingComponents, potentialIssues, recommendedNextStep), and **context** (files, functions, snippets) so the UI can show "what's in place" and "what needs to be done, where".

- [x] **Expose reasoning in API and UI** (done)
  - Backend: `AssistantPipelineResult` includes optional `reasoning`; populated from `intentResult.reasoning` in all code-related return paths.
  - Frontend: `ChatResponse` and `formatChatResponse` include "What's in place", "What needs to be done", "Potential issues", "Suggested next step".

---

## 5. Implementation order (recommended)

1. **Context engine** (done)
   - Real context adapter in backend (symbols from DB, embeddings from Qdrant, deps from graph) used in `runAssistantPipeline`.
   - **Verify `buildRawContext` returns non-empty data:** After `buildRawContext`, pipeline checks `rawContext` (files, functions, classes, embeddings, dependencies). If empty and analysis ran, logs "Context empty after analysis — pipeline may still be running or workspace has no indexed code"; if empty and analysis did not run, logs "Context empty — run codebase analysis (POST /analysis/run) to populate symbols and embeddings".

2. **Intent: GENERIC**
   - Add `GENERIC` intent and route it to direct LLM so "Hi" never hits context engine.

3. **Response shape and UI**
   - Add `reasoning` to `AssistantPipelineResult` and to chat API response.
   - Update `formatChatResponse` (or chat panel) to show "What's in place" / "What's missing" / "Recommended next step" from reasoning.

4. **Prompt engineering** (reasoning prompt done)
   - Reasoning prompt now includes user request as primary, intent as hint, and intent-specific instructions. LLM-based intent classification already in place.

5. **Optional: trigger analysis from chat**
   - If context is empty and intent is code-related, optionally call `runFullAnalysis` once (or prompt user to run analysis). Can be phase 2.

---

## 7. Future: Incremental (delta) codebase analysis

**Goal:** Run codebase analysis only on **changed code pieces** (like Docker layers): detect what changed, re-run the pipeline only for those files, and ensure **graphs, all table rows, and embeddings** stay consistent and up to date.

- [ ] **Detect changed files**
  - Input: workspace path, optional baseline (e.g. last scan timestamp, or git diff).
  - Output: list of added / modified / deleted file paths (and optionally modules).
  - Options: file mtime + hash, or git diff since last run, or watcher events. Persist “last known state” per repo so we can diff.

- [ ] **Repository / file list**
  - **repository_files:** Upsert rows for new/modified files; mark or delete rows for deleted files so the table reflects current workspace only.
  - Ensure `repo_id` and any “last_analyzed_at” or version fields stay correct when doing partial updates.

- [ ] **Graph (graph_nodes, graph_edges)**
  - **graph_nodes:** For changed files only: delete or mark stale nodes that belonged to the old version of those files; insert/update nodes for the new AST (symbols, modules, files). Avoid orphan nodes from deleted/renamed symbols.
  - **graph_edges:** Remove edges that referenced deleted/changed nodes; add new edges from the updated AST. Keep edges that are still valid (e.g. unchanged files). Ensure no dangling `from_node` / `to_node` references.
  - Define clear rules: e.g. “all nodes with `file = X`” get replaced when file X changes; edges touching those nodes get recomputed.

- [ ] **Embeddings (Qdrant)**
  - **Chunk identity:** Use stable chunk IDs (e.g. `repo_id:module:file` or `repo_id:module:symbol`) so we can target “this chunk” for update or delete.
  - **Changed files:** For added/modified files: re-extract chunks, re-embed, and **upsert** into Qdrant (same point ID or deterministic UUID from chunk_id). For deleted files (or deleted symbols): **delete** the corresponding points from Qdrant so the index does not serve stale content.
  - Ensure embedding model and dimensions stay the same; optional: version or collection name if you ever change schema.

- [ ] **Pipeline integration**
  - Add an “incremental” mode: instead of “scan entire repo and push all jobs”, “scan only changed files and push jobs only for those”; downstream stages (AST, metadata, graph, embeddings) consume only those jobs and write only to the affected scope (with deletes where needed).
  - Preserve ordering and dependencies: e.g. if file A imports file B, updating A might require B’s graph/embedding to be present; define whether to run in dependency order or accept eventual consistency.

- [ ] **Consistency and safety**
  - **Transactions / batches:** Where possible, make “delete old + insert new” for a given file atomic (or batched) so the context engine never sees half-updated state for that file.
  - **Orphans:** After updating graph and embeddings, run optional consistency checks: no graph_edges pointing to missing graph_nodes; no Qdrant points for files that no longer exist in repository_files.
  - **Idempotency:** Re-running incremental analysis for the same change set should produce the same DB and Qdrant state.

- [ ] **Chat / assistant integration**
  - When to trigger: e.g. on code-related chat, call “incremental analysis” (changed files only) instead of full `runFullAnalysis`; or trigger incremental on file save / workspace sync and keep chat using “existing” context.
  - Config / feature flag to switch between “full analysis on every request” (current) and “incremental analysis on changed pieces only” (future).

---

## 6. Files to touch (summary)

| Area              | Files |
|-------------------|--------|
| Intent types      | `packages/agents/intent-agent/modules/intent-classifier/intent-classifier.types.ts`, `intent-keyword-rules.ts`, `intent-scoring.ts` |
| Router            | `apps/backend/src/router/tool-router/route-tools.ts` |
| Context adapter   | New: backend adapter using `@repo/database` + Qdrant; or extend intent-agent’s symbol/embedding/dependency services to accept injected client. |
| Assistant pipeline | `apps/backend/src/services/assistant.service.ts` (inject adapter, add reasoning to result) |
| API types          | `apps/backend/src/types/api.types.ts`, `apps/viper-desktop/ui/services/agent-api.ts` |
| Chat UI            | `apps/viper-desktop/ui/components/chat-panel.tsx` (or wherever response is rendered) — show reasoning. |
| Intent reasoning   | `reasoning-prompt-builder.ts` (user prompt primary, intent hint, `getReasoningInstruction(intentType)`), `run-reasoning.ts` (pass `userPrompt`), `llm-client.service.ts` |
