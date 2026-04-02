# Viper AI Competitive Roadmap (Cursor-Class, Implementation-Grounded)

This roadmap is based on the **current implementation in this repo** (backend, desktop app, agent packages, and docs), and defines what must be built to reach Cursor-class product quality.

---

## 0) Scope and Baseline

This document is grounded in:

- `docs/BUILD_AND_RUN.md`
- `docs/ENV.md`
- `docs/INTENT_CONTEXT_ANALYSIS_WIRING.md`
- `docs/INTENT_AGENT_WITH_CONTEXT_ENGINE_DETAILED.md`
- `docs/INTENT_CONTEXT_FLOW_CHECKLIST.md`
- `docs/CHAT_HISTORY_AND_CACHE_SCOPING_PLAN.md`
- `apps/backend/README.md`
- `apps/viper-desktop/README.md`
- `packages/agents/intent-agent/README.md`
- `packages/agents/codebase-analysis-agent/README.md`
- Current code in backend orchestrator, desktop chat UI, agentic loop, and analysis pipeline.

---

## 1) Current Viper Capabilities (Implemented Today)

### 1.1 Core AI orchestration

- Backend orchestrator exists in `apps/backend/src/services/assistant.service.ts`.
- Streaming endpoint exists (`/chat/stream`, SSE).
- Intent classification + routing exists.
- Agentic tool loop exists (`runAgenticLoop`) with pause/resume on edit approval.
- Deterministic patch preview/apply/rollback path exists.
- Codebase analysis pipeline exists (scan -> AST -> metadata -> graph -> embeddings) with Redis workers.

### 1.2 Desktop IDE integration

- Electron desktop IDE with chat panel + workspace tools.
- Terminal integration exists (create/write/resize/destroy + stream output).
- Git integration exists (status/diff/stage/unstage/commit/discard).
- Debug API surface exists via preload (`debug:*` IPC).
- Diagnostics API exists (`diagnostics:*`).

### 1.3 Safety and workflow controls (recent)

- Edit gate infrastructure exists (`workflow:gate` event).
- Warmup and context primer are in place for stream path.
- Backend workflow debug logs are available via env flags.

### 1.4 Conversation and memory

- Multi-turn chat with frontend session persistence exists.
- Conversation-scoped memory hooks exist in backend.

---

## 2) Critical Gaps vs Cursor-Class Product

These are the biggest parity gaps today.

### 2.1 Product and platform gaps

- No user authentication / identity platform.
- No workspace/team account model.
- No subscription plans and billing lifecycle.
- No entitlement enforcement (what a user can use by plan).
- No production-grade per-user usage metering.

### 2.2 Model experience gaps

- No user-facing model modes like `Auto`, `Premium`, `Fast`.
- No robust model router with quality-cost-latency policy.
- Single-provider assumptions in critical paths.

### 2.3 Interaction mode parity gaps

- No fully productized mode UX contract (`Ask`, `Plan`, `Debug`, `Agent`) with strict backend enforcement.
- Current behavior is route-based, not user-mode-first.

### 2.4 Multimodal gaps

- No image upload/attachment path in chat API.
- No image-aware reasoning flow (screenshots, UI diffs, error dialogs).
- No secure media storage and lifecycle policy.

### 2.5 Tooling parity gaps

- No browser automation toolchain for agent verification loops (open app, validate change, inspect UI).
- No production tool permission model by mode/user/plan.
- No long-running task/job supervision UX for tool runs.

### 2.6 Observability and reliability gaps

- No full request trace IDs across desktop -> backend -> agents.
- No unified dashboards for latency, quality, rollback, acceptance, and cost.
- No formal SLOs and automated regression alarms for assistant quality.

### 2.7 Additional parity gaps (beyond previously listed items)

These are important missing capabilities that were not fully captured earlier and are required for world-class parity:

- No production-grade inline code completion/copilot experience in editor panes.
- No first-class inline edit UX in-file with accept/reject at cursor scope.
- No persistent project rules/profile system (repo-specific assistant behavior contracts).
- No background task queue UX (long-running agent jobs with resumable status).
- No robust checkpoint/timeline restore for agentic multi-step sessions.
- No automated PR/commit workflow assistant integrated into the IDE UX.
- No deep test intelligence loop (selective test targeting + failure triage + auto-fix retries).
- No symbol-level semantic navigation UX parity (go-to-def + references + call graph integrated with AI plans).
- No cross-repo / monorepo package impact analysis view for large-scale refactors.
- No production privacy controls for AI context boundaries (sensitive file patterns, secret-aware exclusion policies).
- No explicit model output quality evaluator pipeline (offline evals + regression benchmarks per release).
- No response-style quality controls for consistent “Cursor-like” streaming polish.

### 2.8 Browser and verification parity gaps (expanded)

- No native browser-run verification loop in implementation workflows:
  - open app URL
  - execute deterministic checks
  - compare expected vs actual UI state
  - attach screenshot/video evidence to agent result
- No framework-aware frontend validation recipes (React/Next routing checks, hydration checks, console/network error assertions).
- No UI regression snapshot baseline workflow tied to code changes.

### 2.9 Enterprise/platform parity gaps (expanded)

- No organization-level admin panel for usage, cost, and quality operations.
- No policy packs by workspace tier (startup/pro/enterprise) with centralized enforcement.
- No incident tooling for degraded provider/model behavior with automatic routing failover controls.

---

## 3) Cursor-vs-Viper Gap Matrix (Implementation-Grounded)

| Area | Cursor-class expectation | Viper current state | Gap severity |
|---|---|---|---|
| Auth & accounts | Login, user identity, workspace/team ownership | Not implemented as product auth system | Critical |
| Billing & plans | Tiered plans, quotas, billing lifecycle | Not implemented | Critical |
| Usage tracking | Per-user/workspace token + cost + tool usage | Partial logs only; no full metering product | Critical |
| Model UX | Auto/Premium/Fast selector + policy routing | No complete user-facing model-tier UX | High |
| Mode UX | Ask/Plan/Debug/Agent with strict controls | Partial route behavior; no full mode contract in product UX | High |
| Multimodal | Image upload + vision reasoning | Not implemented | High |
| Browser automation | Agent can validate UI changes in browser when needed | Not implemented in Viper runtime | High |
| Retrieval reliability | Strong hybrid retrieval with confidence orchestration | In progress; partial gating exists | High |
| Edit safety | Approval, rollback, policy checks, confidence gates | In progress; improved recently | Medium |
| Streaming UX polish | Fast, clean, deterministic phase transitions | Good base, but needs parity-level polish and telemetry | Medium |
| Enterprise policy | RBAC, path/command policies, audit controls | Early/partial | Medium |

---

## 3.1 Feature-by-Feature Status Matrix (1:1, Expanded)

Status legend:
- `Implemented`
- `In Progress`
- `Partial`
- `Missing`

| Feature | Cursor-class expectation | Viper status | Notes (implementation-grounded) |
|---|---|---|---|
| Multi-turn chat memory | Persistent conversational continuity | `Implemented` | Frontend session history + backend memory hooks exist. |
| Streaming chat (SSE) | Stable token stream with clear phases | `In Progress` | SSE exists; phase polish and stall handling need parity work. |
| Intent routing | Robust intent-to-execution policy | `Partial` | Routing exists; not yet mode-first contract. |
| Agentic tool loop | Tool-using autonomous loop with approvals | `Implemented` | Pause/resume and approval flow exists. |
| Edit safety gate | Confidence/policy-based edit blocking | `In Progress` | Gate events and warmup/context primer added recently. |
| Patch preview/apply/rollback | Deterministic code edit lifecycle | `Implemented` | Exists in implementation path. |
| Codebase indexing pipeline | Scan/AST/metadata/graph/embeddings | `Implemented` | Full pipeline exists with Redis workers. |
| Retrieval confidence model | Evidence-weighted confidence object | `Partial` | Foundations exist; standardized confidence object/UI pending. |
| Ask/Plan/Debug/Agent modes | User-selectable + backend-enforced | `Missing` | Behavior exists implicitly, not as explicit product mode contract. |
| Model selector (Auto/Premium/Fast) | User-visible model controls | `Missing` | No full UI+policy implementation. |
| Model router | Policy-based model orchestration | `Partial` | Env model selection exists; no full router with objectives. |
| Multimodal image chat | Attach images and reason over them | `Missing` | No image API/UX pipeline yet. |
| Browser automation validation | Agent checks frontend changes in browser | `Missing` | Not present in Viper runtime today. |
| Terminal copiloting depth | Structured command planning + recovery | `Partial` | Terminal integration exists; deeper command intelligence pending. |
| Git assistant UX | PR-quality git workflows in product | `Partial` | Git ops exist; PR/commit assistant lane missing. |
| Inline completion | Low-latency in-editor code completion | `Missing` | No Cursor-like completion layer shipped. |
| Inline edit UX | In-file targeted edit actions | `Partial` | Patch/hunk UI exists; cursor-local inline edit parity missing. |
| Symbol nav parity | Def/ref/call graph + AI planning integration | `Partial` | Some infra exists; cohesive UX parity missing. |
| Auth (users/workspaces) | Production identity and access model | `Missing` | No full auth platform in product flow. |
| Entitlements | Plan-based capability enforcement | `Missing` | Not implemented end-to-end. |
| Usage metering | Per-user/workspace/model/tool accounting | `Missing` | No complete billing-grade metering pipeline. |
| Subscription billing | Plans, quotas, invoices, lifecycle | `Missing` | Not implemented. |
| Admin analytics | Usage/cost/quality operations panels | `Missing` | Not implemented. |
| Policy engine | Path/tool/command enterprise policy controls | `Partial` | Some guardrails exist; not full policy system. |
| Privacy boundaries | Sensitive context exclusion controls | `Missing` | No comprehensive secret/sensitive policy layer yet. |
| Quality evaluation harness | Regression benchmarks across releases | `Missing` | No formal eval system with release gates. |
| Observability traceability | Cross-layer request trace IDs + metrics | `In Progress` | Request identity + full SSE event threading (A.1+A.2) shipped; metrics/dashboarding pending. |

---

## 4) Target Product Contract (What Viper Must Guarantee)

### 4.1 User-facing guarantees

- Fast first response without unsafe edits.
- No edit without sufficient evidence and policy checks.
- Clear phase/status visibility during every request.
- Deterministic rollback and conflict handling.
- Consistent behavior across repos and repo sizes.

### 4.2 Engineering guarantees

- Every request has traceable workflow logs.
- Every tool action is attributable and metered.
- Every model call is metered and policy-checked.
- Every plan/mode/model path is test-covered.

---

## 5) Workstreams (Step-by-Step Implementation Plan)

## WS1 — Identity, Accounts, and Entitlements (Foundational)

### Goal
Enable user/workspace identity and enforce plan-based capabilities.

### Steps
1. Add auth provider integration (session/JWT) for desktop + backend.
2. Add core entities: `users`, `workspaces`, `memberships`, `roles`.
3. Add entitlement service:
   - allowed models
   - allowed modes
   - tool restrictions
   - monthly quotas
4. Enforce entitlements in backend request middleware.
5. Surface auth state in desktop UI.

### Done criteria
- Authenticated requests only for protected endpoints.
- Entitlements enforced for mode/model/tool access.
- Audit log has user/workspace for each request.

### Verification logs (required)
- `auth:resolved { userId, workspaceId }`
- `entitlement:checked { plan, allowed, reason }`

---

## WS2 — Usage Metering and Billing Platform

### Goal
Track and monetize usage accurately.

### Steps
1. Define immutable usage event schema:
   - request ID, user/workspace/conversation
   - model/provider
   - input/output tokens
   - tool calls and durations
   - estimated cost
2. Emit events from backend for all chat requests (stream + non-stream).
3. Build aggregation jobs for daily/monthly usage.
4. Build quota checks and hard/soft limit behavior.
5. Integrate subscription provider and webhook ingestion.
6. Add usage dashboard + plan management UI.

### Done criteria
- Monthly usage and overage are reproducible from raw events.
- Plan limits are enforced in real-time.
- Billing lifecycle updates entitlements automatically.

### Verification logs (required)
- `usage:event:emitted`
- `quota:check { status, remaining }`
- `billing:webhook:applied`

---

## WS3 — Model Router + User Model UX (`Auto`, `Premium`, `Fast`)

### Goal
Provide Cursor-like model experience with cost/quality control.

### Steps
1. Add model registry abstraction (provider/model metadata).
2. Add router policy engine for `Auto` mode:
   - task complexity
   - confidence
   - latency and budget targets
3. Add fallback chain across provider/model failures.
4. Add UI model selector (`Auto`, `Premium`, `Fast`).
5. Persist mode/model choice per conversation (with entitlement checks).
6. Log route decisions for tuning.

### Done criteria
- User can explicitly choose model tier.
- `Auto` routes intelligently and predictably.
- Fallback works without breaking stream UX.

### Verification logs (required)
- `model:route:selected`
- `model:route:fallback`
- `model:tier:denied_by_entitlement`

---

## WS4 — Productized Interaction Modes (`Ask`, `Plan`, `Debug`, `Agent`)

### Goal
Make mode system first-class and enforceable.

### Steps
1. Add mode selector in chat UI.
2. Add backend mode contract and schema.
3. Enforce mode-specific behavior:
   - Ask: read-only tools, no edits
   - Plan: no edits, output structured plan
   - Debug: evidence-first workflow, no direct apply unless promoted
   - Agent: full tool path with approval gates
4. Add mode-aware prompts and narration.
5. Add mode-specific quality tests.

### Done criteria
- Mode is explicit, persisted, and visible.
- Tool permissions are mode-enforced server-side.

### Verification logs (required)
- `mode:selected`
- `mode:policy:enforced`
- `mode:tool:blocked`

---

## WS5 — Multimodal Chat (Images + Code)

### Goal
Support screenshot/image reasoning for developer workflows.

### Steps
1. Extend chat API to accept attachments metadata.
2. Build secure upload/storage service (signed URL or managed blob).
3. Add vision-capable model path in router.
4. Add image-aware prompt templates for:
   - UI bug triage
   - screenshot-to-code mapping
   - error popup interpretation
5. Add desktop chat attachment UX (paste/drag/select).
6. Add retention and privacy policy controls.

### Done criteria
- User can attach image and receive grounded, useful response.
- Image + code context can be combined in one answer.

### Verification logs (required)
- `attachment:accepted`
- `multimodal:route:selected`
- `multimodal:response:generated`

---

## WS6 — Browser Automation and UI Validation Tools

### Goal
Allow agent to validate frontend changes in-browser when needed.

### Steps
1. Add backend/browser-runner service (isolated and permissioned).
2. Add tool APIs for navigation, click/type/assert, screenshot.
3. Add policy: browser tool only in `Agent`/`Debug`, never default on every request.
4. Add verification tasks in implementation flow:
   - run app
   - navigate path
   - assert expected UI state
5. Stream browser validation status into chat events.

### Done criteria
- Agent can run targeted browser checks and report pass/fail evidence.
- Browser runs are permissioned, auditable, and bounded.

### Verification logs (required)
- `browser:session:start`
- `browser:assert:pass|fail`
- `browser:session:end`

---

## WS7 — Retrieval Reliability for Large Repos (Near-Zero Mistake Objective)

### Goal
Achieve robust file targeting and reduce wrong-edit risk in large codebases.

### Steps
1. Formal retrieval orchestrator:
   - lexical pass (always)
   - semantic pass (when index ready)
   - structural pass (symbols/deps)
2. Add confidence score object to stream + UI.
3. Add strict edit policy: require confidence >= threshold.
4. Add retrieval diagnostics panel (which retriever contributed what).
5. Add fallback clarifying-question path when confidence is low.

### Done criteria
- Edit attempts with low confidence are blocked and explained.
- Retrieval provenance is visible in UI and logs.

### Verification logs (required)
- `retrieval:confidence:computed`
- `edit-gate:blocked|passed`
- `retrieval:provenance`

---

## WS8 — Streaming and Chat Experience Parity

### Goal
Match world-class responsiveness and clarity.

### Steps
1. Standardize phase transitions for all execution paths.
2. Remove noisy/internal jargon from user-facing stream messages.
3. Improve time-to-first-useful-token via warmup policy tuning.
4. Add explicit stall detectors and recovery narration.
5. Add consistent final summaries for edits/plans/debug outcomes.

### Done criteria
- Smooth, predictable stream UX on normal and failure paths.
- No sudden dead-air without keepalive/status updates.

### Verification logs (required)
- `stream:phase:enter`
- `stream:stall:detected|recovered`
- `stream:complete`

---

## WS9 — Safety, Validation, and Regression Prevention

### Goal
Prevent silent regressions and unsafe edits.

### Steps
1. Policy engine for protected paths and command guardrails.
2. Mandatory post-edit validation pipeline (`check-types`, `lint`, optional tests).
3. Auto-repair loop with bounded retries and explicit summary.
4. Add golden-path and failure-path E2E suites.
5. Introduce quality scorecards for release gating.

### Done criteria
- Any applied edit has validation evidence.
- Failed validations are visible and recoverable.

### Verification logs (required)
- `validation:started|passed|failed`
- `auto-repair:attempt|result`

---

## WS10 — Enterprise and Team Features

### Goal
Enable organization-scale adoption.

### Steps
1. Team workspaces and roles.
2. Policy profiles by workspace.
3. Audit trails and admin controls.
4. Data retention/privacy controls.
5. Exportable usage/compliance reports.

### Done criteria
- Workspace admins can enforce policy and observe usage.

---

## 6) Near-Zero Mistake Strategy (Realistic Product Framing)

"0 mistakes" should be interpreted as **near-zero production-impact mistakes**, not literal zero model errors.

To achieve this:

- Shift risk from generation to enforcement:
  - confidence gates
  - mode restrictions
  - entitlements
  - validation before apply
  - rollback always available
- Add measurable SLOs:
  - rollback rate < target
  - wrong-file edit rate < target
  - failed-validation apply rate < target

---

## 7) Required Backend Debug Logging Contract

Every feature in this roadmap must ship with debug observability.

Minimum structured fields:

- `request_id`
- `workspace_id`
- `conversation_id`
- `user_id` (when auth lands)
- `mode`
- `model_route`
- `intent`
- `workflow_stage`
- `latency_ms`

Required stage set:

- `intent:start|complete`
- `route:direct-llm|agentic`
- `analysis:warmup:start|complete|error`
- `context-primer:start|complete|error`
- `retrieval:confidence:computed`
- `workflow:gate`
- `agentic-loop:start|complete`
- `validation:started|passed|failed`
- `result:emitted`

---

## 8) Phase Plan (Execution Order)

### Phase 1 (Weeks 1-4): Trust and Reliability Core

- WS7 retrieval confidence + strict edit gating
- WS9 validation policy and repair loop
- WS8 stream polish + observability contract
- Begin WS4 mode enforcement backend-first

### Phase 2 (Weeks 5-10): Product Parity Features

- WS4 full mode UX
- WS3 model router + model selector
- WS5 multimodal MVP
- WS6 browser automation MVP for frontend validation
- WS2 usage event pipeline (ingestion + aggregation)

### Phase 3 (Weeks 11-18): Business Platform + Scale

- WS1 auth/accounts/entitlements full rollout
- WS2 billing/subscriptions/quotas
- WS10 enterprise controls
- WS3 cost intelligence and route optimization

---

## 8.1 Detailed Step-by-Step Implementation Sequence

This is the strict execution sequence to minimize rework and de-risk production rollout.

### Step Group A — Foundation and Control Plane (must come first)

1. ~~Define canonical request identity contract (`request_id`, `workspace_id`, `conversation_id`).~~ **COMPLETE**
2. ~~Thread IDs from desktop -> backend -> all agent/tool events.~~ **COMPLETE**
3. ~~Finalize structured log schema and validation middleware.~~ **COMPLETE**
4. ~~Add centralized feature flags for modes/models/gates.~~ **COMPLETE**
5. ~~Add workflow debug endpoint returning current runtime policy snapshot.~~ **COMPLETE**

#### A.1 Status: COMPLETE

- **Implemented:** Canonical `RequestIdentity` contract (`request_id`, `workspace_id`, `conversation_id`).
- **Files:** `apps/backend/src/types/request-identity.ts` (new), `apps/backend/src/controllers/chat.controller.ts`, `apps/backend/src/services/assistant.service.ts`.
- **Evidence:** Set `VIPER_DEBUG_WORKFLOW=1`, send any `/chat/stream` request, verify all `[workflow]` log lines include `request_id`, `workspace_id`, `conversation_id`. The `stream:open` SSE event carries the full identity triple.
- **Edge cases covered:** missing workspace (400 pre-identity), null `conversationId`, resumed conversation (fresh `request_id`), client disconnect (identity in structured error log).
- **Rollback:** Single git revert; no schema/DB changes, no breaking API changes.

#### A.2 Status: COMPLETE

- **Implemented:** Thread request identity (`request_id`, `workspace_id`, `conversation_id`) into *every* SSE event payload emitted by the backend (single choke-point in `apps/backend/src/controllers/chat.controller.ts` `send()` wrapper).
- **Additive + guarded:** Identity injection only spreads into plain-object `event.data` (guard against arrays / non-plain objects).
- **Evidence:** Run `curl -N -X POST http://127.0.0.1:4000/chat/stream -H "Content-Type: application/json" --data '{"prompt":"Create a new file identity-a2-test.txt with content \"hello identity A2\".","workspacePath":"/Users/sudhanshutiwary/Desktop/Projects/Viper AI/ViperAI","conversationId":"aaaa1111-bbbb-4ccc-8ddd-eeeeffffffff","messages":[]}'` and confirm these SSE event frames include `request_id`=`bd42f999-ae6a-4c6d-ab09-cc0e2ea177b9`, `workspace_id`=`0508d19397b0495b`, `conversation_id`=`aaaa1111-bbbb-4ccc-8ddd-eeeeffffffff` inside `event.data`:
  - `tool:start`
  - `tool:result`
  - `workflow:gate`
  - `thinking:start`
  - `result`
  - `done`
- **Edge cases covered:** resumed conversation keeps `conversation_id` (A.1) while `request_id` is fresh per HTTP request; reconnect/retry uses a new HTTP request; client disconnect preserves identity in structured logs.
- **Rollback:** Revert the single controller change (SSE `send()` identity injection) to restore pre-A.2 payloads.

#### A.3 Status: COMPLETE

- **Implemented:** Zod-based canonical workflow log schema (`apps/backend/src/types/workflow-log-schema.ts`) + `validateWorkflowLog()` invoked inside `workflowLog()` in `apps/backend/src/services/assistant.service.ts` (runs only when `VIPER_DEBUG_WORKFLOW=1`).
- **Runtime behavior:** Valid payloads log normally (`[workflow] <stage>`). Invalid payloads emit `[workflow:schema-warning]` with identity + Zod issue reasons, then still emit the original workflow log line (best-effort).
- **Files:** `apps/backend/src/types/workflow-log-schema.ts`, `apps/backend/src/services/assistant.service.ts`
- **Evidence:**
  - Unit tests: `npx vitest run src/types/workflow-log-schema.test.ts`
  - Typecheck: `npm run check-types`
  - Live request: POST to `/chat/stream` with `VIPER_DEBUG_WORKFLOW=1` (set in `apps/backend/.env`) and verify backend logs contain `[Viper] [workflow] request:start ... request:complete ...` but no `[workflow:schema-warning]` lines.
- **Edge cases covered (tests + schema rules):** null `conversation_id`, missing/unknown stage, `latency_ms` allowed only for `request:complete`, intent required for `route:*` and `intent:complete`.

#### A.4 Status: COMPLETE

- **Implemented:** Centralized assistant orchestration env reads in `apps/backend/src/config/workflow-flags.ts` (`parseWorkflowRuntimeConfig`, `workflowRuntimeConfig`, `WorkflowRuntimeConfig`). `apps/backend/src/services/assistant.service.ts` now destructures from `workflowRuntimeConfig` (same defaults, clamps, and string parsing as before). Forward-compat fields `modeDefault` / `modelRouteDefault` are present on the type and set to `undefined` until A.5.
- **Files:** `apps/backend/src/config/workflow-flags.ts`, `apps/backend/src/config/workflow-flags.test.ts`, `apps/backend/src/services/assistant.service.ts`
- **Evidence:**
  - Unit tests: `npx vitest run src/config/workflow-flags.test.ts`
  - Typecheck: `npm run check-types` (from `apps/backend`)
- **Rollback:** Revert the config module + assistant.service import/destructure; restore prior top-level `process.env` reads in `assistant.service.ts`.

#### A.5 Status: COMPLETE

- **Implemented:** Gated GET `/debug/workflow-policy` returning JSON: spread of `workflowRuntimeConfig` plus `meta: { ts, nodeEnv }`. Registered from `apps/backend/src/server.ts` via `apps/backend/src/routes/debug.routes.ts`; handler in `apps/backend/src/controllers/debug-workflow.controller.ts`.
- **Gate:** `VIPER_EXPOSE_WORKFLOW_DEBUG === "1"`. Otherwise **404** (default hidden).
- **Evidence:**
  - Unit tests: `npx vitest run src/routes/debug.routes.test.ts`
  - Manual: `VIPER_EXPOSE_WORKFLOW_DEBUG=1 curl -sS http://127.0.0.1:4000/debug/workflow-policy | jq .`
- **Rollback:** Remove debug route registration, controller, routes module, and tests.

### Step Group B — Safety and reliability core

6. ~~Ship standardized retrieval confidence object in backend responses/events.~~ **COMPLETE**

#### B.6 Status: COMPLETE

- **Implemented:** Versioned `RetrievalConfidenceV1` + `buildRetrievalConfidence()` in `@repo/context-ranking` (`packages/context-ranking/src/retrieval-confidence/build-retrieval-confidence.ts`). Hybrid retrieval paths emit SSE `retrieval:confidence` before existing `context:retrieved` from `packages/agents/execution-engine/tools/context-engine.tool.ts`. Non-stream guided retrieval (`retrieveEmbeddingContextWindow` in `apps/backend/src/services/assistant.service.ts`) logs `retrieval:confidence:computed` when `VIPER_DEBUG_WORKFLOW=1`. `StreamEvent` + `apps/backend/src/execution-engine.d.ts` updated; desktop `chat-panel.tsx` ignores the new event type without breaking the stream.
- **Evidence:**
  - Unit tests: `npm test -w @repo/context-ranking` (or `npx vitest run` in `packages/context-ranking`) for `build-retrieval-confidence.test.ts`; `npm test -w @repo/execution-engine` includes `engine/stream-events.test.ts`.
  - SSE: when `executePlan` runs with `onEvent`, expect an `event: retrieval:confidence` frame (JSON body = `RetrievalConfidenceV1`) immediately before `context:retrieved` for context-tool steps.
- **Rollback:** Remove retrieval-confidence module, event variant, emissions, assistant wiring, and roadmap section.

7. ~~Enforce strict edit gate on confidence threshold (configurable).~~ **COMPLETE**

#### B.7 Status: COMPLETE

- **Implemented:** `VIPER_MIN_RETRIEVAL_CONFIDENCE_FOR_EDITS` on `workflowRuntimeConfig` (float \[0,1\], default **0** = off; invalid/non-finite → **0**; out of range clamped). When **> 0**, agentic stream path runs one `retrieveEmbeddingContextWindow` seed (same hybrid stack as B.6) with `guidanceSeedTerms` + intent entities, emits `retrieval:confidence` SSE, then enforces floor **after** analysis / files-read / discovery gates in `canEdit`. Blocks with `workflow:gate` reason `insufficient_retrieval_confidence` and metrics `retrievalOverall`, `retrievalThreshold`, optional `confidenceSchemaVersion`. Seed failure → overall **0** for gate purposes (debug log only). Desktop narration updated in `chat-panel.tsx`.
- **Files:** `apps/backend/src/config/workflow-flags.ts`, `apps/backend/src/config/workflow-flags.test.ts`, `apps/backend/src/lib/retrieval-edit-gate.ts`, `apps/backend/src/lib/retrieval-edit-gate.test.ts`, `apps/backend/src/services/assistant.service.ts`, `packages/agents/execution-engine/engine/stream-events.ts`, `apps/backend/src/execution-engine.d.ts`, `apps/viper-desktop/ui/components/chat-panel.tsx`
- **Evidence:**
  - Tests: `npx vitest run src/config/workflow-flags.test.ts src/lib/retrieval-edit-gate.test.ts` (from `apps/backend`)
  - Verify: set `VIPER_MIN_RETRIEVAL_CONFIDENCE_FOR_EDITS=0.55`, send an agentic `/chat/stream` request; expect `retrieval:confidence` then possible `workflow:gate` blocked with `insufficient_retrieval_confidence` when overall \< threshold.
  - `/debug/workflow-policy` includes `minRetrievalConfidenceForEdits` when exposure gate is on.
- **Rollback:** Remove env + gate branch + seed call + types/UI strings; revert roadmap section.

8. ~~Add mandatory post-edit validation pipeline orchestration.~~ **COMPLETE**

#### B.8 Status: COMPLETE

- **Implemented:** Feature flags `VIPER_ENABLE_POST_EDIT_VALIDATION` (default off), `VIPER_POST_EDIT_VALIDATION_COMMAND` (trimmed; empty → `npm run check-types`), `VIPER_POST_EDIT_VALIDATION_TIMEOUT_MS` (default 30000). After a **successful** `edit_file` / `create_file` in the agentic stream path, backend runs `runWorkspaceCommand` (from `@repo/workspace-tools`) and emits SSE `validation:started` | `validation:passed` | `validation:failed`. When `VIPER_DEBUG_WORKFLOW=1`, `workflowLog` emits matching stages (schema-validated). Desktop `chat-panel.tsx` ignores these events without breaking the stream. **Part A (same PR):** resume path passes mutable `gateState` + `attachAnalysisGateForEdits` so `VIPER_REQUIRE_ANALYSIS_FOR_EDITS` does not spuriously block edits on resume; resume **skips** `STREAM_ANALYSIS_WARMUP_MS` (see comment in `assistant.service.ts`).
- **Evidence:** Unit tests: `npx vitest run src/config/workflow-flags.test.ts src/lib/analysis-edit-gate.test.ts src/lib/post-edit-validation.test.ts` (from `apps/backend`); `npx vitest run packages/agents/execution-engine/engine/stream-events.test.ts`.
- **Manual verify:** Set `VIPER_ENABLE_POST_EDIT_VALIDATION=true`, trigger an agentic edit; expect `validation:started` then `validation:passed` or `validation:failed` in the SSE stream. With `VIPER_DEBUG_WORKFLOW=1`, confirm no `[workflow:schema-warning]` lines for validation stages.
- **Rollback:** Remove env keys, orchestration hook, SSE variants, desktop cases, resume `gateState` wiring, and roadmap section.

9. ~~Add bounded auto-repair pass for validation failures.~~ **COMPLETE**

#### B.9 Status: COMPLETE

- **Implemented:** `VIPER_ENABLE_POST_EDIT_AUTO_REPAIR` (default off), `VIPER_POST_EDIT_AUTO_REPAIR_COMMAND` (trimmed; empty ⇒ explicit `auto-repair:attempt|result` skip, no re-validation), `VIPER_POST_EDIT_AUTO_REPAIR_MAX_EXTRA_VALIDATION_RUNS` (clamped **1–3**, default **1** — see `workflow-flags.ts` header for **max validation runs = 1 + maxExtra**), `VIPER_POST_EDIT_AUTO_REPAIR_TIMEOUT_MS` (default follows validation timeout / 30000). After first `validation:failed`, up to **maxExtra** cycles of **repair command → re-run B.8 validation**; SSE **`auto-repair:attempt`** / **`auto-repair:result`**; `workflowLog` stages when `VIPER_DEBUG_WORKFLOW=1`; desktop `chat-panel.tsx` no-op handlers. Orchestration in `runPostEditValidationWithOptionalAutoRepair` (`post-edit-validation.ts`); still **fire-and-forget** from `onToolResult`.
- **Evidence:** `npx vitest run src/config/workflow-flags.test.ts src/lib/post-edit-validation.test.ts src/lib/post-edit-auto-repair.test.ts` (from `apps/backend`); `npx vitest run packages/agents/execution-engine/engine/stream-events.test.ts`; `src/types/workflow-log-schema.test.ts` sweeps new stages.
- **Manual SSE:** Enable B.8 + B.9 with non-empty repair command; force validation failure then repair success → expect `validation:failed` → `auto-repair:attempt` → `auto-repair:result` → `validation:started` → `validation:passed` (when applicable).
- **Rollback:** Remove B.9 env keys, wrapper + SSE + workflow stages + desktop cases + roadmap block; restore direct `runPostEditValidationOrchestration` call only if desired.

10. ~~Add reliability tests for cold index, stale index, and large repo scenarios.~~ **COMPLETE**

#### B.10 Status: COMPLETE

- **Implemented:** Vitest reliability suite for `createContextAdapter` `searchEmbeddings` (`apps/backend/src/adapters/context-builder.adapter.reliability.test.ts`): **cold** — missing collection → `[]` and no `search`; empty Qdrant results → `[]`; empty embedding vector → `[]`; Qdrant throw → `[]` (no propagate). **Stale** — Qdrant payloads with missing/`""` `file` map to `[chunk]` / `chunk_id` fallbacks and optional `file` (adapter does not stat disk; mismatched paths are caller/UI concern). **Large repo** — asserts `limit` passed to Qdrant matches `CONTEXT_ADAPTER_EMBEDDING_SEARCH_LIMIT` (20) and one-page result cardinality. Mocks only (`openai`, `@qdrant/js-client-rest`); no live Qdrant. Minimal exports on adapter for test/observability alignment: `CONTEXT_ADAPTER_QDRANT_COLLECTION`, `CONTEXT_ADAPTER_EMBEDDING_SEARCH_LIMIT`. Complementary existing caps: `packages/context-ranking/src/topk-selector/topk-selector.test.ts` (`selectTopK` / `CONTEXT_LIMITS`).
- **Evidence:** From `apps/backend`: `npx vitest run src/adapters/context-builder.adapter.reliability.test.ts` (or `npm test`). `npm run check-types`.
- **Manual:** Optional — see `docs/BUILD_AND_RUN.md` for Qdrant-off behavior; these tests encode the non-throwing contract without a running vector DB.
- **Rollback:** Remove reliability test file + adapter exports; revert roadmap block.

### Step Group C — Mode contract and UX

Milestones in this group use the **C** series (**C.11**–**C.15**) alongside the §8.1 step numbers **11–15** (Step Group **B** above remains **B.6**–**B.10**).

11. ~~Add mode enum to request schema (`ask|plan|debug|agent`).~~ **COMPLETE**

#### C.11 Status: COMPLETE

- **Implemented:** `ChatModeSchema` / `ChatMode` and `mode` on `ChatRequestSchema` (`request.schemas.ts`): trim + lowercase then `ask|plan|debug|agent`; omitted/`""`/`null` → **`agent`** (inferred output always includes `mode`). `postChat` / `postChatStream` pass `chatMode` into `runAssistantPipeline` / `runAssistantStreamPipeline` (final param, default `"agent"`). Stream path: `workflowLog` for `request:start`, `request:resume`, `request:complete` includes `{ mode: chatMode }` when **`VIPER_DEBUG_ASSISTANT=1` or `VIPER_DEBUG_WORKFLOW=1`** (same gate as other `workflowLog` lines); non-stream: `DEBUG_ASSISTANT` one-line log only. **Tool allow/deny lists and routing by mode — deferred to C.12** (step 12; no policy enforcement in this change).
- **Evidence:** `apps/backend/src/validators/request.schemas.test.ts`; `cd apps/backend && npx vitest run src/validators/request.schemas.test.ts && npm run check-types`.
- **Rollback:** Remove `mode` from schema, controller destructuring, assistant params/log fields, Fastify body `mode`, and this roadmap subsection.

12. ~~Implement backend mode policy enforcement for tool permissions.~~ **COMPLETE**

#### C.12 Status: COMPLETE

- **Implemented:** Single source of truth `getAllowedToolNames(mode)` / `isToolAllowedByMode(mode, tool)` in `apps/backend/src/lib/mode-tool-policy.ts`. Maps `ChatMode` → allowed OpenAI tool names: **ask/plan** = read-only (`read_file`, `list_directory`, `search_text`, `search_files`); **debug** = read-only + `run_command`; **agent** = full set (unchanged behavior). **Primary enforcement:** tool definitions are filtered before `runAgenticLoop` — disallowed tools are omitted so the LLM cannot select them. **Defense in depth:** `allowedToolNames` on `AgenticLoopOptions` (`agentic-loop.types.ts`) + execution guard in `run-agentic-loop.ts` — if a blocked tool call arrives despite filtering, it returns `"Tool blocked by mode policy: <name>"` without calling `execute`. **Observability:** `workflow:gate` SSE event with `reason: "mode_tool_blocked"` + `workflowLog("mode:tool:blocked", ...)` stage (added to `VALID_WORKFLOW_STAGES`). **Desktop:** `chat-panel.tsx` handles `mode_tool_blocked` reason gracefully. **Non-streaming path:** `ExecutionContext.blockedStepTypes` blocks `GENERATE_PATCH` steps in `step-runner.ts` for non-agent modes. **Resume safety:** if a paused agentic state has pending edits and `chatMode ≠ agent`, resume is refused with an explanation (user must switch to agent mode).
- **Evidence:** `npx vitest run src/lib/mode-tool-policy.test.ts src/lib/mode-tool-filtering.test.ts src/lib/mode-execution-guard.test.ts` (from `apps/backend`); `cd apps/backend && npm run check-types`; `cd packages/agents/agentic-loop && npm run check-types`.
- **Rollback:** Remove `mode-tool-policy.ts` + tests, revert `agentic-loop.types.ts` / `run-agentic-loop.ts` guard, remove `allowedToolNames` from `runAgenticLoop` calls, remove tool filtering in `runAgenticStreamPath`, remove `blockedStepTypes` from `ExecutionContext` / `step-runner.ts` / `execute-plan.ts`, remove `mode:tool:blocked` from `VALID_WORKFLOW_STAGES`, remove `mode_tool_blocked` handling in `chat-panel.tsx`, revert roadmap block. Desktop mode selector = **step 13**.

13. ~~Add mode selector in desktop chat UI.~~ **COMPLETE**

#### C.13 Status: COMPLETE

- **Implemented:** Segmented mode selector (`Ask | Plan | Debug | Agent`) in the desktop chat UI, placed above the composer in the sticky input area (`chat-panel.tsx`). Mode is stored **per session** on `ChatSession.chatMode` (default `"agent"` for existing/new sessions) — switching sessions restores that session's mode. Selector is **disabled during streaming** to prevent mid-request mode changes. API wiring: `sendChatStream` and `sendChat` in `agent-api.ts` accept an optional `mode` param and include it in the JSON body when set. The selected mode is sent as `mode` in `POST /chat/stream` requests, where the backend enforces tool permissions per C.12. Per-session mode persists to localStorage via the existing chat context serialization.
- **Files changed:** `apps/viper-desktop/ui/services/agent-api.ts` (added `ChatMode` type + `mode` param to `sendChat`/`sendChatStream`), `apps/viper-desktop/ui/contexts/chat-context.tsx` (added `ChatMode` type, `chatMode` to `ChatSession`, `setChatMode` action), `apps/viper-desktop/ui/components/chat-panel.tsx` (mode selector UI, mode wiring into `sendChatStream`).
- **Evidence:** Visual: open desktop app, mode selector visible above composer. Functional: select "Ask" → send a prompt that would edit → backend blocks edits (C.12 enforcement). Select "Agent" → normal behavior. Switch sessions → mode restores.
- **Rollback:** Remove `ChatMode` type + `mode` param from `agent-api.ts`, remove `chatMode`/`setChatMode` from `chat-context.tsx`, remove selector + mode wiring from `chat-panel.tsx`, revert roadmap block. Mode-aware narration = **step 14**.

14. ~~Add mode-aware narration and output contract.~~ **COMPLETE**

#### C.14 Status: COMPLETE

- **Implemented:** Mode-aware narration + output contract via `apps/backend/src/lib/mode-narration.ts`. Three exports: `getModePromptAddendum(mode)` returns a system-prompt addendum instructing the LLM on required output sections per mode; `getRequiredHeadings(mode)` returns the required plain-text section headings; `enforceOutputContract(content, mode)` is a lightweight post-processor that appends stub headings if the LLM omits required sections. Addenda are appended to both the direct-LLM system prompt and the agentic system prompt in `assistant.service.ts`. Post-processor runs on final content before emitting `result` events.

  **Mode output templates:**

  | Mode | Required sections | Streaming UX |
  |------|------------------|--------------|
  | **Ask** | Answer; Assumptions (optional); If you want, I can ... (optional) | Minimal: intent → answer → done. Tool calls / step timeline suppressed in desktop. |
  | **Plan** | Plan; Risks / tradeoffs; Next actions | Planning phase shown from intent. No tool / step UI. |
  | **Debug** | Observations; Hypotheses; Experiments (optional); Recommendation | Full tool activity + command output shown. No edits (C.12). |
  | **Agent** | Summary; What changed (optional); Test plan (optional) | All phases, tool calls, step timeline visible (current behavior). |

- **Desktop rendering:** `chat-panel.tsx` suppresses `tool:start`, `tool:result`, `step:start`, `step:complete` events in ask/plan modes (defense-in-depth; tools are already filtered by C.12). Intent event maps to "Planning" phase in plan mode.
- **Files changed:** `apps/backend/src/lib/mode-narration.ts` (new), `apps/backend/src/lib/mode-narration.test.ts` (new, 16 tests), `apps/backend/src/services/assistant.service.ts` (import + wiring), `apps/viper-desktop/ui/components/chat-panel.tsx` (event suppression).
- **Evidence:** `cd apps/backend && npx vitest run src/lib/mode-narration.test.ts` (16 passed); `npx vitest run` (94 total passed); `npm run check-types` clean.
- **Rollback:** Remove `mode-narration.ts` + test, remove import/usage from `assistant.service.ts`, remove event suppression from `chat-panel.tsx`, revert roadmap block. Integration tests = **step 15**.

15. ~~Add mode-specific integration tests.~~ **COMPLETE**

#### C.15 Status: COMPLETE

- **Implemented:** Deterministic backend integration suite `apps/backend/src/integration/mode-contract.integration.test.ts` that calls `runAssistantStreamPipeline` directly and collects SSE events (no Fastify server required). The suite mocks OpenAI streaming (no network), intent classification, analysis warmup, DB/memory adapters (no Postgres), and `runWorkspaceCommand` (no shell). Each mode asserts the C.14 output contract headings and C.12 tool restrictions at the streaming boundary:
  - **ask:** result contains `Answer`; no `tool:start` SSE events.
  - **plan:** result contains `Plan`, `Risks / tradeoffs`, `Next actions`; no `tool:start`.
  - **debug:** `tool:start` occurs for `run_command`; attempted `edit_file` tool call yields `workflow:gate` with `reason: mode_tool_blocked`; result contains `Observations`/`Hypotheses`/`Recommendation` (missing headings appended by post-processor).
  - **agent:** tool events allowed (`read_file`), result contains `Summary` (appended if missing).
- **Evidence:** `cd apps/backend && npx vitest run src/integration/mode-contract.integration.test.ts && npx vitest run && npm run check-types`.
- **Rollback:** Remove the integration test file and roadmap block; keep C.11–C.14 intact.

### Step Group D — Model router and model-tier product UX

16. ~~Implement model registry abstraction (provider/model metadata + limits).~~ **COMPLETE**

#### D.16 Status: COMPLETE

- **Implemented:** New shared workspace package `@repo/model-registry` (`packages/model-registry`) exporting a typed registry of models/providers/tiers and coarse metadata + policy limits:
  - Types: `ModelProvider` (initially `openai`), `ModelTier` (`auto|premium|fast`), `ModelSpec` (capabilities + limits).
  - Functions: `getModelRegistry()`, `getDefaultModelForTier(tier)`, `resolveModelSpec(modelId)`, `assertValidModelId(modelId)`.
- **Backend wiring (no router yet):** `apps/backend/src/config/workflow-flags.ts` resolves `OPENAI_MODEL` against the registry:
  - Known id → `resolvedModelId` equals env value.
  - Unknown id → falls back to registry default for `fast` tier (currently `gpt-4o-mini`) while keeping raw env in `openaiModel`.
  - `assistant.service.ts` uses `resolvedModelId` for all OpenAI calls and logs `{ model_id, provider, tier }` on `workflowLog("request:start")`. If `VIPER_DEBUG_ASSISTANT=1` and `OPENAI_MODEL` is unknown, it logs a debug warning about the fallback.
- **Tests:** `packages/model-registry/src/registry.test.ts`; backend `apps/backend/src/config/workflow-flags.test.ts` asserts known-id resolution + unknown-id fallback.
- **Evidence:** `cd packages/model-registry && npx vitest run && npm run check-types`; `cd apps/backend && npx vitest run && npm run check-types`.
- **Not done yet:** Provider failover beyond OpenAI tier failovers.
- **Rollback:** Remove `packages/model-registry`, remove registry wiring in `workflow-flags.ts`, revert `assistant.service.ts` to use raw `openaiModel`.
17. ~~Implement router policy engine for `Auto`.~~ **COMPLETE**

#### D.17 Status: COMPLETE

- **Implemented:** Policy-based model router `apps/backend/src/lib/model-router.ts` with typed inputs/outputs:
  - `RouteInputs` includes `chatMode`, `intentType`, `hasAttachments`, `isStreaming` (+ optional signals).
  - `RouteDecision` returns `selected: ModelSpec`, `reason`, `signals`; `buildFallbackChainForAuto` supplies runtime failover targets (D.18).
  - Baseline policy is intentionally small/auditable: ask/plan → fast; debug → premium; agent + complex intents → premium; else fast.
- **Config:** `VIPER_MODEL_ROUTE_DEFAULT` (`pinned|auto`), default **pinned** (preserves existing behavior). Parsed into `workflowRuntimeConfig.modelRouteDefault`.
- **Backend wiring:** After intent classification, backend calls router in both streaming + non-streaming pipelines and emits `workflowLog("model:route:selected", ...)` with `{ model_id, provider, tier, reason, signals, routeMode, mode }`. All OpenAI calls use the routed `modelId` for that request.
- **Schema:** Added `model:route:selected` to `VALID_WORKFLOW_STAGES` to avoid schema warnings when `VIPER_DEBUG_WORKFLOW=1`.
- **Tests:** Unit test `apps/backend/src/lib/model-router.test.ts` (table-driven). Integration-style test `apps/backend/src/integration/model-router.integration.test.ts` mocks OpenAI and asserts pinned vs auto selection by inspecting the `model` parameter passed to `chat.completions.create`.
- **Evidence:** `cd apps/backend && npx vitest run src/lib/model-router.test.ts src/integration/model-router.integration.test.ts && npx vitest run && npm run check-types`.
- **Rollback:** Set `VIPER_MODEL_ROUTE_DEFAULT=pinned` (or remove), remove `model-router.ts` wiring + stage if reverting fully.
18. ~~Add fallback chain + failover behavior.~~ **COMPLETE**

#### D.18 Status: COMPLETE

- **Implemented:** Bounded OpenAI-only failover: `apps/backend/src/lib/openai-chat-with-failover.ts` (`classifyOpenAIError`, non-stream + text-stream helpers, agentic stream create with retry-on-throw only). `buildFallbackChainForAuto` in `model-router.ts` builds a **tier flip** (fast ↔ premium defaults), **de-duped by id**, at most **2** fallback **slots** (`min(2, VIPER_MODEL_FAILOVER_MAX_ATTEMPTS - 1)`). **`VIPER_MODEL_FAILOVER_ENABLED`:** unset ⇒ failover **on** for `VIPER_MODEL_ROUTE_DEFAULT=auto`, **off** for `pinned`; explicit `true`/`false` overrides for both modes (primary id still comes from pin vs auto router). **`VIPER_MODEL_FAILOVER_MAX_ATTEMPTS`:** default **3** total ordered model tries (clamped 1–5). Workflow stage **`model:route:fallback`** with `{ from_model, to_model, attempt, reason, error_class }`. `@repo/agentic-loop`: optional `createChatCompletionStream` dependency injection so failover stays in the backend.
- **Evidence:** `cd apps/backend && npx vitest run && npm run check-types`; `cd packages/agents/agentic-loop && npm run check-types`.
- **Rollback:** Set `VIPER_MODEL_FAILOVER_ENABLED=0` or `VIPER_MODEL_FAILOVER_MAX_ATTEMPTS=1`; or remove failover module + revert `assistant.service` / agentic-loop wiring.
- **Not done yet:** Multi-provider failover.
19. ~~Add model selector UI (`Auto`, `Premium`, `Fast`).~~ **COMPLETE**

#### D.19 Status: COMPLETE

- **API:** Optional body field **`modelTier`** (`"auto"` | `"premium"` | `"fast"`). Explicit values are upserted server-side (D.20). Omitted → **D.20** loads persisted preference for `(workspace_id, conversation_id)` or **`auto`**. Zod: `request.schemas.ts`. Fastify lists `modelTier` on `/chat` and `/chat/stream`.
- **Precedence:** **`premium`** / **`fast`** → primary is always `getDefaultModelForTier(tier)` for that request (**overrides** `VIPER_MODEL_ROUTE_DEFAULT=pinned` and D.17 `selectModel`). **`auto`** → existing D.17 + pinned/env behavior unchanged. D.18 failover: unchanged cross-tier chain from the effective primary.
- **Observability:** `workflowLog("model:route:selected", …)` includes **`client_model_tier`** and **`tier_override_from_client`**; signals may include **`env_pinned_primary_superseded`** when the client tier overrides a pinned env primary.
- **Desktop:** `ChatSession.modelTier` + localStorage; `chat-panel.tsx` segment control (disabled while streaming); `agent-api` sends `modelTier` on every request (default `auto`).
- **Tests:** `request.schemas.test.ts`; `model-router.integration.test.ts` (premium overrides pinned; fast overrides auto+debug).
- **Evidence:** `cd apps/backend && npx vitest run && npm run check-types`.
- **Rollback:** Remove `modelTier` from schema/routes/controller/desktop; revert `routeModelForRequest` client branch and `workflowLog` fields.
20. ~~Persist per-conversation model choice with entitlement checks.~~ **COMPLETE**

#### D.20 Status: COMPLETE

- **Persistence:** Table `conversation_model_preferences` (`migration 006`, `packages/database/schema.sql`): PK `(workspace_id, conversation_id)`, `model_tier` check, `updated_at`. Upsert when the client sends an explicit `modelTier` field; load when the field is omitted and `conversationId` is present. **No `DATABASE_URL`:** in-memory store (`conversation-model-preference-store.ts`) so tests need no Postgres.
- **Entitlements:** `workflowRuntimeConfig.entitledModelTiers` from `VIPER_ALLOWED_MODEL_TIERS` + optional `VIPER_PREMIUM_REQUIRES_ENTITLEMENT` / `VIPER_PREMIUM_ENTITLED`. Disallowed tiers **downgrade** along premium → fast → auto to the best allowed tier (`model-tier-entitlements.ts`).
- **Observability:** `workflowLog("model:tier:denied", …)` with `tier_downgraded_from`, `tier_downgraded_to`, `reason`. SSE **`model:tier:downgraded`** after `stream:open` when downgraded. POST **`/chat`** includes **`tierResolution`** on the JSON body.
- **Evidence:** `cd apps/backend && npx vitest run && npm run check-types`; `cd packages/database && npm run check-types`.
- **Rollback:** Drop table / revert migration; remove `resolve-effective-model-tier` wiring from `chat.controller.ts`; unset entitlement envs; restore optional `modelTier` default in Zod if reverting D.20 only.
- **Docs:** `docs/ENV.md` (D.20 variables).

21. ~~Add model route telemetry and quality feedback loop.~~ **COMPLETE**

#### D.21 Status: COMPLETE

- **Slice 1 — Model route telemetry (structured, end-to-end):**
  - New workflow stage **`model:route:outcome`** added to `VALID_WORKFLOW_STAGES` (with optional `latency_ms`). Emitted via `workflowLog` at the end of every request (stream + non-stream).
  - Telemetry payload: `request_id`, `workspace_id`, `conversation_id`, `mode`, `effective_model_tier`, `primary_model_id`, `final_model_id` (post-failover), `fallback_chain`, `fallback_count`, `intent`, `route_mode`, `tier_downgraded`, `latency_ms`.
  - **SSE (streaming):** `model:route:summary` event emitted before `result`/`done` with the same payload; desktop parser silently ignores it (safe no-op).
  - **POST /chat:** Response includes `routeTelemetry` object alongside existing `tierResolution`.
  - **Structured stdout:** `VIPER_MODEL_TELEMETRY=1` writes one JSON line per request to stdout (`_type: "viper.route.telemetry"`) for ops scraping without enabling full debug.
  - Type: `RouteTelemetry` / `RouteMeta` in `apps/backend/src/types/route-telemetry.ts`.
  - `AssistantPipelineResult.routeMeta` populated by every exit path (direct LLM, agentic, execution plan).
- **Slice 2 — Quality feedback loop:**
  - **API:** `POST /chat/feedback` with body `{ request_id, message_id?, rating: "up"|"down", tags?: [...], comment?, workspace_id }`. Zod schema `ChatFeedbackSchema`. Tags enum: `incorrect`, `too_slow`, `great`, `off_topic`, `incomplete`. Comment max 1000 chars.
  - **Storage:** Postgres table `chat_feedback` (migration `007`), indexes on `(workspace_id, created_at)` and `request_id`. In-memory fallback when `DATABASE_URL` is not set (same pattern as `conversation-model-preference-store.ts`).
  - **Stats:** `GET /feedback/stats?workspace_id=…&since=…` returns `{ up, down, total }`.
  - **Observability:** `workflowLog("feedback:received", …)` with `rating`, `tags`, `message_id`.
  - **Desktop:** Thumbs up/down on assistant messages. `request_id` captured from `stream:open` SSE event and stored on `ChatMessage.requestId`. Toggle feedback state stored in `ChatMessage.feedbackRating`.
- **Evidence:** `cd apps/backend && npx vitest run && npm run check-types` (154 tests, 22 files). `cd packages/database && npm run check-types`.
- **Env vars:** `VIPER_MODEL_TELEMETRY` (D.21); see `docs/ENV.md`.
- **Rollback:** Remove `model:route:outcome` + `feedback:received` from stages; remove telemetry emission from `assistant.service.ts` + `chat.controller.ts`; remove feedback routes/controller/store; drop `chat_feedback` table; unset `VIPER_MODEL_TELEMETRY`.

### Step Group E — Multimodal and browser verification

22. Extend API schemas for image attachments.
23. Build secure upload and media reference system.
24. Add multimodal routing and vision-capable prompt templates.
25. Add desktop image attachment UX.
26. Build browser-runner tool service (permissioned).
27. Add frontend validation recipe library (navigate/assert/screenshot).
28. Stream browser evidence back into chat events.

### Step Group F — Product platform (auth, metering, billing)

29. Add user/workspace auth and membership schema.
30. Implement entitlement service and middleware.
31. Emit billing-grade usage events for every request.
32. Build usage aggregation jobs and storage.
33. Implement quota checks and hard/soft enforcement.
34. Integrate subscription provider + webhook ingestion.
35. Build usage/billing/admin product surfaces.

### Step Group G — Advanced parity and differentiation

36. Ship inline completion/copilot service for editor.
37. Ship inline in-file edit UX actions.
38. Add PR/commit assistant lane.
39. Add selective test targeting and failure triage workflows.
40. Add privacy boundary policy layer for context extraction.
41. Add offline evaluation harness + release quality gates.

### Step Group H — Production hardening and launch readiness

42. Define SLOs for latency/quality/safety/cost.
43. Add dashboards and alerting for SLO burn rates.
44. Run shadow traffic or staged rollout for new router policies.
45. Execute final parity checklist and release review.

---

## 9) Immediate Action Backlog (Next 2 Sprints)

1. Add confidence score object to stream events + chat UI rendering.
2. Add strict confidence threshold for edits.
3. Add request-level trace IDs from desktop to backend.
4. Add debug endpoint for current workflow mode/gate/model config.
5. Add mode selector UI with backend mode schema enforcement.
6. Add model selector UI and backend route metadata plumbing.
7. Define usage event schema and write all request events.
8. Add auth architecture doc + DB schema draft.
9. Add multimodal API schema and desktop attachment UX spec.
10. Add browser validation tool design doc and safety policy.

## 9.1 Additional parity backlog (newly identified)

1. Build IDE inline completion pipeline with low-latency local context extraction.
2. Add in-editor inline edit flow with mini diff approve/reject UX.
3. Implement repository rules system (`viper-rules` style) with scoped precedence and safe defaults.
4. Add background job runner for long tasks with resume/cancel/status history.
5. Add session checkpoints with “restore to step N” for agent workflows.
6. Add PR/commit assistant lane (message quality, staged diff review, optional auto-PR draft).
7. Build selective test targeting engine (changed files -> impacted tests).
8. Add test-failure triage summarizer and bounded auto-fix loop.
9. Add AI quality benchmark suite with weekly regression scoring.
10. Add response-style guardrails to standardize stream narration and final output quality.
11. Add browser verification MVP with screenshot evidence attached to tool results.
12. Add privacy policy layer for sensitive path exclusion and secret-safe context filtering.

---

## 10) Acceptance Checklist for "Cursor-Class Readiness"

Viper should not claim parity until all are true:

- User accounts + workspace auth in production.
- Plan/entitlement enforcement active.
- Accurate usage metering and billing lifecycle working.
- User-visible model tiers (`Auto`, `Premium`, `Fast`) working.
- User-visible modes (`Ask`, `Plan`, `Debug`, `Agent`) fully enforced.
- Multimodal image chat shipped.
- Browser-based validation available for agentic frontend tasks.
- Confidence-gated editing with validation-before-apply shipped.
- Full observability and quality dashboards live.

---

## 11) Notes on Current State Accuracy

This roadmap intentionally reflects current Viper implementation characteristics observed in code and docs, including:

- Strong backend orchestration foundation.
- Existing agentic loop and patch approval model.
- Existing analysis pipeline architecture.
- Existing desktop IDE integrations (terminal, git, debug, diagnostics).
- Missing product platform layers (auth/billing/entitlements/multimodal/model-tier UX).

Any future roadmap updates should continue to be implementation-grounded and validated through backend debug logs before feature sign-off.
