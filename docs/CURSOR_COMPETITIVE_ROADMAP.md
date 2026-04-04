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

22. ~~Extend API schemas for image attachments.~~ **COMPLETE**

#### E.22 Status: COMPLETE

- **Attachment model (Zod, in `request.schemas.ts`):**
  - `AttachmentSchema` — discriminated union on `kind`. Only `"image"` for E.22.
  - Two source variants, discriminated on `source.type`:
    - **`media_ref`** (canonical/production): `{ type: "media_ref", mediaId: string }` — opaque ID resolved in E.23.
    - **`inline_base64`** (dev-only): `{ type: "inline_base64", mimeType, data }` — strict limits: mimeType allowlist (`image/png`, `image/jpeg`, `image/webp`, `image/gif`), max ~6 MiB decoded per image, max 12 MiB total across all inline attachments, max 8 attachments per request.
  - Unknown `kind` or `source.type` rejected with clear Zod errors.
  - Exported: `AttachmentSchema`, `ImageAttachmentSchema`, `Attachment`, `ImageAttachment`, `INLINE_IMAGE_MIME_ALLOWLIST`, `INLINE_IMAGE_MAX_BYTES`, `INLINE_IMAGES_MAX_TOTAL_BYTES`, `ATTACHMENT_MAX_COUNT`.
- **`ChatRequestSchema`:** new optional `attachments` field. Omitting it is a no-op — full backward compatibility with pre-E.22 clients.
- **Fastify body schema (`chat.routes.ts`):** both `/chat` and `/chat/stream` now declare `attachments` (loose JSON Schema; Zod is authoritative for validation).
- **Plumbing:** `postChat` + `postChatStream` destructure and forward `attachments` to `runAssistantPipeline` / `runAssistantStreamPipeline` (new optional last arg). Both pipeline functions accept and safely ignore attachments for LLM calls. Debug log `multimodal:attachments:received` (new workflow stage) emitted when `DEBUG_ASSISTANT=1` and attachments are present.
- **Tests:** 15 new cases in `request.schemas.test.ts` — valid `media_ref`, valid `inline_base64`, invalid mime, oversize per-image, total-oversize, unknown kind, unknown source.type, missing mediaId, max count exceeded, empty array, omitted field, sanitize preserves attachments. All 170 tests green.
- **Not done (explicit deferrals):**
  - E.23: presigned upload, blob storage, media lifecycle, mediaId resolution.
  - E.24: vision-model routing, prompt templates with image parts.
  - E.25: file picker and send-from-desktop UX.
  - `inline_base64` env-configurable limits (deferred to E.23).

23. ~~Build secure upload and media reference system.~~ **COMPLETE**

#### E.23 Status: COMPLETE

- **Database (Postgres):**
  - Migration `008_create_chat_media.sql` → table `chat_media` with columns: `id TEXT PK`, `workspace_id`, `mime_type`, `byte_size`, `sha256`, `storage_key`, `created_at`, `expires_at` (nullable TTL). Index on `(workspace_id, created_at)`.
  - Repository (`packages/database/src/chat-media.repository.ts`): `insertChatMedia`, `getChatMedia` (workspace-scoped), `deleteChatMedia`, `listExpiredChatMedia` (for cleanup sweeps).
  - `packages/database/src/index.ts` exports all four functions + `ChatMediaRow`.
- **Storage driver (`apps/backend/src/lib/media-storage.ts`):**
  - `writeMediaBytes` / `readMediaBytes` / `deleteMediaBytes` — local-disk driver using `VIPER_MEDIA_STORAGE_DIR` (default `<os.tmpdir()>/.viper-media`). Path-traversal guard on all operations. Swap for S3/GCS in E.23.1.
- **Media store (`apps/backend/src/lib/media-store.ts`):**
  - Same D.20/D.21 fallback pattern: no `DATABASE_URL` → both metadata and bytes held in-memory Maps (dev/test only); with `DATABASE_URL` → Postgres + disk.
  - `saveMedia({ workspaceId, mimeType, data })`: validates MIME in allowlist + magic-bytes sniff (detects PNG/JPEG/GIF/WEBP); rejects mismatch; issues `med_<24-hex>` mediaId; optionally sets `expires_at` when `VIPER_MEDIA_TTL_HOURS` is configured.
  - `getMediaMeta(workspaceId, mediaId)`: returns null on workspace mismatch (isolation).
  - `resolveMediaBuffer(workspaceId, mediaId)`: E.24 hook — returns `Buffer | null`; checks expiry; callable from `assistant.service` once vision routing is wired.
  - `deleteMedia(workspaceId, mediaId)`: workspace-scoped deletion.
- **API routes (`apps/backend/src/routes/media.routes.ts`):**
  - `POST /media/upload` — JSON body `{ workspace_id, mimeType, dataBase64 }`. Validates MIME allowlist, per-file 6 MiB limit, magic-bytes agreement. Response: `{ mediaId, mimeType, byteSize, sha256 }`. Works from curl: `curl -X POST -H 'Content-Type: application/json' -d '{"workspace_id":"...","mimeType":"image/png","dataBase64":"..."}' http://localhost:4000/media/upload`
  - `POST /media/upload/multipart` — multipart/form-data path (requires `@fastify/multipart` registered; controller degrades gracefully to 501 if plugin is absent). Production path for E.23.1.
  - `GET /media/:mediaId?workspace_id=<id>` (or `x-workspace-id` header) — returns raw bytes + `Content-Type`. 404 on missing/workspace mismatch; 410 on expired (TTL).
- **Observability:** workflow stages `multimodal:media:uploaded` + `multimodal:media:resolved` added to `VALID_WORKFLOW_STAGES`; logged (when `DEBUG_ASSISTANT=1`) with `{ media_id, mime_type, byte_size }`.
- **Env vars:** `VIPER_MEDIA_STORAGE_DIR`, `VIPER_MEDIA_TTL_HOURS` — see `docs/ENV.md`.
- **Tests:** 24 unit tests in `media-store.test.ts` (sniff, validate, save/get/resolve/delete, expiry, wrong-workspace) + 10 route integration tests in `media.routes.test.ts` (full round-trip, workspace isolation, 404, 413, 400 MIME mismatch, header-based workspace_id). 204 total tests green.
- **Evidence:** `cd apps/backend && npx vitest run && npm run check-types` + `cd packages/database && npm run check-types`.
- **Not done (explicit deferrals):**
  - E.23.1: S3/GCS storage driver (swap `media-storage.ts` driver functions).
  - E.23.1: `@fastify/multipart` plugin registration in `server.ts` for the multipart upload path.
  - E.23.1: Automatic cleanup job for expired objects (use `listExpiredChatMedia()` manually until then).
  - E.24: Vision routing — `resolveMediaBuffer` is the stub hook, unused in LLM calls until E.24.
  - E.25: Desktop file-picker and UI for selecting/sending attachments.
- **Rollback:** Remove migration 008; drop `chat_media` table; remove `media.routes.ts`, `media.controller.ts`, `media-store.ts`, `media-storage.ts`; remove exports from `packages/database/src/index.ts`; remove `multimodal:media:*` from `VALID_WORKFLOW_STAGES`; unset `VIPER_MEDIA_STORAGE_DIR`, `VIPER_MEDIA_TTL_HOURS`.

24. ~~Add multimodal routing and vision-capable prompt templates.~~ **COMPLETE**

#### E.24 Status: COMPLETE

- **Multimodal content builder (`apps/backend/src/lib/multimodal-content.ts`):**
  - `buildMultimodalUserContent(prompt, attachments, workspaceId)` → `ContentPart[]` for the OpenAI user message.
  - Leading `{ type: "text", text: prompt }` part followed by one `{ type: "image_url", … }` per attachment in stable input order.
  - `inline_base64` → constructs `data:<mime>;base64,<data>` URL directly (already validated by E.22 schema).
  - `media_ref` → calls `getMediaMeta` (expiry + workspace check) then `resolveMediaBuffer` (E.23) → data URL.
  - `MultimodalResolutionError` (statusCode 400 | 502): missing media, wrong workspace, expired TTL, or storage inconsistency.
- **Vision routing (`apps/backend/src/lib/model-router.ts`):**
  - `selectModel`: if `hasAttachments`, sets `signals.vision_required = true`; if selected model lacks `capabilities.vision`, upgrades to premium default (reason `"vision_upgrade_to_premium"`, `signals.vision_upgraded = true`, `visionUpgraded: true` on `RouteDecision`).
  - `VisionNotSupportedError` exported — thrown by `routeModelForRequest` in `assistant.service.ts` if no vision-capable model is found after upgrade attempt (→ 400 in controller).
- **`routeModelForRequest` (assistant.service.ts):**
  - Added `hasAttachments?: boolean` param; threaded to `selectModel` (auto path) and post-selection vision check (pinned / client-tier paths).
  - All three `routeModelForRequest` calls in `runAssistantPipeline` + `runAssistantStreamPipeline` (GENERIC + agentic + resume) now pass `hasAttachments: Boolean(attachments?.length)`.
- **LLM wiring:**
  - `runDirectLLM`: added `attachments?`, cache-bust (`canUseCache &&= !hasAttachments`), vision system addendum via `getMultimodalSystemAddendum(chatMode)`, multimodal `userContent` resolved before `buildRequest`.
  - `runDirectLLMStream`: same; content resolved before `streamBody` is constructed.
  - `runAgenticStreamPath`: added `attachments?`; multimodal `userContent` used for both fresh and resume paths (current turn only); agentic system prompt extended with vision addendum when images present.
- **System prompt addendum (`apps/backend/src/lib/mode-narration.ts`):**
  - `getMultimodalSystemAddendum(mode)`: short, mode-aware instruction appended only when `attachments?.length > 0`. Debug mode emphasises error messages / stack traces in images; plan mode focuses on incorporating visual context.
- **Controller error handling:**
  - `chat.controller.ts`: `VisionNotSupportedError` → 400; `MultimodalResolutionError` → 400 (or 502). Applied to both stream and non-stream paths. Logged at `warn` level (not `error`).
- **Cache policy:** LLM response cache disabled for any request carrying image attachments (two identical prompts with different images must always reach the model).
- **History:** only the current user turn carries image parts (E.22 semantics). History messages remain plain strings.
- **Tests:**
  - `multimodal-content.test.ts`: 11 unit tests covering inline_base64, media_ref round-trip (mocked store), wrong-workspace 400, expired 400, unavailable bytes 502, multiple attachments in order, empty list.
  - `model-router.test.ts`: 4 new vision-routing tests: `vision_required` signal, no unneeded upgrade with vision-capable models, `VisionNotSupportedError` shape.
  - 218 total tests green.
- **Evidence:** `cd apps/backend && npx vitest run && npm run check-types`
- **No new env vars** (MIME allowlist, per-file limits, and storage vars defined in E.22/E.23).
- **Not done (explicit deferrals):**
  - ~~E.25: Desktop file-picker, thumbnail previews, upload orchestration in the UI.~~ **DONE in E.25.**
  - Multimodal history: images in `messages[].content` (deferred, documented in E.22 as follow-up).
  - Cloud vision provider / model expansion beyond OpenAI (E.26+).
- **Rollback:** Remove `multimodal-content.ts`; revert `model-router.ts` (remove `VisionNotSupportedError`, `visionUpgraded`, `vision_required`/`vision_upgraded` signals); revert `routeModelForRequest` + LLM call sites in `assistant.service.ts` to prior signatures; revert `mode-narration.ts`; revert controller catch blocks.

~~25. Add desktop image attachment UX.~~ **COMPLETE**

---

### E.25 Status: COMPLETE

**What was built:**

- **`apps/viper-desktop/ui/lib/workspace-id.ts`** — `deriveWorkspaceId(path): Promise<string>` mirrors the backend's `createHash("sha256").update(normalised).digest("hex").slice(0,16)` algorithm using `crypto.subtle`. Platform-sensitive case-fold (lowercase on macOS/Windows, match on Linux) via `navigator.platform`. Exports `normalizePath` and `isPlatformCaseFold` for testing.
- **`apps/viper-desktop/ui/services/agent-api.ts`** — Added:
  - `ATTACHMENT_MIME_ALLOWLIST`, `ATTACHMENT_MAX_BYTES` (6 MiB), `ATTACHMENT_MAX_COUNT` (8) constants.
  - `MediaRefAttachment` type matching E.22 schema.
  - `uploadChatMedia({ workspaceId, file }): Promise<MediaUploadResponse>` — reads file as `ArrayBuffer → base64`, sends JSON body `{ workspace_id, mimeType, dataBase64 }` to `POST /media/upload`, with client-side MIME allowlist + 6 MiB pre-validation.
  - Extended `sendChat` and `sendChatStream` signatures with optional `attachments?: MediaRefAttachment[]`; the `attachments` key is only included in the JSON body when non-empty (backward compatibility guaranteed).
- **`apps/viper-desktop/ui/contexts/chat-context.tsx`** — Added `PendingAttachment` type (`mediaId`, `mimeType`, `fileName`, `previewObjectUrl`); added `pendingAttachments: PendingAttachment[]` state + `addPendingAttachment`, `removePendingAttachment` (revokes object URL), `clearPendingAttachments` (revokes all) to context. Session switch revokes and clears stale attachments.
- **`apps/viper-desktop/ui/components/chat-panel.tsx`** — Full attachment UX:
  - Hidden `<input type="file" accept="…" multiple>` behind a `<Paperclip>` attach button (disabled while streaming or uploading).
  - Per-file `uploadChatMedia` (uses `deriveWorkspaceId` for `workspaceId`) with inline error display.
  - Thumbnail strip (48×48 px object-URL previews) with per-item remove button (revokes URL).
  - Count guard: rejects pick if `existing + new > ATTACHMENT_MAX_COUNT`.
  - On send: snapshot pending attachments → `sendChatStream(..., attachments)` → `clearPendingAttachments()`. Attachments are cleared on send start (error path: stale media persists on server, user can re-attach if needed).
  - Attach button accent-colored while files are pending, pulsing while uploading.

**Evidence commands:**
```bash
# Desktop tests (workspace-id vectors + attachment body shape)
cd apps/viper-desktop && npm test
# → Test Files 1 passed (1), Tests 20 passed (20)

# Backend tests (no regressions)
cd apps/backend && npx vitest run
# → Test Files 25 passed (25), Tests 218 passed (218)
```

**Not done (explicit deferrals):**
- E.26+: Browser-runner toolchain (screenshots, UI validation).
- Multimodal message history: images in `messages[].content` (still deferred from E.22/E.24).
- Drag-and-drop file attach (can layer on top of the hidden `<input>` without further backend changes).
- Upload progress indicator (POST /media/upload is typically fast for ≤6 MiB; the `uploading` state pulse is the current signal).

**Rollback:** Remove `workspace-id.ts`; revert `agent-api.ts` (remove `uploadChatMedia`, attachment types, `attachments` param from `sendChat`/`sendChatStream`); revert `chat-context.tsx` (remove `PendingAttachment`, pending-attachment state + callbacks); revert `chat-panel.tsx` (remove Paperclip import, `handleAttachFiles`, thumbnail strip, file input, `sendAttachments` construction).

---

~~26. Build browser-runner tool service (permissioned).~~ **COMPLETE**

---

### E.26 Status: COMPLETE

**Architecture:** In-process Playwright facade (`packages/browser-runner`) — no separate microservice. Session is per agentic-loop request, lazy-opened on first tool use, force-closed after loop completion (or on session lifetime expiry).

**What was built:**

- **`packages/browser-runner/`** (new package `@repo/browser-runner`):
  - `src/url-allowlist.ts` — `isUrlAllowed(url, extraOrigins?)`: default-allows `http(s)://localhost` and `http(s)://127.0.0.1`; blocks `file:`, `data:`, `javascript:`, `blob:` unconditionally; extra origins via `VIPER_BROWSER_ALLOWED_ORIGINS`. `parseAllowedOrigins()` parses the env var.
  - `src/browser-session.ts` — `BrowserSession` class: lazy `open()`, `navigate(url)` (URL policy checked before Playwright call), `screenshot({ fullPage? })` (base64-encoded PNG, truncated to `VIPER_BROWSER_SCREENSHOT_MAX_BYTES`), `close()`. Hard session lifetime timer. Playwright loaded via dynamic `import('playwright')` so the package is installable without the browsers; throws `BrowserRunnerError` if not installed.
  - `src/index.ts` — exports `isBrowserToolsEnabled()` (reads `VIPER_BROWSER_TOOLS`), `BROWSER_TOOL_NAMES`, `BrowserSession`, `createBrowserSession`, `BrowserRunnerError`, URL helpers.
- **`packages/agents/agentic-loop/prompt/browser-tool-defs.ts`** — `buildBrowserTools(getSession, enabled, callbacks?)`: returns `[]` when `enabled=false` (env kill-switch off); returns 2 `AgenticToolDefinition` entries (`browser_navigate`, `browser_screenshot`) when enabled. Session factory is injected so the loop core stays decoupled from the runner package.
- **`packages/agents/agentic-loop/index.ts`** — exports `buildBrowserTools`, `BrowserToolSession`, `BrowserToolCallbacks`.
- **`apps/backend/src/lib/mode-tool-policy.ts`** — Added `BROWSER_TOOLS` set (`browser_navigate`, `browser_screenshot`); extended `DEBUG_WITH_BROWSER` and `ALL_WITH_BROWSER` sets; `debug` and `agent` modes see browser tools; `ask` and `plan` never do. Added `isBrowserTool()` helper.
- **`apps/backend/src/types/workflow-log-schema.ts`** — Added `browser:session:start`, `browser:navigate`, `browser:screenshot`, `browser:session:end`, `browser:policy:denied` to `VALID_WORKFLOW_STAGES`.
- **`apps/backend/src/services/assistant.service.ts`** — In `runAgenticStreamPath`: builds `browserTools` via `buildBrowserTools(getBrowserSession, isBrowserToolsEnabled(), callbacks)`; merges into `allToolsWithBrowser`; session is closed + `browser:session:end` logged after `runAgenticLoop` returns. Workflow log emitted on session start, navigate, screenshot, and policy denial.
- **`docs/ENV.md`** — 6 new env vars documented.

**Evidence commands:**
```bash
# Browser-runner unit tests (URL allowlist + session mocking)
cd packages/browser-runner && npm test
# → Test Files 2 passed (2), Tests 38 passed (38)

# Backend tests (mode gating + buildBrowserTools + all previous tests)
cd apps/backend && npx vitest run
# → Test Files 25 passed (25), Tests 232 passed (232)

# Backend type check
cd apps/backend && npm run check-types
# → (no output = clean)

# Local e2e setup (requires Playwright)
npm install playwright
npx playwright install chromium
VIPER_BROWSER_TOOLS=1 npm run dev -w @repo/backend
```

**Regression guarantee:**
- `VIPER_BROWSER_TOOLS` unset (default): `buildBrowserTools(..., false)` returns `[]`; no browser tool definitions passed to the model; agentic loop, edits, and existing tools unchanged.
- `ask` / `plan` modes: browser tools absent from `getAllowedToolNames` result; runtime allowedToolNames check blocks them even if `VIPER_BROWSER_TOOLS=1`.

**Not done (explicit deferrals):**
- ~~E.27: selector/assert recipe library~~ — shipped in E.27.
- E.28: streaming browser sub-events into SSE beyond `tool:start` / `tool:result`.
- Cloud browser providers (BrowserStack, Sauce Labs).
- Screenshot diffing / visual regression.

**Rollback:** Remove `packages/browser-runner/`; remove `buildBrowserTools` export from `@repo/agentic-loop/index.ts`; remove `packages/agents/agentic-loop/prompt/browser-tool-defs.ts`; revert `mode-tool-policy.ts` (remove `BROWSER_TOOLS`, `isBrowserTool`, browser sets); revert `workflow-log-schema.ts` (remove browser stages); revert `assistant.service.ts` imports + session wiring; remove `@repo/browser-runner` from `apps/backend/package.json`.

---

### E.27 Status: COMPLETE

**What was implemented:**

1. **`packages/browser-runner/src/env-helpers.ts`** — Extracted `envInt` helper (shared by `browser-session.ts` and the new recipe module).
2. **`packages/browser-runner/src/validation-recipe.ts`** — Core recipe library:
   - `RecipeStep` discriminated union: `navigate | wait_for_selector | assert_text | screenshot`.
   - `validateRecipeStep` — per-step validation (selector length, url presence, substring non-empty).
   - `parseRecipeSteps(raw, maxSteps?)` — validates and normalises unknown input into typed steps.
   - `runRecipeSteps(session, steps, callbacks?)` — executes steps in order; stops on first failure (screenshot is non-fatal); fires `onAssertPass` / `onAssertFail` hooks.
   - `formatRecipeResult` — compact multi-line summary for the model; appends screenshot base64 when present.
   - `assertPageText` — duck-typed Playwright page helper (testable without real browser).
   - Constants + env overrides: `VIPER_BROWSER_MAX_RECIPE_STEPS` (default 20), `VIPER_BROWSER_ASSERT_TIMEOUT_MS` (default 5 s), `VIPER_BROWSER_MAX_SELECTOR_LEN` (default 512).
3. **`packages/browser-runner/src/index.ts`** — Exports all new types and functions; extended `BROWSER_TOOL_NAMES` to 5 entries.
4. **`packages/agents/agentic-loop/prompt/browser-tool-defs.ts`** — Added three new agent tools alongside the E.26 pair:
   - `browser_assert_text` — asserts a text substring on the page or within a CSS selector.
   - `browser_wait_for_selector` — waits until a CSS selector is visible.
   - `browser_run_recipe` — runs an ordered list of recipe steps as a single atomic call.
   - All three honour the same env kill-switch and session factory as E.26 tools.
   - Added `onAssertPass` / `onAssertFail` to `BrowserToolCallbacks`.
5. **`apps/backend/src/lib/mode-tool-policy.ts`** — Added three new tool names to `BROWSER_TOOLS`; `debug` and `agent` modes inherit them automatically.
6. **`apps/backend/src/types/workflow-log-schema.ts`** — Added `browser:assert:pass` and `browser:assert:fail` stages (WS6-aligned).
7. **`apps/backend/src/services/assistant.service.ts`** — Wired `onAssertPass` / `onAssertFail` callbacks to emit the new workflow stages.

**Evidence commands:**
```bash
# Recipe + allowlist + session unit tests
cd packages/browser-runner && npm test
# → 86 tests pass (48 new E.27 recipe tests + 38 prior E.26)

# Backend tests (mode policy, new tools, workflow stages)
cd apps/backend && npx vitest run
# → 249 tests pass

# Type checks
cd packages/browser-runner && npm run check-types  # clean
cd apps/backend && npm run check-types              # clean
```

**Regression guarantee:**
- `VIPER_BROWSER_TOOLS` unset: `buildBrowserTools(..., false)` returns `[]`; none of the 5 browser tools (E.26 or E.27) are registered.
- `ask` / `plan` modes: all browser tools absent from `getAllowedToolNames`; mode gate blocks them even if the env switch is on.
- E.26 tools (`browser_navigate`, `browser_screenshot`) unchanged in behaviour.

**Not done (explicit deferrals):**
- ~~E.28: streaming browser sub-events into SSE~~ — shipped in E.28.
- Visual diff / pixel comparison.
- Non-local origins beyond `VIPER_BROWSER_ALLOWED_ORIGINS`.

**Rollback E.27 only:** Delete `validation-recipe.ts`; revert `index.ts` exports; remove the 3 new tools from `browser-tool-defs.ts` and `BROWSER_TOOLS`; remove `browser:assert:pass|fail` from `workflow-log-schema.ts`; remove `onAssertPass`/`onAssertFail` callbacks from `assistant.service.ts`.

---

### E.28 Status: COMPLETE

**What was implemented:**

1. **`packages/agents/execution-engine/engine/stream-events.ts`** — Added `browser:step` StreamEvent variant with a `BrowserStepEventPayload` shape:
   - `phase`: `"session:start" | "navigate" | "screenshot" | "assert:pass" | "assert:fail" | "policy:denied" | "session:end"`
   - Optional: `stepIndex`, `detail` (capped at 200 chars), `url`, `rawBytes`, `kind`
   - Intentionally small — no base64, no raw HTML.
2. **`apps/backend/src/execution-engine.d.ts`** — Mirror of the new event type for the backend's ambient declaration.
3. **`packages/agents/agentic-loop/prompt/browser-tool-defs.ts`** — Extended `BrowserToolCallbacks` with `onBrowserStreamEvent?: (payload: BrowserStepEventPayload) => void`. Wired it into every tool's execute path:
   - `browser_navigate`: emits `session:start` (before navigate), `navigate` (on success) or `policy:denied` (on block).
   - `browser_screenshot`: emits `screenshot` with `rawBytes` and capped `detail`.
   - `browser_assert_text`: emits `assert:pass` or `assert:fail` with `kind: "assert_text"`.
   - `browser_wait_for_selector`: emits `assert:pass` or `assert:fail` with `kind: "wait_for_selector"`.
   - `browser_run_recipe`: bridges recipe `onAssertPass`/`onAssertFail` callbacks to `onBrowserStreamEvent` with the correct `stepIndex`.
   - Exported `BrowserStepEventPayload` from `@repo/agentic-loop/index.ts`.
4. **`apps/backend/src/services/assistant.service.ts`** — Added `onBrowserStreamEvent` callback that calls `onEvent({ type: "browser:step", data: payload })`. Also emits `session:end` SSE event when the browser session is torn down after the loop completes.
5. **`apps/viper-desktop/ui/components/chat-panel.tsx`** — Added `case "browser:step": break;` no-op in the stream event switch, preventing unknown-event errors and ensuring the desktop stream stays compatible.
6. **`apps/backend/src/lib/browser-sse.test.ts`** — 15 new unit tests covering:
   - Env-off: no events emitted when `enabled=false`.
   - `browser_navigate`: `session:start` → `navigate` ordering; `policy:denied` on block; no events for empty URL.
   - `browser_screenshot`: `screenshot` phase with `rawBytes`.
   - `browser_assert_text` / `browser_wait_for_selector`: `assert:pass` / `assert:fail` with `kind`.
   - `browser_run_recipe`: per-step `stepIndex` in events; no SSE before validation error.
   - Detail capping: `detail` never exceeds 200 chars for long titles or policy reasons.
   - Multi-step ordering: `session:start` → `navigate` → `assert:pass`.

**Event names (stable, versioned by phase field):**
```
browser:step  { phase: "session:start" }
browser:step  { phase: "navigate",  url, detail }
browser:step  { phase: "screenshot", rawBytes, detail }
browser:step  { phase: "assert:pass", kind, stepIndex?, detail }
browser:step  { phase: "assert:fail", kind, stepIndex?, detail }
browser:step  { phase: "policy:denied", detail }
browser:step  { phase: "session:end" }
```

**Evidence commands:**
```bash
# New E.28 SSE tests
cd apps/backend && npx vitest run src/lib/browser-sse.test.ts
# → 15 tests pass

# Full backend suite
cd apps/backend && npx vitest run
# → 264 tests pass

# Browser-runner suite (E.26 + E.27, unchanged)
cd packages/browser-runner && npm test
# → 86 tests pass

# Type checks
cd apps/backend && npm run check-types   # clean
```

**Regression guarantee:**
- `VIPER_BROWSER_TOOLS` unset: `buildBrowserTools(..., false)` returns `[]`; `onBrowserStreamEvent` is never called; no `browser:step` events are emitted.
- Non-browser agentic chats: no `browser:step` events in the SSE stream.
- Desktop without new UI: `case "browser:step": break;` ensures the stream completes without errors on any unknown phase.
- E.26/E.27 tool text output (`Navigated to: …`, `PASS: …`, etc.) is unchanged.

**Not done (explicit deferrals):**
- Pixel diff / visual regression (screenshot comparison).
- Streaming full screenshots to the UI (use tool result only).
- Step Group F auth/billing.

**Rollback E.28 only:** Revert `stream-events.ts` and `execution-engine.d.ts` (remove `browser:step` variant); remove `onBrowserStreamEvent` from `BrowserToolCallbacks` and all call sites in `browser-tool-defs.ts`; revert `assistant.service.ts` (remove `onBrowserStreamEvent` callback and `session:end` SSE emit); remove `case "browser:step"` from `chat-panel.tsx`; delete `browser-sse.test.ts`.

---

~~27. Add frontend validation recipe library (navigate/assert/screenshot).~~ **COMPLETE**
~~28. Stream browser evidence back into chat events.~~ **COMPLETE**

### Step Group F — Product platform (auth, metering, billing)

~~29. Add user/workspace auth and membership schema.~~ **COMPLETE**

### F.29 Status: COMPLETE

**What was implemented:**

**Schema (additive — no existing tables touched):**
- `users` — UUID PK, email (unique case-insensitive functional index), display_name, auth_provider + external_subject nullable placeholders for F.30 OAuth/JWT.
- `workspaces` — UUID PK, name, optional unique slug, created_by_user_id FK → users (ON DELETE SET NULL).
- `workspace_memberships` — composite PK (workspace_id, user_id), both FKs ON DELETE CASCADE, role CHECK: `owner | admin | member`.
- Indexes: `idx_users_email_lower` (functional unique), `idx_workspace_memberships_user_id`, `idx_workspace_memberships_workspace_id`.

**Migration:** `packages/database/migrations/009_create_auth_core.sql` — idempotent `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`.

**schema.sql** updated with the same DDL for greenfield installs.

**Repository layer (packages/database/src/):**
- `auth-users.repository.ts` — `createUser`, `getUserByEmail` (case-insensitive), `getUserById`, `getUserByExternalSubject`, `updateUser`, `deleteUser`.
- `auth-workspaces.repository.ts` — `createWorkspace`, `getWorkspaceById`, `getWorkspaceBySlug`, `updateWorkspace`, `deleteWorkspace`.
- `auth-memberships.repository.ts` — `upsertMembership` (INSERT … ON CONFLICT DO UPDATE), `getMembership`, `listMembersForWorkspace`, `listWorkspacesForUser`, `removeMembership`.
- All exported from `packages/database/src/index.ts`.

**Tests:** 37 unit tests in `packages/database/src/__tests__/auth-repositories.test.ts` using mock Pool (no real Postgres required in CI). Covers happy paths, null handling, uniqueness violations (code 23505), and FK cascade documentation.

**workspace_id mapping design note:**
Today's `workspace_id TEXT` column in `chat_feedback`, `chat_media`, and related tables is a path-derived 16-hex string (from `deriveWorkspaceId`). The new `workspaces.id UUID` is the F.30+ identity anchor. The two will be connected in F.30 via either:
1. A `path_key TEXT UNIQUE` column on `workspaces` (preferred — allows one-row lookup), or
2. A separate `workspace_path_keys` mapping table for many-to-one (e.g. multiple path aliases per workspace UUID).
No breaking change to existing `/chat`, `/media/*`, or `/feedback/*` APIs is required at this step.

**Evidence commands:**
```bash
# New repository tests (mock Pool, no real Postgres)
cd packages/database && npm test
# → 37 tests pass

# Type check
cd packages/database && npm run check-types  # clean

# Full backend regression
cd apps/backend && npx vitest run   # 264 tests pass
cd apps/backend && npm run check-types       # clean
```

**Regression guarantee:** No existing routes were changed. Migrations are idempotent (`IF NOT EXISTS`). Existing `workspace_id TEXT` keys in chat/media/feedback tables are untouched.

**Not done (explicit deferrals):**
- F.30: JWT/session middleware, entitlement service, blocking unauthenticated chat. → **DONE — see F.30 below.**
- Desktop login UI, token storage.
- Replacing client-supplied `workspace_id` string on `/chat` (breaking — deferred).
- `path_key` backfill migration connecting `workspaces.id` ↔ existing path-keyed rows. → **DONE in F.30 via `workspaces.path_key` column + `upsertWorkspaceByPathKey`.**

**Rollback:** Drop tables in reverse order (`workspace_memberships`, `workspaces`, `users`); drop `idx_users_email_lower`; remove `009_create_auth_core.sql`; revert `schema.sql`; remove three repository files + `index.ts` exports.

---

### F.30 Status: COMPLETE

**What was built:**

**Schema (additive migrations — idempotent):**
- `packages/database/migrations/010_add_workspace_path_key.sql` — Adds `path_key TEXT UNIQUE NULLABLE` column to `workspaces` with a partial index. Bridges `workspaces.id UUID` ↔ path-derived 16-hex keys used by existing `chat_*` tables.
- `packages/database/migrations/011_create_workspace_entitlements.sql` — Creates `workspace_entitlements` table (`workspace_id FK PK`, `allowed_modes JSONB`, `allowed_model_tiers JSONB`, `flags JSONB`, `updated_at`). Default: no row = allow-all (safe rollout default).
- `packages/database/schema.sql` — `workspaces` table gains `path_key TEXT UNIQUE`; `workspace_entitlements` DDL appended.

**Repositories (`packages/database/src/`):**
- `auth-workspaces.repository.ts` — Updated `WorkspaceRow` / `CreateWorkspaceParams` / `UpdateWorkspaceParams` to include `path_key`. Added `getWorkspaceByPathKey(pool, key)` and `upsertWorkspaceByPathKey(pool, key, name?)` (lazy upsert — auto-creates workspace rows on first request).
- `auth-entitlements.repository.ts` (new) — `upsertWorkspaceEntitlements`, `getWorkspaceEntitlements`, `deleteWorkspaceEntitlements`. Exported from `packages/database/src/index.ts`.

**Entitlement service (`apps/backend/src/lib/entitlements.service.ts`):**
- `resolvePathKey(workspacePath)` — replicates `deriveWorkspaceId` algorithm exactly: normalize path (platform-aware lowercase, strip trailing slash), SHA-256, first 16 hex chars.
- `resolveWorkspaceContext(workspacePath, authHeader, config)` — fast no-op when `VIPER_ENTITLEMENTS_ENFORCE` is off; otherwise: derives `path_key`, upserts workspace, resolves user from bearer token (dev path: `VIPER_DEV_BEARER_TOKEN` + `VIPER_DEV_USER_EMAIL`; F.30 stub: token = user UUID), checks membership, loads `workspace_entitlements`, returns `ResolvedEntitlements`.
- `mergeEntitlements(planRow, config)` — pure logic, D.20 ∩ DB composition rule: `effective_tiers = intersection(DB.allowed_model_tiers ?? ALL, D.20 env entitledModelTiers)`. `effective_modes = DB.allowed_modes ?? ALL`.
- `assertModeAllowed(resolved, mode)` / `assertModelTierAllowed(resolved, tier)` — throw `EntitlementError(403)` on violation; no-op when `resolved` is null (enforcement off).
- `EntitlementError` — typed error with HTTP `statusCode` (401 | 403 | 404).

**Middleware (`apps/backend/src/middleware/entitlements.middleware.ts`):**
- Fastify `preHandler` hook. Fast no-op path when enforcement is off (< 1 µs, no DB calls). On enforcement: resolves context, attaches `request.entitlements`, emits `workflowLog("entitlement:checked" | "entitlement:denied")`.
- Registered on both `POST /chat` and `POST /chat/stream` in `chat.routes.ts`.

**Controller integration (`apps/backend/src/controllers/chat.controller.ts`):**
- `postChat` and `postChatStream` both call `assertModeAllowed(request.entitlements, chatMode)` before tier resolution, and `assertModelTierAllowed(request.entitlements, tierRes.effective)` after. EntitlementErrors map to 401/403 responses before any DB or LLM work begins.

**Workflow stages:** `entitlement:checked` and `entitlement:denied` added to `VALID_WORKFLOW_STAGES`.

**Tests:**
- `apps/backend/src/lib/entitlements.test.ts` — 41 unit tests covering:
  - `resolvePathKey` vs `deriveWorkspaceId` vector equality
  - `extractBearerToken` parsing
  - `isEntitlementsEnforced` env kill-switch
  - `mergeEntitlements` (null row, mode-only restriction, tier-only restriction, both, D.20 intersection)
  - `assertModeAllowed` / `assertModelTierAllowed` happy + violation paths
  - DB repositories: `getWorkspaceByPathKey`, `upsertWorkspaceByPathKey`, `upsertWorkspaceEntitlements`, `getWorkspaceEntitlements`, `deleteWorkspaceEntitlements` — all mocked pool.

**Evidence commands:**
```bash
cd apps/backend && npx vitest run          # 305 tests pass
cd apps/backend && npm run check-types     # 0 errors
cd packages/database && npm run check-types  # 0 errors
```

**Composition rule (D.20 ∩ DB):**
```
effective_modes       = DB.allowed_modes ?? ALL_MODES
effective_model_tiers = (DB.allowed_model_tiers ?? ALL_TIERS) ∩ config.entitledModelTiers
```
D.20 env is a global ceiling; DB narrows per workspace. When no DB row exists → allow-all (safe default).

**path_key bridge:**
`workspaces.path_key` is the 16-hex value from `resolvePathKey(workspacePath)`, identical to `deriveWorkspaceId(workspacePath)` used in `request-identity.ts` and existing `chat_*` tables. `upsertWorkspaceByPathKey` auto-creates workspace rows on first request so no manual seeding is needed.

**Not done (explicit deferrals):**
- F.31: usage event emission — **DONE, see F.31 below.**
- Full OAuth/OIDC (JWT verify, PKCE, refresh tokens) — token is currently treated as a UUID or matched via `VIPER_DEV_BEARER_TOKEN`.
- Desktop login UI and token storage.
- Replacing client-supplied `workspace_id` on `/feedback` and `/media/*` routes (still path-keyed TEXT; no breaking change).
- Membership auto-provisioning on new token (currently throws 403 if user is not in `workspace_memberships`; an admin route or seed script is needed for production).

**Rollback:** Remove `010_*.sql` and `011_*.sql`; revert `schema.sql` (drop `workspace_entitlements`, remove `path_key` column from workspaces DDL); remove `auth-entitlements.repository.ts`; revert `auth-workspaces.repository.ts` and `index.ts` exports; remove `entitlements.service.ts`, `entitlements.middleware.ts`, `entitlements.test.ts`; revert `chat.routes.ts` and `chat.controller.ts` to pre-F.30 versions; revert `workflow-log-schema.ts`.

---

~~30. Implement entitlement service and middleware.~~

### F.31 Status: COMPLETE

**What was built:**

**Schema (additive, idempotent):**
- `packages/database/migrations/012_create_usage_events.sql` — Creates append-only `usage_events` table: UUID PK, `occurred_at`, `request_id TEXT UNIQUE`, `workspace_path_key TEXT`, `workspace_uuid UUID NULL`, `user_uuid UUID NULL`, `conversation_id TEXT NULL`, `mode`, `intent`, `provider`, `primary_model_id`, `final_model_id`, `route_mode`, `effective_model_tier`, `tier_downgraded`, `fallback_count`, `latency_ms`, nullable token columns (`input_tokens`, `output_tokens`, `total_tokens`), `tool_call_count INT NULL`, and `metadata JSONB`. Indexes on `(workspace_path_key, occurred_at DESC)` and `(occurred_at DESC)`.
- `packages/database/schema.sql` — `usage_events` DDL appended for greenfield installs.

**Repository (`packages/database/src/usage-events.repository.ts`):**
- `insertUsageEvent(pool, params)` — `ON CONFLICT (request_id) DO NOTHING` for idempotency; returns the inserted row or `null` on conflict.
- `getUsageEventByRequestId(pool, id)` — for tests and reconciliation.
- Exported from `packages/database/src/index.ts`.

**Emitter (`apps/backend/src/lib/usage-events.ts`):**
- `recordUsageEvent(params)` — composes `RouteTelemetry` + F.30 entitlement context into a DB row and calls `insertUsageEvent`. Fire-and-forget via `void`; DB errors are caught and logged as `usage:event:skipped` — never crash the chat request.
- `isUsageEventsEnabled()` / `isUsageEventsStdoutEnabled()` — env kill-switch helpers (evaluated at call time for test isolation).
- Provider resolved from `@repo/model-registry` spec; falls back to `"openai"`.
- `VIPER_USAGE_EVENTS_STDOUT=1` emits `{ _type: "viper.usage.event", ts, ...fields }` to stdout independently of the DB switch.

**Wiring (`apps/backend/src/controllers/chat.controller.ts`):**
- `postChat` (non-stream): calls `recordUsageEvent` after `buildRouteTelemetry` succeeds. Early-exit error paths (auth, workspace-not-found, vision errors) do not record a billing event.
- `postChatStream`: intercepts the `model:route:summary` SSE event via a wrapper around `send`, then calls `recordUsageEvent` on successful pipeline completion only (not on error/abort paths).

**Token accounting in F.31:**
- Both paths pass `tokens: null`. Token fields (`input_tokens`, `output_tokens`, `total_tokens`) are nullable in the DB and remain NULL in F.31.
- Non-stream path: deferred until `AssistantPipelineResult` is extended with a `usage` field (F.32).
- Stream path: deferred until streaming usage deltas are aggregated from the OpenAI SDK (F.32+).

**Workflow stages:** `usage:event:emitted` and `usage:event:skipped` added to `VALID_WORKFLOW_STAGES`.

**Tests:**
- `packages/database/src/__tests__/usage-events.test.ts` — 12 new mock-pool tests covering `insertUsageEvent` (happy path, null fields, conflict → null, metadata JSON serialization, token/workspace_uuid/user_uuid fields) and `getUsageEventByRequestId`.
- `apps/backend/src/lib/usage-events.test.ts` — 16 unit tests covering kill-switch env parsing, no-DB-call when off, no-DB-call without `DATABASE_URL`, DB insert with correct field mapping, idempotency (null return), error swallowing, stdout emission, and stdout-off behavior.

**Evidence commands:**
```bash
cd apps/backend && npx vitest run          # 321 tests pass
cd apps/backend && npm run check-types     # 0 errors
cd packages/database && npm test           # 49 tests pass
cd packages/database && npm run check-types  # 0 errors
```

**Env vars added to `docs/ENV.md`:** `VIPER_USAGE_EVENTS`, `VIPER_USAGE_EVENTS_STDOUT`.

**Not done (explicit deferrals):**
- F.32: token field instrumentation (wire `usage` from OpenAI response through `AssistantPipelineResult`), aggregation jobs, rollups.
- ~~F.33: quota enforcement.~~ (completed)
- ~~F.34: Stripe webhooks, billing plans.~~ (completed)
- `tool_call_count` population (currently NULL; requires tool-round counting through `RouteMeta`).

**Rollback:** Remove `012_create_usage_events.sql`; revert `schema.sql` (drop `usage_events` DDL); remove `usage-events.repository.ts`, `usage-events.test.ts`; remove `usage-events.ts` from `apps/backend/src/lib/`; revert `chat.controller.ts` (remove `recordUsageEvent` calls and `streamRouteTelemetryData` capture); revert `workflow-log-schema.ts`; remove `usage-events.test.ts` in backend; revert `index.ts` exports.

---

~~31. Emit billing-grade usage events for every request.~~

### F.32 Status: COMPLETE

**What was built:**

**Schema (additive, idempotent):**
- `packages/database/migrations/013_create_usage_rollups.sql` — Creates `usage_rollups_daily` (grain: `PRIMARY KEY (bucket_date DATE, workspace_path_key TEXT)`) with measures: `request_count`, `stream_request_count`, `total_latency_ms`, nullable token sums (`sum_input_tokens`, `sum_output_tokens`, `sum_total_tokens`), `tier_downgraded_count`, `sum_fallback_count`, and JSONB breakdowns `mode_breakdown` / `model_breakdown`. Creates `usage_aggregation_cursor` (PK: `job_name TEXT`) to persist the watermark. Seeds a `('daily', NULL)` cursor row.
- `packages/database/schema.sql` — Both tables appended for greenfield installs.

**UTC bucket rule:**  
`bucket_date = (occurred_at AT TIME ZONE 'UTC')::date` — fully timezone-independent, re-runnable.

**Repository (`packages/database/src/usage-rollups.repository.ts`):**
- `aggregateUsageEventsDaily(pool, { fromDate, toDate })` — CTE-based INSERT ... ON CONFLICT DO UPDATE (full recompute per window). Computes mode and model breakdowns via nested sub-aggregates. Returns `{ daysProcessed, rowsUpserted }`.
- `getRollupForWorkspaceDay(pool, pathKey, day)` — single-row point lookup for F.33 quota reads.
- `listRollupsForWorkspace(pool, pathKey, fromDate, toDate)` — date-range list.
- `getAggregationCursor(pool, jobName?)` — read watermark.
- `advanceAggregationCursor(pool, newClosedDay, jobName?)` — advance watermark with upsert.
- `resolveAggregationWindow(pool, lookbackDays?, jobName?)` — computes `{ fromDate, toDate }` from cursor; returns `null` when already up-to-date. Falls back to earliest event day when cursor is null.
- All exported from `packages/database/src/index.ts`.

**CLI script (`packages/database/src/scripts/run-usage-aggregation.ts`):**  
Run with `cd packages/database && npm run aggregate-usage`.  
- Reads `VIPER_USAGE_AGGREGATE_ENABLED` (kill-switch; exits 0 when unset).
- Reads `VIPER_USAGE_AGGREGATE_LOOKBACK_DAYS` (default `2`).
- Resolves window from cursor → aggregates → advances cursor → logs `days_processed` + `rows_upserted`.
- Suitable for cron / GitHub Actions. Never touches the server hot path.

**Idempotency:**  
Re-running `aggregate-usage` for the same date range replaces existing rollup rows with freshly computed values. Safe to call multiple times — produces the same result.

**Workflow stage:** `usage:aggregate:complete` added to `VALID_WORKFLOW_STAGES` for future server-side trigger logging.

**Tests (`packages/database/src/__tests__/usage-rollups.test.ts`):**  
20 mock-pool tests covering: `aggregateUsageEventsDaily` (row count, day count, SQL shape, params, idempotency/empty), `getRollupForWorkspaceDay` (found/null), `listRollupsForWorkspace`, `getAggregationCursor`, `advanceAggregationCursor`, `resolveAggregationWindow` (up-to-date → null, past cursor, null cursor + earliest day, null cursor + no events).

**Evidence commands:**
```bash
cd packages/database && npm test            # 69 tests pass (all 3 test files)
cd packages/database && npm run check-types # 0 errors
cd apps/backend && npx vitest run           # 321 tests pass (unchanged)
cd apps/backend && npm run check-types      # 0 errors

# Smoke test (requires DATABASE_URL + VIPER_USAGE_AGGREGATE_ENABLED=1):
cd packages/database && VIPER_USAGE_AGGREGATE_ENABLED=1 npm run aggregate-usage
```

**Not done (explicit deferrals):**
- ~~F.33: quota enforcement using rollup reads.~~ (completed)
- ~~F.34: Stripe webhooks, billing plans.~~ (completed)
- ~~F.35: usage dashboards, product surfaces.~~ (completed)
- Token field population in `usage_events` (deferred from F.31 — requires wiring `AssistantPipelineResult.usage`; rollup sums will auto-populate once tokens land).
- HTTP trigger endpoint for aggregation (deferred; CLI cron is sufficient for F.32).

**Rollback:** Remove `013_create_usage_rollups.sql`; revert `schema.sql` (drop `usage_rollups_daily`, `usage_aggregation_cursor`); remove `usage-rollups.repository.ts`, `usage-rollups.test.ts`, `run-usage-aggregation.ts`; revert `index.ts` exports; revert `package.json` aggregate-usage script; revert `workflow-log-schema.ts`.

---

~~32. Build usage aggregation jobs and storage.~~

### F.33 Status: COMPLETE

**What was built:**

**Database (`packages/database/src/usage-events.repository.ts`):**
- `countUsageEventsForDay(pool, workspacePathKey, dayUtc)` — counts raw events for a workspace on a specific UTC date (live-tail for today). Uses half-open interval `[day, day+1)` in UTC. Exported from `index.ts`. 4 new mock-pool tests.

**Quota service (`apps/backend/src/lib/quota.service.ts`):**
- `isQuotaEnforced()` — reads `VIPER_QUOTA_ENFORCE` env kill-switch.
- `getDefaultMonthlyQuota()` — reads `VIPER_QUOTA_DEFAULT_MONTHLY_REQUESTS`; returns `null` when absent (unlimited).
- `parseQuotaConfig(flags)` — parses `monthly_request_quota` and `quota_soft_threshold_ratio` from `workspace_entitlements.flags`; flag takes precedence over env default; missing = null (unlimited).
- `currentUtcMonthWindow(todayUtc)` — pure helper returning `{ firstDay, lastDay }` for the UTC calendar month.
- `computeMonthlyUsage(pathKey, todayUtc)` — sums `request_count` from `usage_rollups_daily` for closed days (first_day → yesterday UTC) + `COUNT(*)` from `usage_events` for today; all arithmetic in **BigInt** to handle large counts safely.
- `checkMonthlyQuota(pathKey, entitlements, identity, todayUtc?)` — orchestrates enforcement: fast no-op when kill-switch off or limit is null; throws `QuotaError(429)` on hard limit; emits `workflowLog("quota:check", …, { status: "soft_warning" })` at soft threshold; injectable `todayUtc` for test isolation.
- `QuotaError` — typed error with `statusCode: 429` and `quota: QuotaSnapshot` for structured response.

**Auth coupling:**  
Quota works **by path_key only** — `VIPER_ENTITLEMENTS_ENFORCE` is NOT required. When `request.entitlements` is present the flags come from there; otherwise the service does a direct DB lookup of `workspace_entitlements` by path_key. This means quota enforcement is available in local/anonymous mode as long as a DB row exists and `VIPER_QUOTA_ENFORCE=1`.

**HTTP status choice:**  
**429 Too Many Requests** (RFC 6585) — distinguishable from 403 (permission denied). Response body: `{ "error": "...", "quota": { "used", "limit", "remaining", "status" } }`.

**Controller wiring (`apps/backend/src/controllers/chat.controller.ts`):**  
`checkMonthlyQuota` is called in both `postChat` and `postChatStream` **after** entitlement asserts and **before** `reply.hijack()` (so 429 returns a normal HTTP response, not an SSE stream). `QuotaError` maps to a 429 JSON response.

**Workflow stage:** `quota:check` added to `VALID_WORKFLOW_STAGES`. Emitted on both soft warnings and hard denials with distinguishable `status` field (`"soft_warning"` | `"exceeded"`).

**Tests (`apps/backend/src/lib/quota.service.test.ts`):**  
33 unit tests covering: kill-switch env (on/off), default quota env parsing, `parseQuotaConfig` (flag precedence, env fallback, invalid values), month window calculation (mid-month, Jan, Feb leap/non-leap, Dec), `computeMonthlyUsage` (rollup sum + today, first-of-month skip, empty rollups, BigInt large numbers), `checkMonthlyQuota` (enforcement off → no DB, unlimited → no DB, hard deny 429 + log, soft warn + log, below threshold → no log).

**Evidence commands:**
```bash
cd packages/database && npm test            # 73 tests pass
cd packages/database && npm run check-types # 0 errors
cd apps/backend && npx vitest run           # 354 tests pass
cd apps/backend && npm run check-types      # 0 errors
```

**Limit source precedence:**
```
1. workspace_entitlements.flags.monthly_request_quota (per-workspace)
2. VIPER_QUOTA_DEFAULT_MONTHLY_REQUESTS env (server-wide default)
3. Neither → unlimited (allow-all, matching F.30 missing-row = allow-all)
```

**Quota computation:**
```
used = SUM(usage_rollups_daily.request_count WHERE bucket_date IN [month_start, yesterday])
     + COUNT(usage_events WHERE workspace_path_key=key AND occurred_at IN [today 00:00 UTC, now))
```

**Not done (explicit deferrals):**
- ~~F.34: Stripe linkage, subscription plan webhooks.~~ (completed)
- ~~F.35: billing dashboards, product UI.~~ (completed)
- Token-based quotas (only request-count quotas in F.33).
- Per-user quotas (workspace-level only).
- SSE soft-warning event (quota:check is logged server-side; no SSE emission yet).
- Quota reset notification (no webhook or email on approaching/reaching limit).

**Rollback:** Remove `quota.service.ts`, `quota.service.test.ts`; revert `chat.controller.ts` (remove `checkMonthlyQuota` calls and imports); remove `countUsageEventsForDay` from `usage-events.repository.ts` + test + `index.ts` export; revert `workflow-log-schema.ts`; revert `ENV.md`.

---

~~33. Implement quota checks and hard/soft enforcement.~~

### F.34 Status: COMPLETE

**What was built:**

**Schema (additive, idempotent):**
- `packages/database/migrations/014_create_billing_tables.sql` — Creates `billing_webhook_events` (PK: `stripe_event_id TEXT`) as the Stripe idempotency log with columns: `event_type`, `workspace_id` (UUID FK → `workspaces`), `processing_status` (`applied | ignored | error | duplicate`), `received_at`, `error_message`. Adds `stripe_customer_id TEXT UNIQUE NULL` and `stripe_subscription_id TEXT UNIQUE NULL` nullable columns to `workspaces`.
- `packages/database/schema.sql` — `billing_webhook_events` DDL appended for greenfield installs; `workspaces` columns updated.

**Repository (`packages/database/src/billing-webhook-events.repository.ts`):**
- `insertWebhookEventIfNew(pool, params)` — `ON CONFLICT (stripe_event_id) DO NOTHING`; returns `null` on duplicate. Idempotency gate — duplicate Stripe deliveries never double-apply entitlements.
- `updateWebhookEventStatus(pool, stripeEventId, status, errorMessage?)` — used to update status after async processing.
- `getWebhookEvent(pool, stripeEventId)` — point lookup for admin queries.
- All exported from `packages/database/src/index.ts`.

**Stripe SDK:** `stripe` npm package added to `apps/backend`.

**Service (`apps/backend/src/lib/stripe-webhook.service.ts`):**
- `isStripeWebhookEnabled()` — reads `VIPER_STRIPE_WEBHOOK_ENABLED`.
- `getWebhookSecret()` — reads `STRIPE_WEBHOOK_SECRET` (or fallback `VIPER_STRIPE_WEBHOOK_SECRET`).
- `loadPlanEntitlements()` — parses `VIPER_STRIPE_PRICE_ENTITLEMENTS` JSON. Fails open (empty map) on malformed JSON.
- `verifyStripeEvent(rawBody, signature, secret)` — uses Stripe SDK `constructEvent` for HMAC verification.
- `processStripeWebhook(event)` — orchestrates: idempotency check → workspace routing via `metadata.workspace_id` → dispatch → DB writes.
  - `customer.subscription.updated` → `upsertWorkspaceEntitlements` with price-mapped config.
  - `customer.subscription.deleted` → `deleteWorkspaceEntitlements` (reverts to F.30 allow-all default).
  - `checkout.session.completed` → links `stripe_customer_id` / `stripe_subscription_id` on workspace + optionally applies plan if line item price is in map.
  - Unhandled event types → `status: "ignored"` (2xx returned, Stripe does not retry).

**Controller (`apps/backend/src/controllers/billing-webhook.controller.ts`):**
- 404 when `VIPER_STRIPE_WEBHOOK_ENABLED` off (endpoint doesn't exist to scanners).
- 400 on missing `Stripe-Signature` header or invalid signature.
- 200 on accepted event (applied / ignored / duplicate / error) — avoids Stripe retry noise for persistent bad configs.

**Route (`apps/backend/src/routes/billing.routes.ts`):**
- Registers `POST /webhooks/stripe`.
- Uses scoped `addContentTypeParser("application/json", { parseAs: "buffer" })` so raw bytes reach the controller before any JSON re-serialization that would corrupt the HMAC.

**Workspace routing:**  
Events must carry `metadata.workspace_id = <workspaces.id UUID>`. If absent → `status: "ignored"` (2xx, no DB writes). Avoids infinite Stripe retries for misconfigured subscriptions.

**Idempotency:**  
`billing_webhook_events.stripe_event_id` PRIMARY KEY + `ON CONFLICT DO NOTHING` guarantees duplicate deliveries are safely skipped. Second call returns `status: "duplicate"`.

**Plan → entitlement mapping:**  
Data-driven via `VIPER_STRIPE_PRICE_ENTITLEMENTS` JSON env var. No hard-coded secrets. Unknown price IDs → `ignored`. Subscription deleted → `deleteWorkspaceEntitlements` (F.30 allow-all fallback).

**Workflow stages added to `VALID_WORKFLOW_STAGES`:**
- `billing:webhook:received` — every inbound event
- `billing:webhook:applied` — entitlements changed
- `billing:webhook:ignored` — missing metadata / unhandled type
- `billing:webhook:duplicate` — already processed

**Tests (`apps/backend/src/lib/stripe-webhook.service.test.ts`):**  
23 unit tests covering: `isStripeWebhookEnabled`, `getWebhookSecret`, `loadPlanEntitlements`, `verifyStripeEvent` (success + failure), `processStripeWebhook` (duplicate, missing workspace_id, subscription.updated applied, subscription.updated ignored for unknown price, subscription.deleted, checkout.session.completed, unhandled event type, workflowLog emit verification).

**`packages/database/src/__tests__/billing-webhook-events.test.ts`:**  
8 mock-pool tests for `insertWebhookEventIfNew` (new row, duplicate, SQL params, null workspace_id), `updateWebhookEventStatus`, `getWebhookEvent`.

**Evidence commands:**
```bash
cd packages/database && npm test            # 81 tests pass (4 test files)
cd packages/database && npm run check-types # 0 errors
cd apps/backend && npx vitest run           # 377 tests pass (30 test files)
cd apps/backend && npm run check-types      # 0 errors
```

**Not done (explicit deferrals):**
- ~~F.35: Admin UI / billing dashboard (MVP shipped).~~ (completed — see below)
- Checkout API (Stripe-hosted Payment Links / Checkout Sessions) — no server-side session creation in F.34.
- Multi-workspace per Stripe customer (currently 1:1).
- Stripe Connect / platform billing.
- Tax (Stripe Tax, VAT).
- Per-user quotas (F.34 operates on workspace granularity only).
- Token-based quotas (request-count only in F.33–F.34).
- `stripe_customer_id` lookup path for events missing `metadata.workspace_id` (deferred).
- Webhook event replay / dead-letter queue UI.

**Rollback:** Remove `apps/backend/src/lib/stripe-webhook.service.ts`, `apps/backend/src/lib/stripe-webhook.service.test.ts`, `apps/backend/src/controllers/billing-webhook.controller.ts`, `apps/backend/src/routes/billing.routes.ts`; revert `server.ts` (remove `billingRoutes` import + register); revert `workflow-log-schema.ts` (remove 4 `billing:webhook:*` stages); remove `packages/database/migrations/014_create_billing_tables.sql`; revert `packages/database/schema.sql` (drop `billing_webhook_events` DDL + remove `workspaces` stripe columns); remove `packages/database/src/billing-webhook-events.repository.ts` + test; revert `packages/database/src/index.ts` exports; revert `apps/backend/src/lib/auth-workspaces.repository.ts` (remove stripe columns from `WorkspaceRow`); remove `stripe` from `apps/backend/package.json`; revert `docs/ENV.md`.

---

~~34. Integrate subscription provider + webhook ingestion.~~

### F.35 Status: COMPLETE

**What was built:**

**Backend — `POST /usage/summary`:**
- New service `apps/backend/src/lib/usage-summary.service.ts` — computes usage snapshot by:
  - Calling `computeMonthlyUsage(pathKey, today)` (reuses F.33 logic: rollup sum + live tail via `countUsageEventsForDay`) — no duplicated date-window logic.
  - Calling `parseQuotaConfig(flags)` for effective limit (flags → env default → unlimited).
  - Loading `getWorkspaceEntitlements` + `getWorkspaceByPathKey` for entitlement snapshot and Stripe IDs when `DATABASE_URL` is available.
  - `isUsageUiEnabled()` kill-switch reads `VIPER_USAGE_UI_ENABLED`.
- New routes `apps/backend/src/routes/usage.routes.ts` — `POST /usage/summary`:
  - 404 when `VIPER_USAGE_UI_ENABLED` off (hidden endpoint pattern, matches F.34).
  - 400 on missing `workspacePath`.
  - Attaches `entitlementsPreHandler` — when `VIPER_ENTITLEMENTS_ENFORCE=1` only workspace members can read their own data; when off → dev-trust (same as `/chat`).
  - `todayUtc` injectable for tests; ignored in `production` `NODE_ENV`.
  - Registered in `apps/backend/src/server.ts`.
- Response shape: `{ pathKey, month: { firstDay, lastDay }, usedRequests, limit, remaining, entitlements: { allowed_modes, allowed_model_tiers, flags }, stripe }` — all BigInt fields serialised as decimal strings.

**Desktop — Usage & Plan panel:**
- `apps/viper-desktop/ui/components/usage-panel.tsx` — panel with 4 states: loading, disabled (hidden when 404), error, data.
  - Data state: month label + Stripe subscription badge, usage counter + progress bar (green < 80%, amber ≥ 80%, red ≥ 100%), remaining count, entitlement rows (modes + model tiers as tag chips).
  - Refresh button, graceful error card, never blocks chat.
- `apps/viper-desktop/ui/services/agent-api.ts` — `fetchUsageSummary(workspacePath)` using `POST /usage/summary`; returns `null` on 404 (disabled); throws with `humanizeNetworkError` on other failures.
- `apps/viper-desktop/ui/components/activity-bar.tsx` — added `"usage"` view with `BarChart3` icon and "Usage & Plan" title.
- `apps/viper-desktop/ui/components/workbench-sidebar.tsx` — renders `<UsagePanel workspacePath={workspace?.root} />` for the `"usage"` active view.

**Tests:**
- `apps/backend/src/routes/usage.routes.test.ts` — 9 route tests using Fastify inject + mocked DB: kill-switch 404, no-DB 200 (zero/unlimited), mocked rollup + live-tail sum, limit/remaining with entitlements, remaining=0 when over-limit, stripe null when unlinked.

**Evidence commands:**
```bash
cd packages/database && npm test            # 81 tests pass
cd packages/database && npm run check-types # 0 errors
cd apps/backend && npx vitest run           # 386 tests pass (31 test files)
cd apps/backend && npm run check-types      # 0 errors
```

**Not done (explicit deferrals):**
- Stripe Checkout Session creation / Customer Portal redirect link.
- Invoice PDFs, tax.
- Editable entitlements from UI (read-only only in F.35).
- Token-based usage breakdown (F.31 tokens still mostly null; chart deferred).
- Cross-workspace admin console (multi-tenant RBAC).
- Optional admin webhook log read (`billing_webhook_events` GET) — deferred; document as F.36 slice if needed.
- `VIPER_ADMIN_BILLING_READ_SECRET` / admin read endpoint — out of scope for F.35.
- Desktop unit test for `UsagePanel` (no React Testing Library harness in the project; manual verification documented).

**Rollback:** Remove `apps/backend/src/lib/usage-summary.service.ts`, `apps/backend/src/routes/usage.routes.ts`, `apps/backend/src/routes/usage.routes.test.ts`; revert `apps/backend/src/server.ts` (remove `usageRoutes`); remove `apps/viper-desktop/ui/components/usage-panel.tsx`; revert `activity-bar.tsx` (remove `"usage"` view + `BarChart3` import); revert `workbench-sidebar.tsx` (remove `UsagePanel` + usage view branch); revert `agent-api.ts` (remove `fetchUsageSummary` + types); revert `docs/ENV.md`.

---

~~35. Build usage/billing/admin product surfaces.~~

### Step Group G — Advanced parity and differentiation

### G.36 Status: COMPLETE

**What was built:**

**Backend — `POST /editor/inline-complete`:**
- `apps/backend/src/lib/inline-completion.service.ts`:
  - `isInlineCompletionEnabled()` — reads `VIPER_INLINE_COMPLETION_ENABLED`.
  - `buildCompletionPrompt(languageId, beforeCursor, afterCursor)` — constructs FIM-style chat prompt; truncates `textBeforeCursor` to `MAX_BEFORE_CHARS` (4096) and `textAfterCursor` to `MAX_AFTER_CHARS` (512). Returns ONLY the inserted text — no markdown, no explanation.
  - `generateInlineCompletion(req)` — calls `gpt-4o-mini` (configurable via `VIPER_INLINE_COMPLETION_MODEL`): `max_tokens=120`, `temperature=0.2`, stop at `\n\n`. Hard 4s `AbortController` timeout. All errors swallowed → `{ text: "" }`.
  - Emits `editor:inline-complete:requested` / `editor:inline-complete:completed` workflowLog stages.
- `apps/backend/src/routes/editor.routes.ts` — `POST /editor/inline-complete`:
  - 404 when `VIPER_INLINE_COMPLETION_ENABLED` off.
  - Zod validation (mirrors `request.schemas.ts` style); 400 on schema violation.
  - `entitlementsPreHandler` — workspace-scoped when `VIPER_ENTITLEMENTS_ENFORCE=1`; dev-trust when off.
  - Registered in `apps/backend/src/server.ts`.

**Desktop — Monaco provider:**
- `apps/viper-desktop/ui/components/monaco-editor.tsx` — `registerInlineCompletionsProvider` for `typescript`, `javascript`, `python`, `go`, `rust`, `java`, `plaintext`:
  - Gated by `VITE_INLINE_COMPLETION_ENABLED` (build-time env, default off).
  - 300ms debounce + `AbortController` per keystroke; Monaco cancellation token cancels in-flight requests.
  - Context window: full pre-cursor text (server truncates) + 512-char post-cursor slice.
  - Returns `InlineCompletionList` with 0–1 items; Tab accepts (Monaco default ghost-text behavior).
  - All disposables stored in `inlineDisposablesRef` — cleaned up on unmount.
  - `inlineSuggest: { enabled, mode: "prefix" }` editor option wired.
- `apps/viper-desktop/ui/services/agent-api.ts` — `fetchInlineCompletion(payload, signal?)`:
  - Returns `{ text: "" }` on 404 (disabled), network error, or AbortError — silent degradation.
- `apps/viper-desktop/ui/components/editor-container.tsx` — passes `workspacePath={workspace?.root}` to `MonacoEditor`.

**Workflow stages added:**
- `editor:inline-complete:requested`
- `editor:inline-complete:completed`

**Tests (`apps/backend/src/routes/editor.routes.test.ts`):**
16 tests — kill-switch 404, missing fields 400, empty `textBeforeCursor` → empty result, happy path 200 with text, field forwarding; `buildCompletionPrompt` unit tests (languageId, before/after inclusion, truncation, empty after omits section); `isInlineCompletionEnabled` env parsing.

**Evidence commands:**
```bash
cd apps/backend && npx vitest run           # 402 tests pass (32 test files)
cd apps/backend && npm run check-types      # 0 errors
```

**Not done (explicit deferrals):**
- Multi-file context / repo-index awareness (completions are file-local only).
- Embedding-based retrieval for richer context (overlaps roadmap §9.1 #1).
- Copilot Chat / chat-in-editor UX (G.37 ships inline edit; chat-in-editor deferred to later steps).
- Streaming completions (single response for MVP).
- Telemetry: accept/reject tracking for quality loop.
- Per-user completion history / personalization.
- `VITE_INLINE_COMPLETION_ENABLED` runtime toggle (currently build-time only; deferred).

**Rollback:** Remove `apps/backend/src/lib/inline-completion.service.ts`, `apps/backend/src/routes/editor.routes.ts`, `apps/backend/src/routes/editor.routes.test.ts`; revert `apps/backend/src/server.ts` (remove `editorRoutes`); revert `apps/backend/src/types/workflow-log-schema.ts` (remove 2 `editor:inline-complete:*` stages); revert `apps/viper-desktop/ui/components/monaco-editor.tsx` (remove provider logic, `INLINE_COMPLETION_ENABLED` const, `inlineDisposablesRef`, `abortRef`, `debounceRef`); revert `apps/viper-desktop/ui/components/editor-container.tsx` (remove `workspacePath` prop); remove `fetchInlineCompletion` + types from `agent-api.ts`; revert `docs/ENV.md`.

---

~~36. Ship inline completion/copilot service for editor.~~

### G.37 Status: COMPLETE

**What was built:**

**Backend — `POST /editor/inline-edit`:**
- `apps/backend/src/lib/inline-edit.service.ts`:
  - `isInlineEditEnabled()` — reads `VIPER_INLINE_EDIT_ENABLED`.
  - `buildEditPrompt(req)` — constructs a system prompt containing the full file content (truncated to `MAX_FILE_CONTENT_CHARS` = 32k) plus the user instruction. When a selection is provided, adds a section highlighting the selected region (lines N–M) so the model focuses changes there. Instructs the model to return ONLY the complete modified file — no markdown fences, no explanations.
  - `generateInlineEdit(req)` — calls `gpt-4o` (configurable via `VIPER_INLINE_EDIT_MODEL`): `max_tokens=4096`, `temperature=0.2`. Hard 30s `AbortController` timeout. Errors propagated (user-initiated action, not silent like inline completion).
  - `stripMarkdownFences(text)` — strips wrapping ` ```lang ... ``` ` fences if the model adds them.
  - Emits `editor:inline-edit:requested` / `editor:inline-edit:completed` workflowLog stages.
- `apps/backend/src/routes/editor.routes.ts` — `POST /editor/inline-edit` (added alongside G.36's `/editor/inline-complete`):
  - 404 when `VIPER_INLINE_EDIT_ENABLED` off (hidden endpoint pattern).
  - Zod validation (`InlineEditRequestSchema`): `workspacePath`, `filePath`, `languageId`, `instruction`, `fileContent` required; `selection` (object with startLine/startColumn/endLine/endColumn) and `selectionText` optional.
  - `entitlementsPreHandler` — workspace-scoped when `VIPER_ENTITLEMENTS_ENFORCE=1`.
  - Service errors return 500 with `{ error: string }`.
  - Registered in `apps/backend/src/server.ts` (same `editorRoutes` plugin).

**Desktop — AI edit actions:**
- `apps/viper-desktop/ui/components/monaco-editor.tsx`:
  - New `onEditorInstance` callback prop — exposes the Monaco editor instance to the parent.
  - Monaco editor action registered: **"Viper: AI Edit Selection"** with keybinding `Cmd+Shift+E` (Mac) / `Ctrl+Shift+E` (Win/Linux) and context menu entry. Dispatches `viper:trigger-ai-edit` custom event.
- `apps/viper-desktop/ui/components/editor-container.tsx`:
  - Stores Monaco editor ref via `onEditorInstance` callback.
  - Listens for `viper:trigger-ai-edit` window event. On trigger:
    1. Reads the current selection from the stored editor instance.
    2. Requires a non-empty selection (alerts "Select some code first" if empty).
    3. Prompts for an instruction via `window.prompt()` (default: "Improve this code").
    4. Calls `fetchInlineEdit()` with file content, selection range, and instruction.
    5. On success, calls `addPendingEdit()` — existing `MonacoDiffEditor` Accept/Reject flow takes over.
    6. On failure, shows an alert with the error message. AbortController prevents concurrent requests.
- `apps/viper-desktop/ui/services/agent-api.ts` — `fetchInlineEdit(payload, signal?)`:
  - Returns `{ modifiedFileContent }` on success.
  - Throws humanized errors on 404, network failure, or server error (user-initiated, errors not swallowed).
- `apps/viper-desktop/ui/commands/default-commands.tsx`:
  - Registered `viper.aiEditSelection` command — **"AI Edit Selection"** (category: Viper) in the command palette. Dispatches `viper:trigger-ai-edit`.

**Product behavior:**
- **Selection-based edit:** Select code → `Cmd+Shift+E` (or command palette → "Viper: AI Edit Selection") → enter instruction → AI returns modified file → diff view (Accept / Reject / Undo).
- **No selection:** Alert "Select some code first, then run this command." (no-op).
- **End state:** `addPendingEdit` feeds into the existing `MonacoDiffEditor` → `Accept` writes file via `fsApi.writeFile`, `Reject` discards, `Undo` reverts.

**Workflow stages added:**
- `editor:inline-edit:requested`
- `editor:inline-edit:completed`

**Tests (`apps/backend/src/routes/editor.routes.test.ts`):**
32 total tests (16 G.36 + 16 G.37) — kill-switch 404, missing instruction 400, happy path 200 with `modifiedFileContent`, selection forwarded to service, service throws → 500; `buildEditPrompt` unit tests (languageId, file path, selection section, omission); `stripMarkdownFences` (strips typescript/python fences, plain text unchanged, partial fences unchanged); `isInlineEditEnabled` env parsing (unset, "1", "true", other).

**Evidence commands:**
```bash
cd apps/backend && npx vitest run           # 418 tests pass (32 test files)
cd apps/backend && npm run check-types      # 0 errors
cd packages/database && npm test            # 81 tests pass
```

**Not done (explicit deferrals):**
- Multi-hunk patches (G.37 returns full-file modified content; multi-region surgical patches deferred).
- Multi-file refactors (single file per request for MVP).
- Streaming diffs (full response then diff; streamed partial diff display deferred).
- Instruction history / recent edits.
- Custom instruction templates / presets (e.g. "Add types", "Add tests", "Optimize").
- `VITE_INLINE_COMPLETION_ENABLED` runtime toggle (still build-time only; deferred from G.36).

**Rollback:** Remove `apps/backend/src/lib/inline-edit.service.ts`; revert `apps/backend/src/routes/editor.routes.ts` (remove `postInlineEdit`, `InlineEditRequestSchema`, inline-edit route, and inline-edit service imports); revert `apps/backend/src/types/workflow-log-schema.ts` (remove 2 `editor:inline-edit:*` stages); revert `apps/viper-desktop/ui/components/monaco-editor.tsx` (remove `onEditorInstance` prop + Monaco action); revert `apps/viper-desktop/ui/components/editor-container.tsx` (remove AI edit handler, `editorInstanceRef`, `aiEditAbortRef`, `aiEditInFlight`, `fetchInlineEdit` import, `handleEditorInstance`, `onEditorInstance` prop, `viper:trigger-ai-edit` listener); revert `apps/viper-desktop/ui/services/agent-api.ts` (remove `fetchInlineEdit` + types); revert `apps/viper-desktop/ui/commands/default-commands.tsx` (remove `viper.aiEditSelection` command); revert `docs/ENV.md` (remove `VIPER_INLINE_EDIT_ENABLED`, `VIPER_INLINE_EDIT_MODEL`).

---

~~37. Ship inline in-file edit UX actions.~~

### G.38 Status: COMPLETE

**What was built:**

**Backend — `/git/suggest-commit` + `/git/suggest-pr-body`:**
- `apps/backend/src/lib/git-assistant.service.ts`:
  - `isCommitAssistantEnabled()` — reads `VIPER_COMMIT_ASSISTANT_ENABLED`.
  - `buildCommitPrompt(diff, style, branch?)` — builds a chat prompt targeting Conventional Commits or short style; truncates diff to `MAX_DIFF_CHARS` (32k). Instructs model to return a JSON object `{ subject, body }`.
  - `buildPrPrompt(diff, branch?)` — builds a PR description prompt with Summary / Changes / Test plan sections. Instructs model to return `{ title, body }` JSON.
  - `suggestCommitMessage(req)` — calls `gpt-4o-mini` (configurable via `VIPER_COMMIT_ASSISTANT_MODEL`) with `response_format: { type: "json_object" }`, `max_tokens=512`, `temperature=0.3`. 25s timeout.
  - `suggestPrBody(req)` — same model, `max_tokens=1024`. 25s timeout.
  - Emits `git:assistant:requested` / `git:assistant:completed` workflowLog stages.
- `apps/backend/src/routes/git.routes.ts`:
  - `POST /git/suggest-commit` — Zod validation (`workspacePath`, `stagedDiff` required; `branch`, `style` optional). 404 when kill-switch off. 400 on validation error. 500 on service failure.
  - `POST /git/suggest-pr-body` — same pattern; returns `{ title, body }`.
  - Both routes use `entitlementsPreHandler`.
  - Registered in `apps/backend/src/server.ts`.

**Desktop — Electron IPC:**
- `apps/viper-desktop/backend/git-service.ts` — added `git:diffStaged` IPC handler: runs `git diff --cached`, caps output at 256 KiB before returning to renderer.
- `apps/viper-desktop/electron/preload.ts` — exposed `window.viper.git.diffStaged(root)`.
- `apps/viper-desktop/ui/types/viper.d.ts` — added `diffStaged` to `ViperGitApi`.

**Desktop — API client:**
- `apps/viper-desktop/ui/services/agent-api.ts` — added `fetchSuggestCommitMessage(payload)` and `fetchSuggestPrBody(payload)`. Both throw humanized errors (user-initiated). 404 → "not enabled" error.

**Desktop — UI (`apps/viper-desktop/ui/components/git-sidebar.tsx`):**
- **"Generate commit message (AI)"** button: accent-outlined, enabled only when staged files exist. On click: fetches staged diff via `window.viper.git.diffStaged`, calls `fetchSuggestCommitMessage` with style "conventional", fills the commit message textarea with `subject + body`. Inline loading spinner + error message.
- **"Generate PR description (AI)"** button: same enablement guard. On click: fetches diff, calls `fetchSuggestPrBody`, opens a modal showing the AI-generated PR title + markdown body with Copy and Copy & Close actions.
- **PR description modal:** overlay with title + scrollable body. Clipboard copy via `navigator.clipboard`. Both loading/error states surfaced inline below each button.
- Never auto-commits — user must click the existing **Commit** button.

**Workflow stages added:**
- `git:assistant:requested`
- `git:assistant:completed`

**Tests (`apps/backend/src/routes/git.routes.test.ts`):**
21 tests — kill-switch 404 (both routes), missing fields 400, happy path commit 200 with subject/body, style forwarding, service throws → 500, PR happy path 200; `buildCommitPrompt` (diff inclusion, conventional vs short style, branch hint, truncation); `buildPrPrompt` (diff, sections, branch); `isCommitAssistantEnabled` env parsing.

**Evidence commands:**
```bash
cd apps/backend && npx vitest run           # 439 tests pass (33 test files)
cd apps/backend && npm run check-types      # 0 errors
cd packages/database && npm test            # 81 tests pass
```

**Not done (explicit deferrals):**
- Automatic `gh pr create` / GitHub API integration (no OAuth; deferred to G.39+).
- GitLab MR creation.
- Commit message history / learning from accepted suggestions.
- Streaming diff review / inline hunk comments.
- Multi-workspace / multi-remote awareness.
- PR template detection from `.github/pull_request_template.md`.

**Rollback:** Remove `apps/backend/src/lib/git-assistant.service.ts`, `apps/backend/src/routes/git.routes.ts`, `apps/backend/src/routes/git.routes.test.ts`; revert `apps/backend/src/server.ts` (remove `gitRoutes` import + registration); revert `apps/backend/src/types/workflow-log-schema.ts` (remove `git:assistant:*`); revert `apps/viper-desktop/backend/git-service.ts` (remove `git:diffStaged` handler); revert `apps/viper-desktop/electron/preload.ts` (remove `diffStaged`); revert `apps/viper-desktop/ui/types/viper.d.ts` (remove `diffStaged` from `ViperGitApi`); revert `agent-api.ts` (remove `fetchSuggestCommitMessage`, `fetchSuggestPrBody`, related types); revert `git-sidebar.tsx` (remove AI buttons, modal, AI state, imports); revert `docs/ENV.md`.

---

~~38. Add PR/commit assistant lane.~~

### G.39 Status: COMPLETE

**What was built:**

**Backend — `/testing/suggest-commands` + `/testing/triage-failure`:**
- `apps/backend/src/lib/test-assistant.service.ts`:
  - `isTestAssistantEnabled()` — reads `VIPER_TEST_ASSISTANT_ENABLED`.
  - `deriveTestFilePath(filePath)` — pure heuristic: strips extension, appends `.test.ts` / `.test.tsx`; returns null for no-extension files or unchanged for already-test files.
  - `buildHeuristicCommands(changedFiles)` — groups changed files by the monorepo package registry (`apps/backend`, `packages/database`, `apps/viper-desktop`, `packages/agents`); for ≤3 changed test files in a package generates targeted `npx vitest run <file>` commands; for >3 or no template falls back to "run all in package". No AI call needed when all files are in known packages.
  - `buildSuggestCommandsPrompt(files, hint, heuristics)` — AI prompt with monorepo layout, changed files, and pre-computed heuristics; instructs model to return `{ commands }` JSON.
  - `buildTriagePrompt(output, runner)` — prompt with truncated runner output; instructs model to return `{ summary, bullets, suggestedCommands }` JSON.
  - `suggestTestCommands(req)` — fast heuristic path first; falls back to `gpt-4o-mini` (`VIPER_TEST_ASSISTANT_MODEL`) for unknown packages. `response_format: json_object`, `max_tokens=512`, 25s timeout.
  - `triageFailure(req)` — truncates `runnerOutput` to `MAX_RUNNER_OUTPUT_CHARS` (64k); calls model with `max_tokens=768`. Returns `{ summary, bullets[0–4], suggestedCommands[0–3] }`.
  - Emits `testing:assistant:requested` / `testing:assistant:completed` workflowLog stages.
- `apps/backend/src/routes/testing.routes.ts`:
  - `POST /testing/suggest-commands` — Zod: `workspacePath`, `changedFiles` (non-empty array, max 50) required; `packageHint` optional enum. 404 when disabled, 400 validation, 500 service error.
  - `POST /testing/triage-failure` — Zod: `workspacePath`, `runnerOutput` required; `runner` optional enum. Same error codes.
  - Both routes use `entitlementsPreHandler`.
  - Registered in `apps/backend/src/server.ts`.

**Desktop — Electron IPC:**
- `apps/viper-desktop/backend/git-service.ts` — added `git:diffNameOnly` handler: runs `git diff --name-only HEAD`, returns array of changed file paths.
- `apps/viper-desktop/electron/preload.ts` — exposed `window.viper.git.diffNameOnly(root)`.
- `apps/viper-desktop/ui/types/viper.d.ts` — added `diffNameOnly` to `ViperGitApi`.

**Desktop — API client:**
- `apps/viper-desktop/ui/services/agent-api.ts` — added `fetchSuggestTestCommands(payload)` and `fetchTriageFailure(payload)`. Both throw humanized errors; 404 → "not enabled" message.

**Desktop — UI (`apps/viper-desktop/ui/components/test-panel.tsx`):**
New `TestPanel` component with two collapsible sections:
  1. **"Suggest commands from changes"** — fetches `git diff --name-only HEAD` via IPC, calls `/testing/suggest-commands`, renders copyable command chips with cwd label and rationale text.
  2. **"Triage failure output"** — textarea paste, runner toggle (vitest / jest / unknown), Analyze button → shows `summary`, bulleted observations, and copyable suggested follow-up commands. Loading spinners + inline error messages.

Wired into `apps/viper-desktop/ui/components/activity-bar.tsx` (new "Test Assistant" entry with `FlaskConical` icon) and `apps/viper-desktop/ui/components/workbench-sidebar.tsx`.

**Workflow stages added:**
- `testing:assistant:requested`
- `testing:assistant:completed`

**Tests (`apps/backend/src/routes/testing.routes.test.ts`):**
23 tests — kill-switch 404 (both), empty/missing changedFiles 400, happy path suggest 200, style forwarding, service throws 500, triage happy path 200, triage throws 500; `deriveTestFilePath` (ts, tsx, already-test, no-ext, spec); `buildHeuristicCommands` (backend file, database file, unknown, many files, multi-package); `isTestAssistantEnabled` env parsing.

**Evidence commands:**
```bash
cd apps/backend && npx vitest run           # 462 tests pass (34 test files)
cd apps/backend && npm run check-types      # 0 errors
cd packages/database && npm test            # 81 tests pass
```

**Not done (explicit deferrals):**
- Auto-fix loop / patch application from triage output (G.40+).
- Coverage-based test selection (identify tests covering changed lines).
- Full dependency graph traversal (Bazel-level impact analysis).
- CI integration (GitHub Actions matrix targeting).
- Automatic terminal capture (manual paste only for MVP).
- "Run in terminal" button (command paste automation deferred).

**Heuristic limitations (documented in code):**
- Assumes co-located `*.test.ts` / `*.test.tsx` files (no file-system lookup).
- Does not traverse imports — only direct path mapping.
- Unknown monorepo packages (not in the package registry) fall through to AI.

**Rollback:** Remove `apps/backend/src/lib/test-assistant.service.ts`, `apps/backend/src/routes/testing.routes.ts`, `apps/backend/src/routes/testing.routes.test.ts`; revert `apps/backend/src/server.ts` (remove `testingRoutes`); revert `workflow-log-schema.ts` (remove `testing:assistant:*`); revert `git-service.ts` (remove `git:diffNameOnly`); revert `preload.ts` (remove `diffNameOnly`); revert `viper.d.ts` (remove `diffNameOnly`); remove `agent-api.ts` G.39 additions; remove `test-panel.tsx`; revert `activity-bar.tsx` (remove `tests` view + `FlaskConical`); revert `workbench-sidebar.tsx` (remove `TestPanel`); revert `docs/ENV.md`.

---

### G.40 Status: COMPLETE

**What was built:**

**Core policy engine (`packages/agents/workspace-tools/privacy.ts`):**
- Built-in denylist (always applied, cannot be overridden by config) covering:
  - `**/.env`, `**/.env.*` (all env variants)
  - `**/*.pem`, `**/*.key`, `**/*.p12`, `**/*.pfx`, `**/*.crt`, `**/*.cer` (TLS/SSH keys)
  - `**/.ssh/**`, `**/id_rsa`, `**/id_ed25519`, `**/id_ecdsa` (SSH keys)
  - `**/secrets/**`, `**/secret/**`, `**/credentials`, `**/credentials/**`
  - `**/*.token`, `**/*.secret`, `**/*.keystore`
  - `**/.netrc`, `**/.pgpass`, `**/.npmrc`, `**/.pypirc`
  - `**/service-account*.json`, `**/.aws/**`, `**/.azure/**`, `**/.config/gcloud/**`
- Config file support: `.viper/privacy.json` at workspace root (loaded + cached 60s)
  - `denyGlobs` — custom additional deny patterns
  - `allowGlobs` — exceptions for config-level deny (does NOT override built-in deny)
  - `redactPatterns` — reserved, accepted but ignored in MVP
- Policy evaluation order: built-in deny → config allowGlobs → config denyGlobs → allow
- `checkPrivacy(relativePath, config)` — synchronous, returns `{ allowed, blockedBy?, pathHash }`
- `isPrivacyAllowed(workspacePath, relativePath)` — async, loads config from disk
- `isPrivacyAllowedSync(relativePath)` — sync, built-in deny only (fast path)
- Path hash: 12-character SHA-256 prefix for safe log output (no raw path leakage)
- `PrivacyDeniedError` class with `pathHash` and `blockedBy` fields
- Minimal glob matcher supporting `**`, `*`, `?`, and literal patterns

**Integration points:**
- `packages/agents/workspace-tools/tools/read-file.tool.ts` — `readWorkspaceFile` calls `isPrivacyAllowed` before any file read; returns `null` for blocked paths
- `packages/agents/workspace-tools/tools/edit-file.tool.ts` — `editWorkspaceFile` calls `isPrivacyAllowed`; returns `{ success: false, error: "Privacy policy denied access to this file" }` for blocked paths
- `packages/agents/workspace-tools/tools/create-file.tool.ts` — `createWorkspaceFile` calls `isPrivacyAllowed`; same error shape for blocked paths
- `packages/agents/workspace-tools/tools/search-text.tool.ts` — walk loop calls `checkPrivacy` (sync, built-in only) per file before reading; skips blocked files silently (no leakage in search results)
- `packages/agents/workspace-tools/index.ts` — exports `isPrivacyAllowed`, `isPrivacyAllowedSync`, `checkPrivacy`, `matchesGlob`, `clearPrivacyCache`, `PrivacyDeniedError`, `BUILTIN_DENY_GLOBS`, `PrivacyConfig`, `PrivacyCheckResult`

**Execution engine observability (`packages/agents/execution-engine/tools/workspace.tool.ts`):**
- `READ_FILE` tool calls `isPrivacyAllowed` before `readWorkspaceFile`; logs `[Viper] READ_FILE: privacy:path:blocked hash=<12char> rule=<pattern>` to `ctx.logs` for each blocked path

**Backend (`apps/backend/src/routes/editor.routes.ts`):**
- `POST /editor/inline-edit` (G.37) — calls `isPrivacyAllowed`; returns **403** for blocked paths; logs `pathHash` + `rule` (no raw path) via `request.log.warn`
- `POST /editor/inline-complete` (G.36) — calls `isPrivacyAllowed`; returns **200 + empty text** for blocked paths (silent — no toast spam for completions)

**Workflow stage:**
- `privacy:path:blocked` added to `VALID_WORKFLOW_STAGES` in `apps/backend/src/types/workflow-log-schema.ts`

**Tests (`packages/agents/workspace-tools/privacy.test.ts`):**
47 tests — `matchesGlob` (prefix, wildcard, directory, literal); `checkPrivacy` built-in deny (13 deny cases + 3 allow cases); config denyGlobs; config allowGlobs; allowGlobs cannot override built-in; path hash (format, stability, uniqueness); `BUILTIN_DENY_GLOBS` export; `PrivacyDeniedError` fields.

**Evidence commands:**
```bash
cd packages/agents/workspace-tools && npx vitest run   # 47 tests pass
cd apps/backend && npx vitest run                      # 462 tests pass (34 test files)
cd apps/backend && npm run check-types                 # 0 errors
cd packages/agents/workspace-tools && npm run check-types  # 0 errors
```

**Not done (explicit deferrals):**
- Full DLP / ML content scanning for secrets embedded in allowed files.
- Per-user or per-org policies stored in DB (F.30 entitlement extension).
- Guaranteed regex redaction of secrets within allowed file content (MVP — `redactPatterns` field accepted but not processed).
- `.gitignore`-style negation chains (`!` prefix in denyGlobs).
- Config-level `allowGlobs` overriding the built-in denylist (intentionally conserved; users can remove built-in patterns only by modifying source).
- Privacy enforcement for `list-directory` (directory listings don't expose file contents; only names are returned — low risk for MVP).

**Rollback:** Remove `packages/agents/workspace-tools/privacy.ts` and `privacy.test.ts`; revert imports + privacy checks from `read-file.tool.ts`, `edit-file.tool.ts`, `create-file.tool.ts`, `search-text.tool.ts`, `workspace.tool.ts`, `editor.routes.ts`; revert `workflow-log-schema.ts` (remove `privacy:path:blocked`); revert `index.ts` (remove privacy exports); revert `docs/ENV.md`.

---

~~39. Add selective test targeting and failure triage workflows.~~
~~40. Add privacy boundary policy layer for context extraction.~~
~~41. Add offline evaluation harness + release quality gates.~~

---

### G.41 Status: COMPLETE

**What was built:**

**Package: `packages/eval-harness/`**
New monorepo workspace (`@repo/eval-harness`) with:
- `src/types.ts` — `EvalCase`, `EvalFixtureFile`, `SuiteResult`, `HarnessResult`, `EvalConfig` types; per-type `input`/`expect` shapes for all 4 case types.
- `src/runner.ts` — `loadFixtures(dir)`, `loadEvalConfig(root)`, `runSuite(fixture, file)`, `runHarness(fixturesDir, config)`. Dispatches each case to the correct runner; computes pass rate; checks threshold.
- `src/run.ts` — CLI entry point (`npx tsx src/run.ts`). Prints coloured PASS/FAIL table, summary stats, optional `--output eval-results.json`. Exits 0 on pass, 1 on failure.
- `eval.config.json` — threshold config: `offline.required_pass_rate = 1.0`, `live.required_pass_rate = 0.8`.
- `src/runner.test.ts` — 17 unit tests for fixture dispatch, pass-rate math, and threshold logic.

**Case runners (4 domains, all Tier A — deterministic, no LLM):**
- `src/runners/privacy-glob.runner.ts` — calls `checkPrivacy()` from `@repo/workspace-tools`; asserts `allowed` and optional `blockedByPrefix`.
- `src/runners/intent-scoring.runner.ts` — calls `scoreIntents()` from `@repo/intent-agent`; asserts `intentType` and optional `minConfidence`.
- `src/runners/schema-validation.runner.ts` — validates values against inline Zod mirrors of `ChatMode` and `ModelTier`; asserts `valid`.
- `src/runners/workflow-stage.runner.ts` — checks a stage string against `REQUIRED_WORKFLOW_STAGES` set; asserts `present`.

**Fixtures (51 cases, all passing):**
- `fixtures/privacy-glob.json` — 20 cases covering all built-in deny patterns, config denyGlobs, allowGlobs, and override behaviour.
- `fixtures/intent-scoring.json` — 10 cases covering CODE_FIX, FEATURE_IMPLEMENTATION, REFACTOR, CODE_EXPLANATION, CODE_SEARCH, TEST_GENERATION, SECURITY_ANALYSIS, GENERIC, CODE_GUIDANCE, FILE_EDIT.
- `fixtures/schema-validation.json` — 10 cases covering all 4 ChatModes, all 3 ModelTiers, and invalid values.
- `fixtures/workflow-stages.json` — 11 cases covering critical stages from F.30–G.40 + a negative case.

**Intent-agent API addition:**
- `packages/agents/intent-agent/index.ts` — added exports for `scoreIntents` and `INTENT_KEYWORD_RULES` so the eval harness can regression-test the pure scoring function offline.

**Root scripts (root `package.json`):**
- `npm run eval` — runs `eval:offline` from `@repo/eval-harness` (prints table, exits 0 iff 100% pass).
- `npm run eval:offline` — alias.
- `npm run quality-gate` — fail-fast chain: `check-types` (workspace-tools, backend) → unit tests (workspace-tools, database, backend, eval-harness) → `eval`. Expected runtime < 2 minutes on a laptop.

**Documentation:**
- `docs/EVAL.md` — fixture format reference, input/expect shapes per type, config keys, quality gate definition, instructions for adding new cases, Tier B (LLM-judged) design notes.

**Tests:**
```bash
cd packages/eval-harness && npx vitest run   # 17 unit tests pass
npm run eval                                 # 51 eval cases pass (100%)
npm run check-types -w @repo/eval-harness    # 0 errors
npm run check-types -w @repo/intent-agent    # 0 errors (new exports)
```

**Not done (explicit deferrals):**
- Weekly cron or CI schedule to run eval against production traffic replays.
- LLM-as-judge cases (Tier B) — framework is documented in `docs/EVAL.md`; not wired up.
- Full LLM quality leaderboard / regression scoring over time.
- Multimodal eval (image attachment quality).
- Auto-bisect on regression (identifying which commit introduced a failure).
- Live server eval against `http://localhost:4000` (documented as optional; not implemented).
- Per-intent confidence threshold enforcement (currently only `minConfidence` is asserted when specified).

**Rollback:** Remove `packages/eval-harness/`; revert `scoreIntents` / `INTENT_KEYWORD_RULES` exports from `packages/agents/intent-agent/index.ts`; remove `eval`, `eval:offline`, `quality-gate` from root `package.json`; remove `docs/EVAL.md`.

---

### Step Group H — Production hardening and launch readiness

~~42. Define SLOs for latency/quality/safety/cost.~~
~~43. Add dashboards and alerting for SLO burn rates.~~
~~44. Run shadow traffic or staged rollout for new router policies.~~
~~45. Execute final parity checklist and release review.~~

---

### H.42 Status: COMPLETE

**What was built:** `docs/SLO.md` — a production-grade SLO catalog grounded entirely in signals the codebase emits today.

**Four pillars (10 SLIs):**

| Pillar | SLIs | Key signals |
|---|---|---|
| Latency | SLI-L1 (chat p50/p95/p99 per mode), SLI-L2 (editor inline) | `usage_events.latency_ms`, `workflowLog("request:complete", { latency_ms })` |
| Quality | SLI-Q1 (success rate, failover rate, downgrade rate), SLI-Q2 (tool-error — pending), SLI-Q3 (webhook health) | `usage_rollups_daily`, `billing:webhook:*` stages |
| Safety / policy | SLI-S1 (quota coverage), SLI-S2 (entitlement coverage), SLI-S3 (privacy block rate), SLI-S4 (tier policy) | `quota:check`, `entitlement:denied`, `privacy:path:blocked`, `model:tier:denied` |
| Cost | SLI-C1 (token rate), SLI-C2 (volume per workspace), SLI-C3 (failover rate) | `usage_events.total_tokens`, `usage_rollups_daily` aggregates |

**Copy-paste runbook SQL** for all SLOs included in `docs/SLO.md` section 6.

**Error-budget formula** and burn-rate alert thresholds documented in section 4.

**Explicit deferrals** captured in section 7: TTFT instrumentation, client-perceived latency, dollar spend, LLM quality scoring, automated alerting — all deferred to H.43.

**Evidence:**
```bash
# Docs-only change — no code modified.
# Validate quality-gate still passes:
npm run quality-gate
```

**See:** [`docs/SLO.md`](./SLO.md) for the full catalog.

**H.43 note:** ~~Dashboards and alerting (H.43) should treat `docs/SLO.md` as the source-of-truth specification.~~ **H.43 is now complete — see block below.**

---

### H.43 Status: COMPLETE

**What was built:** Two operator-facing API endpoints backed by a new service module (`apps/backend/src/lib/slo-snapshot.service.ts`), plus `docs/SLO.md` §9 documenting all operational interfaces.

**New files / changes:**

| File | Purpose |
|---|---|
| `apps/backend/src/lib/slo-snapshot.service.ts` | SQL queries (parameterised, no string-concat), per-mode latency percentiles, quality/volume aggregates, `detectViolations` burn-rate math, optional webhook delivery |
| `apps/backend/src/routes/ops.routes.ts` | `GET /ops/slo-snapshot` + `POST /ops/slo-check`; Bearer-token auth; kill-switch; `slo:alert:fired` / `slo:check:ok` workflowLog |
| `apps/backend/src/routes/ops.routes.test.ts` | 19 tests: kill-switch off → 404, missing/wrong token → 401, unset token → 401, happy paths, violations shape, webhook mock, burn-rate unit tests |
| `apps/backend/src/server.ts` | `await app.register(opsRoutes)` |
| `apps/backend/src/types/workflow-log-schema.ts` | Added `slo:check:ok`, `slo:alert:fired` |
| `docs/SLO.md` | Added §9 "Operational interfaces" |
| `docs/ENV.md` | Documented `VIPER_SLO_OPS_ENABLED`, `VIPER_SLO_OPS_TOKEN`, `VIPER_SLO_ALERT_WEBHOOK_URL` |

**What the snapshot covers (see `docs/SLO.md` §9.1):**

- **Latency:** per-mode p50/p95/p99 over 30 days with burn rate vs SLO target.
- **Quality:** failover rate, tier-downgrade rate, token coverage — with burn rates vs §4 targets.
- **Volume:** top-20 workspaces by request count (7-day rollup).
- **Breach list:** structured alert violations with severity (`critical` / `warning`).

**Alert thresholds (mirroring `docs/SLO.md` §4):**

| Condition | Warn | Critical |
|---|---|---|
| Latency `actual_p95 / target_p95` | ≥ 0.8 | ≥ 1.0 |
| Quality failover burn rate | ≥ 0.8 | ≥ 1.0 |
| Quality downgrade burn rate | ≥ 0.8 | ≥ 1.0 |
| Min sample for SLO evaluation | — | 100 requests |

**Security:** Both endpoints are **off by default** (`VIPER_SLO_OPS_ENABLED` not set → 404). `VIPER_SLO_OPS_TOKEN` unset → always 401. No workspace-level secrets in the response (path keys only).

**Evidence:**
```bash
cd apps/backend
npx vitest run src/routes/ops.routes.test.ts
# → 19 tests passed

npx vitest run && npm run check-types
# → 481 tests passed, 0 type errors
```

**Deferrals (H.44+):**

- Grafana / Datadog / full APM dashboard deployment (wiring the JSON API to a panel is out-of-repo scope).
- PagerDuty / Opsgenie OAuth — use `VIPER_SLO_ALERT_WEBHOOK_URL` with PagerDuty Events v2 for now.
- TTFT (time-to-first-token) SLI — requires capturing first-token timestamp in streaming path.
- Client-side (Electron) perceived latency telemetry — still deferred per `docs/SLO.md` §7.
- `npm run slo:report` CLI (Option 3) — not implemented; `/ops/slo-snapshot` + `curl | jq` covers the same use case.

**Rollback:** Remove `apps/backend/src/lib/slo-snapshot.service.ts`, `apps/backend/src/routes/ops.routes.ts`, `apps/backend/src/routes/ops.routes.test.ts`. Revert `server.ts` (remove `opsRoutes` import + register). Revert `workflow-log-schema.ts` (remove `slo:check:ok`, `slo:alert:fired`). Remove `docs/SLO.md` §9. Revert `docs/ENV.md` H.43 section. Unset env vars: `VIPER_SLO_OPS_ENABLED`, `VIPER_SLO_OPS_TOKEN`, `VIPER_SLO_ALERT_WEBHOOK_URL`.

---

### H.44 Status: COMPLETE

**What was built:** Shadow-traffic evaluation and deterministic staged rollout for model routing policies, exercised via two new env vars with zero impact when unset.

**New files / changes:**

| File | Purpose |
|---|---|
| `apps/backend/src/lib/model-router.ts` | Added `selectModelCandidate` (candidate policy `v2-plan-complex-premium`), `computeRouterBucket` (djb2 hash bucketing), `CANDIDATE_POLICY_LABEL` |
| `apps/backend/src/config/workflow-flags.ts` | Added `routerShadowEnabled`, `routerPolicyCandidatePct`, `parseRouterPolicyCandidatePct` |
| `apps/backend/src/services/assistant.service.ts` | Added `performRoutingWithCandidateAndShadow` wrapper; replaced 3 `routeModelForRequest` call sites; added `_useCandidate` param to `routeModelForRequest` |
| `apps/backend/src/types/workflow-log-schema.ts` | Added `router:shadow:compare`, `router:policy:rollout` |
| `apps/backend/src/lib/model-router.test.ts` | 19 new tests: candidate policy rules (10), bucketing math (9) |
| `apps/backend/src/config/workflow-flags.test.ts` | 14 new tests: `parseRouterPolicyCandidatePct` clamping + `parseWorkflowRuntimeConfig` defaults |
| `apps/backend/src/integration/model-router.integration.test.ts` | 4 new integration tests: shadow observe-only, PCT=100 rollout, PCT=0 unchanged, default env unchanged |
| `docs/ENV.md` | Documented `VIPER_ROUTER_SHADOW_ENABLED`, `VIPER_ROUTER_POLICY_CANDIDATE_PCT`, ramp guide, rollback |

**Mechanism chosen:** Option A — percentage rollout via `VIPER_ROUTER_POLICY_CANDIDATE_PCT` (0–100). Option B (workspace flags via `workspace_entitlements.flags`) is documented as deferral below.

**Candidate policy (`v2-plan-complex-premium`) — documented delta:**

| Mode | Intent | Live tier | Candidate tier |
|---|---|---|---|
| `plan` | `CODE_FIX`, `IMPLEMENT_FEATURE`, `REFACTOR`, `PROJECT_SETUP` | `fast` | **`premium`** |
| All other modes/intents | — | unchanged | unchanged |

**Router policy rollout subsection in `docs/ENV.md`:** see `H.44 Router policy shadow traffic + staged rollout`.

**Evidence:**
```bash
cd apps/backend
npx vitest run src/lib/model-router.test.ts src/config/workflow-flags.test.ts src/integration/model-router.integration.test.ts
# → 67 tests passed

npx vitest run && npm run check-types
# → 516 tests passed, 0 type errors

npm run quality-gate  # at repo root
```

**Deferrals (H.45+):**

- **Option B** (workspace-flag rollout via `workspace_entitlements.flags.router_candidate_policy`): not implemented; percentage rollout is sufficient for MVP.
- Resume path (`runAssistantStreamPipeline` resume branch, line ~2256): calls `selectModel` directly; shadow/rollout not applied — deferral noted in code.
- Multi-region / external Experimentation platform (Amplitude, LaunchDarkly): requires infra investment beyond this repo.
- Tool routing shadow (`routeTools` in `route-tools.ts`): not wired; deferred until tool router is less coupled to sync execution.
- Persistent shadow agreement metrics in DB: comparison currently only in logs; query pattern needs adding to `usage_events` or a separate `router_shadow_events` table.

**Rollback:** Revert `model-router.ts` (remove candidate/bucket exports), `workflow-flags.ts` (remove H.44 fields + `parseRouterPolicyCandidatePct`), `assistant.service.ts` (revert 3 call sites back to direct `routeModelForRequest`, remove `performRoutingWithCandidateAndShadow`, remove `ROUTER_SHADOW_ENABLED` / `ROUTER_POLICY_CANDIDATE_PCT` destructuring). Revert `workflow-log-schema.ts` (remove `router:shadow:compare`, `router:policy:rollout`). Unset env vars: `VIPER_ROUTER_SHADOW_ENABLED`, `VIPER_ROUTER_POLICY_CANDIDATE_PCT`.

---

### H.45 Status: COMPLETE

**What was delivered:** [`docs/RELEASE.md`](./RELEASE.md) — pre-release command bar (`npm run quality-gate` / `npm run release:check`), summarized pointers to ENV kill-switches, database migrations location, observability (`docs/SLO.md` §9 ops APIs), and rollback-by-env mindset. **No new product features** in this task.

**§10 readiness mapping:** See the companion table below [§10 Acceptance Checklist](#10-acceptance-checklist-for-cursor-class-readiness); H.45 is transparency on what is shippable vs partial vs not started.

**Explicit deferrals (still not “Cursor-class complete” per §10):**

- End-user auth / SSO in production, multi-tenant SaaS polish, and full “accounts” story — **not** claimed complete; DB/auth tables exist (`packages/database/migrations/009_*`) but product surface varies by deployment.
- Full Grafana/Datadog dashboards — **deferred** (H.43); JSON SLO snapshot + ops endpoints only.
- `docs/RELEASE.md` does **not** include desktop E2E or full `turbo build` — add to your internal checklist if you ship Electron.
- Items in §10 marked **partial** or **not started** remain honest gaps; H.45 does not reclassify them.

**Evidence:** Docs-only + `package.json` script alias. Validation run after edits:

```bash
npm run quality-gate
# Pass (required for H.45 sign-off)
```

**Rollback (H.45):** Remove `docs/RELEASE.md`; remove `release:check` script from root `package.json`; revert roadmap §10 table and H.45 block.

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

**Status (as of H.45)** — repo-grounded; do not treat “partial” as “done”:

| Criterion | Status | Evidence / notes |
|-----------|--------|-------------------|
| User accounts + workspace auth in production | **Not started** (typical) / **partial** if you deploy auth migrations | `packages/database/migrations/009_create_auth_core.sql`; production auth UX not a single shipped “accounts” product in-repo. |
| Plan/entitlement enforcement active | **Partial** | `VIPER_ENTITLEMENTS_ENFORCE`, `workspace_entitlements`, F.30–F.33; enforcement off by default in dev. |
| Accurate usage metering and billing lifecycle | **Partial** | `usage_events` / rollups (F.31–F.32): `packages/database/migrations/012_*`, `013_*`; Stripe webhooks F.34; Checkout/Portal still deferred per roadmap. |
| User-visible model tiers (`Auto`, `Premium`, `Fast`) | **Partial** | Backend tier resolution + entitlements; desktop selector completeness varies; see mode/tier routes and `docs/ENV.md` D.20. |
| User-visible modes (`Ask`, `Plan`, `Debug`, `Agent`) fully enforced | **Partial** | Chat modes validated server-side; full IDE enforcement depends on desktop wiring. |
| Multimodal image chat shipped | **Partial** | Backend multimodal paths + media tables (`008_*`, E.22–E.23); verify end-to-end for your build. |
| Browser-based validation for agentic frontend tasks | **Partial** | `@repo/browser-runner` + workflow stages; not a full “Cursor-class” browser grid. |
| Confidence-gated editing with validation-before-apply | **Partial** | Analysis/edit gates, post-edit validation env flags (`workflow-flags.ts`); not universal confidence scoring in UI. |
| Full observability and quality dashboards live | **Partial** | `docs/SLO.md`, `/ops/slo-snapshot` (H.43); no in-repo Grafana; **deferred per §9.1** backlog. |

Release verification commands: [`docs/RELEASE.md`](./RELEASE.md).

---

## 11) Notes on Current State Accuracy

This roadmap intentionally reflects current Viper implementation characteristics observed in code and docs, including:

- Strong backend orchestration foundation.
- Existing agentic loop and patch approval model.
- Existing analysis pipeline architecture.
- Existing desktop IDE integrations (terminal, git, debug, diagnostics).
- Missing product platform layers (auth/billing/entitlements/multimodal/model-tier UX).

Any future roadmap updates should continue to be implementation-grounded and validated through backend debug logs before feature sign-off.
