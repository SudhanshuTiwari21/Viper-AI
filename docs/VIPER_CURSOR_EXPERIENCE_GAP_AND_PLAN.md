# Viper AI vs Cursor-class experience: gaps and implementation plan

This document focuses on **product experience parity** (IDE shell, chat UX, settings, agent behavior)—not on re-claiming every line in [`CURSOR_COMPETITIVE_ROADMAP.md`](CURSOR_COMPETITIVE_ROADMAP.md). For **honest “Cursor-class readiness”** against a formal checklist, see **§10** and the **H.45** companion table in that roadmap. For **release gates**, see [`RELEASE.md`](RELEASE.md).

**External benchmark note:** “Cursor-class” refers to common expectations from modern AI IDEs (Cursor, Copilot Chat, etc.). Exact competitor features are used as **benchmarks**, not as a specification Viper must clone.

---

## Execution order (product strategy)

**Phase 1 — Cursor-class Viper first:** Ship the improvements in this document (composer UX, streaming labels, narration flexibility, agent run modes, settings shell, @ context as scheduled). The goal is **daily IDE + chat quality** competitive with modern AI coding tools.

**Phase 2 — Product management / enterprise integrations:** Only after Phase 1 has a clear baseline, invest in **Jira/Linear/Slack-style integration** and unified PM surfaces as described in [`VIPER_PRODUCT_MANAGEMENT_VISION.md`](VIPER_PRODUCT_MANAGEMENT_VISION.md). That doc remains the **north star for integrations**; it is **not** the immediate engineering track until Cursor-like experience is in good shape.

**Rule of thumb:** If a feature does not make the **editor + chat** feel meaningfully closer to Cursor-class, it waits until Phase 1 milestones are met (or is explicitly time-boxed as a parallel spike).

---

## 1. Purpose and scope

**In scope**

- Desktop **chat composer** (mode, model tier, layout, professionalism).
- **Streaming / phase** presentation (labels, “Intent” / planning, thinking).
- **Answer shape** (why replies feel repetitive; mode contracts).
- **Multi-file / agent runs** (pause-after-edit vs “keep going”).
- **Settings** and product shell (centralized vs scattered).
- **Phased implementation plan** and acceptance hints (maps to **Phase 1** above).

**Out of scope (for this document)**

- Replacing every backend feature in the roadmap.
- **Phase 2 work:** Jira/Linear/Slack integrations, unified PM dashboard, and other items that belong in [`VIPER_PRODUCT_MANAGEMENT_VISION.md`](VIPER_PRODUCT_MANAGEMENT_VISION.md)—**deferred** until Cursor-class experience milestones are agreed and progressing.

---

## 2. What Viper already has (post step groups A–H)

The repo has shipped a **deep backend and platform layer** relative to early roadmap sections:

| Area | Representative implementation |
|------|----------------------------------|
| Request identity + SSE threading | `apps/backend` chat controller, `RequestIdentity` |
| Modes + tool policy | `mode-tool-policy.ts`, C.11–C.15 |
| Model registry + router + failover | `model-router.ts`, `workflow-flags.ts`, D.16–D.21 |
| Multimodal + media | E.22–E.25, desktop attachments |
| Browser tools | `@repo/browser-runner`, E.26–E.28 |
| Auth/entitlements/usage/quota/Stripe/usage UI | F.29–F.35 |
| Inline completion/edit, git/test assistants, privacy, eval harness | G.36–G.41 |
| SLOs, ops APIs, router shadow/rollout, release runbook | H.42–H.45, `docs/SLO.md`, `docs/RELEASE.md` |

**Important:** [`CURSOR_COMPETITIVE_ROADMAP.md`](CURSOR_COMPETITIVE_ROADMAP.md) **§2 and §3** still read like an early “gap list” and **do not fully reflect** the above. Treat **§10 (H.45 table)** as the **current** honesty check for product maturity, not §2 alone.

---

## 3. Visual / UX layer (Cursor-class polish)

### 3.1 Current behavior

- **Mode** (`Ask`, `Plan`, `Debug`, `Agent`) and **model tier** (`Auto`, `Premium`, `Fast`) are rendered as **two rows of small inline buttons** in [`apps/viper-desktop/ui/components/chat-panel.tsx`](apps/viper-desktop/ui/components/chat-panel.tsx) (sticky input area). No chevron, no dropdown, high visual density in the top-left of the composer—matches user feedback that the UI feels “not professional.”
- **Prototype exists but is unused:** [`apps/viper-desktop/ui/components/chat-prompt-box.tsx`](apps/viper-desktop/ui/components/chat-prompt-box.tsx) implements **dropdown-style** controls (chevron, popover). The main IDE uses [`ChatPanel`](apps/viper-desktop/ui/components/ide-container.tsx) only; `ChatPromptBox` is not wired in.

### 3.2 Gaps vs Cursor-class expectation

| Cursor-class expectation | Viper today | Gap |
|--------------------------|-------------|-----|
| Compact composer chrome; mode/model in menus or segmented controls | Chip rows | **High** |
| Consistent keyboard/focus behavior | Button-only | **Medium** |
| Optional “power user” density (single row) | Two rows always visible | **Medium** |

### 3.3 Implementation directions

- **Replace or wrap** chip rows with **dropdowns** (or a single combined “Mode + Model” control) reusing patterns from `chat-prompt-box.tsx` or a shared headless menu component.
- **Accessibility:** focus trap in popovers, `aria-expanded`, Escape to close, arrow-key navigation.
- **Message chrome:** optional **collapse** of technical phase labels for end users; keep full detail in developer mode.

---

## 4. Chat behavior and dynamics

### 4.1 “Intent” / phase labels

- **SSE `intent` event** maps `streamingPhase` to `intent` or `planning` in `chat-panel.tsx`.
- **Inconsistency:** [`chat-message.tsx`](apps/viper-desktop/ui/components/chat-message.tsx) maps `intent` → **“Planning”** (header), while [`thinking-indicator.tsx`](apps/viper-desktop/ui/components/thinking-indicator.tsx) shows **“Understanding intent…”** for the thinking line—**two different stories** for the same phase.
- **Gap:** Unify copy; optionally hide raw phase labels behind a single “Working…” or mode-specific status.

### 4.2 Repetitive, same-shaped answers

**Root causes (by design today):**

1. **`mode-narration.ts`** — Appends strict instructions that **final output must follow EXACT sections** per mode (`Answer` / `Plan` / `Observations` / `Summary`, etc.). Good for **consistency and safety**; bad for **natural, varied** “chat” feel.
2. **`build-agentic-system-prompt.ts`** — **Plain text, no markdown**, numbered steps—aligned with deterministic tooling, not with “conversational” polish.
3. **C.14** post-processor **enforces** missing headings—can **reinforce** sameness.

**Gaps**

| Expectation | Viper today | Gap |
|-------------|-----------|-----|
| Varied tone; less templated feel | Strong section contracts | **High** |
| Optional Markdown in chat | Plain-text contract in agent path | **Medium** (product decision) |

### 4.3 Implementation directions

- **User or workspace setting:** `Structured` (current) vs `Natural` (looser sections, fewer mandatory headings).
- **Prompt tuning:** Soften “EXACTLY” language where safety allows; keep strict gates for **Ask/Plan** read-only modes if needed.
- **Streaming polish:** richer tool summaries, stall detection (see roadmap WS8-style ideas); align desktop `STEP_NARRATIONS` with actual user-visible value.

### 4.4 @ context / Cmd+K (deferred)

**Cursor-class** expectation: `@file`, `@folder`, symbol picks. **Viper:** not first-class in chat composer. **Track as Phase P3+** (desktop + API contract).

---

## 5. Agent / multi-file behavior

### 5.1 Current architecture (why “one file then stop”)

In [`run-agentic-loop.ts`](packages/agents/agentic-loop/loop/run-agentic-loop.ts):

- `edit_file` and `create_file` set **`shouldPause`** after execution.
- The loop returns **`paused`** with `messages`, `editedFiles`, `fileSnapshots`.
- [`assistant.service.ts`](apps/backend/src/services/assistant.service.ts) stores **`pausedLoopStates`** per `conversationId` and **resumes** on the next user message.

**This is approval-first design**, not an accident: it matches **patch preview / approval** and reduces blast radius.

**Prompt hint:** `build-agentic-system-prompt.ts` also tells the model to **implement one step at a time** and wait for user confirmation—**aligned** with pause behavior.

### 5.2 Gaps vs Cursor Composer–style expectation

| Expectation | Viper today | Gap |
|-------------|-------------|-----|
| Multi-file edits in one run with minimal friction | Pause after each edit | **High** (product choice) |
| “Run until done” for trusted workspaces | Always pause | **High** |

### 5.3 Implementation options (each with tradeoffs)

1. **“Composer mode” / batch mode** (feature flag): pause only after **N** edits or **M** tool rounds, or only on **first** edit of a batch.
2. **“Continue without review”** (trusted workspace): skip pause when user opts in (dangerous).
3. **Batch tool call:** allow multiple `edit_file` calls in one model turn **without** pausing between them (still one review step at end)—requires loop + UI changes.
4. **Stronger UX:** keep pause but **surface** “Continue to next file” as one click—reduces perceived friction without removing safety.

---

## 6. IDE feature parity (high level)

| Area | Cursor-class benchmark | Viper snapshot | Notes |
|------|------------------------|----------------|-------|
| Inline completion | Low-latency, rich context | G.36 shipped; file-local, build-time gated | Index-aware context deferred |
| Inline edit | Selection-based AI edit | G.37 + diff flow | Strong for single file |
| Symbol navigation | Go to def / refs in AI flow | Partial infra | roadmap §9.1 |
| Rules | `.cursorrules`-style rules | `.viper/privacy.json` only for paths | **Rules product** not shipped |
| Checkpoints / timeline | Restore session state | Not productized | roadmap §9.1 |
| Background jobs | Long tasks with status | Not productized | roadmap §9.1 |

---

## 7. Settings and product shell

### 7.1 Current state

- **No** single `settings*.tsx` hub for the desktop IDE.
- Capabilities are **scattered:** Usage & Plan panel, Test Assistant, Git sidebar, activity bar, env-driven backend flags.

### 7.2 Cursor-class expectation

- **One settings surface:** AI (models, temperature, narration), Editor (inline completion, keybindings), Privacy (path rules), Account/Billing (when auth is on), **Feature flags** for experimental tools.

### 7.3 Gap

- **High** for discoverability and “professional product” feel.

---

## 8. Phased implementation plan

| Phase | Focus | Examples |
|-------|--------|----------|
| **P0** | Composer chrome | Dropdowns for mode + tier; unify `intent`/`Planning` copy; align `thinking-indicator` with `PHASE_LABEL` |
| **P1** | Narration | `Structured` vs `Natural` setting; soften strict templates where safe; optional Markdown policy (product decision) |
| **P2** | Agent run modes | Feature-flagged batch / composer; “continue” affordance; loop tests |
| **P3** | Settings hub + rules | Central settings UI; `.viper/rules` or workspace rules (spec + enforcement) |
| **PW** | Web app — auth, dashboard, OAuth | [`apps/web-app`](apps/web-app): auth hub, dashboard route, PM-ready OAuth framework; desktop consumes tokens |
| **P4+** | @ context, checkpoints | Larger design + API work |

**Checklist:** For ordered, checkbox-trackable steps mapped to these phases, see **§9**.

---

## 9. Sequenced implementation checklist (track progress)

Use **`- [ ]`** for not started, **`- [x]`** when done (update this file in-repo as you ship). Order is **recommended**—adjust if parallelizing, but keep **P0 before P1** for visible UX wins.

### P0 — Composer chrome and phase labels

- [ ] **P0.1** Replace Ask/Plan/Debug/Agent chip row with a **dropdown** (or compact menu) in [`chat-panel.tsx`](apps/viper-desktop/ui/components/chat-panel.tsx); reuse or extract patterns from [`chat-prompt-box.tsx`](apps/viper-desktop/ui/components/chat-prompt-box.tsx) where sensible.
- [ ] **P0.2** Replace Auto/Premium/Fast chip row with a **dropdown** (or combine mode + tier into one control if product prefers).
- [ ] **P0.3** **Accessibility:** focus trap in popovers, `aria-expanded`, **Escape** to close, **arrow-key** navigation between items.
- [ ] **P0.4** **Single source of truth** for streaming phase **user-facing labels** (new small module, e.g. `streaming-phase-labels.ts` under `ui/`); wire [`chat-message.tsx`](apps/viper-desktop/ui/components/chat-message.tsx) and [`thinking-indicator.tsx`](apps/viper-desktop/ui/components/thinking-indicator.tsx) so `intent` / `planning` never contradict.
- [ ] **P0.5** *(Optional)* Default UX: hide or soften raw phase line; keep full labels behind debug/preview flag if desired.

### P1 — Narration and chat dynamics

- [ ] **P1.1** **Structured vs Natural** output: user-visible setting (desktop persistence + pass to backend if the contract must change server-side).
- [ ] **P1.2** Implement **Natural** path in [`mode-narration.ts`](apps/backend/src/lib/mode-narration.ts) (looser sections / fewer mandatory headings) without breaking mode-contract tests; adjust [`mode-narration.test.ts`](apps/backend/src/lib/mode-narration.test.ts) accordingly.
- [ ] **P1.3** Soften **“EXACTLY”** / rigid template wording for **Agent** (and **Debug** if safe); keep stricter **Ask/Plan** behavior if required for read-only guarantees.
- [ ] **P1.4** **Streaming polish:** richer tool summaries, stall handling (align with WS8-style goals); refresh [`STEP_NARRATIONS`](apps/viper-desktop/ui/components/chat-panel.tsx) copy where stale.
- [ ] **P1.5** **Product decision + implementation:** allow **Markdown** in agent final replies or keep plain-text; align [`build-agentic-system-prompt.ts`](packages/agents/agentic-loop/prompt/build-agentic-system-prompt.ts) and desktop rendering.

### P2 — Agent / multi-file (“Composer-like” behavior)

- [ ] **P2.1** **Product sign-off:** pick primary strategy—batch pause after **N** edits, **batch tool round** without pause between files, **Continue** button only, or **trusted workspace** auto-run (document risks).
- [ ] **P2.2** Implement loop changes in [`run-agentic-loop.ts`](packages/agents/agentic-loop/loop/run-agentic-loop.ts) + resume/`pausedLoopStates` in [`assistant.service.ts`](apps/backend/src/services/assistant.service.ts).
- [ ] **P2.3** Align [`build-agentic-system-prompt.ts`](packages/agents/agentic-loop/prompt/build-agentic-system-prompt.ts) with the chosen policy (stop saying one-step-only if batching).
- [ ] **P2.4** Desktop: approval / **Continue** / batch summary UX as required by the policy.
- [ ] **P2.5** **Tests:** Vitest coverage for new pause/batch semantics; run `npm run quality-gate`.

### P3 — Settings hub and rules

- [ ] **P3.1** **Settings** route or modal in desktop: sections for AI (narration mode, future model prefs), Editor (inline completion hints), Privacy (link to `.viper/privacy.json` docs), Usage/Billing entry points as today.
- [ ] **P3.2** **`.viper/rules`** (or agreed filename): format spec in `docs/`, loader, and enforcement hook in agent/backend prompts (minimal viable path).

### PW — Web app: auth hub, dashboard, and integration OAuth ([`apps/web-app`](apps/web-app))

**Context:** [`apps/web-app`](apps/web-app) is the **product web surface** (today mostly marketing). For **Cursor-class** account/team behavior—and to extend into **Phase 2 PM integrations** (Jira, Linear, GitHub Issues, etc.)—implement **auth**, **dashboard**, and a **multi-provider OAuth framework** here. The desktop IDE should **consume** the same identity (Bearer / session handoff), not duplicate login UX.

**Sequencing:** **PW.1–PW.2** before relying on per-user enforcement in the wild; **PW.3** can start with schema + one provider once **PW.1** is clear; **PW.4** unblocks `VIPER_ENTITLEMENTS_ENFORCE=1` for real users.

- [ ] **PW.1** **Auth hub** in [`apps/web-app`](apps/web-app): sign-in / sign-up (or IdP), session or token issuance, aligned with backend [`users` / `workspace_memberships`](packages/database/migrations/009_create_auth_core.sql) and [`resolveWorkspaceContext`](apps/backend/src/lib/entitlements.service.ts) once **JWT/OAuth verify** replaces the dev-bearer stub (F.30 in [`CURSOR_COMPETITIVE_ROADMAP.md`](CURSOR_COMPETITIVE_ROADMAP.md)).
- [ ] **PW.2** **Dashboard route** (e.g. `/dashboard` or `/app`): authenticated **home** for usage/quota snapshot, plan/billing entry points, workspace or team context—**one web hub** beyond the desktop [`UsagePanel`](apps/viper-desktop/ui/components/usage-panel.tsx) sidebar.
- [ ] **PW.3** **Integration OAuth framework** (extensible): provider-agnostic **connect / disconnect**, **secure token storage** (refresh, scopes, revocation hooks); design for **multiple PM tools** per [`VIPER_PRODUCT_MANAGEMENT_VISION.md`](VIPER_PRODUCT_MANAGEMENT_VISION.md) (Jira, Linear, GitHub Issues—OAuth or PAT where required). First ship can be **one** provider + **pluggable registry** for the rest.
- [ ] **PW.4** **Desktop handoff:** Electron obtains **`Authorization: Bearer …`** (or agreed scheme) for [`apps/viper-desktop/ui/services/agent-api.ts`](apps/viper-desktop/ui/services/agent-api.ts)—device flow, deep link, or stored token from web login—so enforcement via [`VIPER_ENTITLEMENTS_ENFORCE`](docs/ENV.md) works for real users.
- [ ] **PW.5** **Document the flow:** web ↔ backend ↔ desktop auth and integration storage (update [`docs/ENV.md`](docs/ENV.md) and/or add a focused `docs/` page when the contract stabilizes).

### P4+ — Deeper Cursor-class parity

- [ ] **P4.1** **@ context** in composer: `@file`, `@folder`, symbol picker; extend chat API contract if needed.
- [ ] **P4.2** **Checkpoints / timeline** for agent sessions (scoped milestone; see roadmap §9.1).
- [ ] **P4.3** **Background jobs** with visible status for long-running work.
- [ ] **P4.4** **Inline completion:** index-aware or cross-file context; revisit **build-time** `VITE_*` gates if they block adoption.

### Ongoing (every slice)

- [ ] **QA.1** `npm run quality-gate` passes after the change.
- [ ] **QA.2** Manual smoke: send **chat/stream**, observe phases, **agent edit** → pause/approve → **resume** (and new **Continue**/batch path if P2 shipped).

---

## 10. Metrics and acceptance

- **UX:** Default composer uses **dropdowns or compact menus**, not two chip rows (unless behind “compact mode”).
- **Copy:** Single **canonical** label set for streaming phases (documented in one component or `constants.ts`).
- **Product:** At least one **user-visible** control for **narration strictness** or **agent pause policy** (even if gated).
- **Web / account:** [`apps/web-app`](apps/web-app) exposes a **signed-in dashboard route** and **auth hub**; **integration OAuth** is **extensible** to multiple PM tools (see **§9 PW**).
- **Engineering:** `npm run quality-gate` green; manual **smoke checklist** for chat send, stream, edit pause, resume.

---

## 11. Related documents

| Document | Role |
|----------|------|
| [`CURSOR_COMPETITIVE_ROADMAP.md`](CURSOR_COMPETITIVE_ROADMAP.md) | Historical + H.45 §10 readiness |
| [`RELEASE.md`](RELEASE.md) | Pre-release commands |
| [`SLO.md`](SLO.md) | SLOs and ops APIs |
| [`VIPER_PRODUCT_MANAGEMENT_VISION.md`](VIPER_PRODUCT_MANAGEMENT_VISION.md) | **Phase 2** — integrations + single-workspace PM story (**after** Cursor-class UX per this doc) |

---

## Revision

| Date | Note |
|------|------|
| 2026-04 | Initial gap + plan doc |
| 2026-04 | Added execution order: Cursor-class experience (Phase 1) before PM integrations (Phase 2) |
| 2026-04 | Added §9 sequenced checklist with checkboxes; renumbered former §9–§10 to §10–§11 |
| 2026-04 | §8 **PW** row + §9 **PW** checklist (web-app auth hub, dashboard, OAuth framework, desktop handoff) |
