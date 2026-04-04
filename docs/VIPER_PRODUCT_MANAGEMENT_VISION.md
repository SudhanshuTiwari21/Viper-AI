# Viper AI: product management integration vision

This document describes how Viper AI can evolve **beyond code-only assistance** toward a **single workspace** where **coding, AI assistance, and the PM stack your company already uses** connect—reducing fragmentation across IDEs, Jira/Linear/Asana-class tools, chat, and docs.

**We are not building a proprietary Jira or Linear competitor.** The goal is **integration and unification**: one Viper workspace that **surfaces, links, and orchestrates** work across **enterprise PM tools** (issue trackers, roadmaps, OKRs where applicable) and **AI coding workflows** (planning, implementation, review, verification)—so teams stop context-switching between ten browser tabs.

It is **forward-looking**. Current engineering status lives in [`CURSOR_COMPETITIVE_ROADMAP.md`](CURSOR_COMPETITIVE_ROADMAP.md), [`RELEASE.md`](RELEASE.md), and [`VIPER_CURSOR_EXPERIENCE_GAP_AND_PLAN.md`](VIPER_CURSOR_EXPERIENCE_GAP_AND_PLAN.md).

**Sequencing:** **First** deliver **Cursor-class IDE + chat** (see [`VIPER_CURSOR_EXPERIENCE_GAP_AND_PLAN.md`](VIPER_CURSOR_EXPERIENCE_GAP_AND_PLAN.md) — Phase 1). **Then** prioritize the integration roadmap below (Phase 2). This document stays valid as the **integration north star**; it does not imply PM work ships before composer UX, agent modes, and settings polish are in a good place.

---

## 1. North star

**One intelligent workspace** where:

- **Everything lives in one place** from the developer’s perspective: the repo, the AI assistant, and **signals from** Jira, Linear, GitHub Issues, Slack, CI, etc.—as much as practical without forcing a rip-and-replace of existing org tooling.
- Developers **plan, implement, verify, and ship** with **work intent** (tickets, epics, constraints) **linked** to code changes, tests, and releases—not orphaned in a separate tool.
- **AI agents** assist across **planning**, **execution** (edits, tests, browser checks), and **handoffs**—with **traceability** back to the repo, external issue keys, and conversation history.

Viper aims at **Cursor-class (or better) coding UX** *plus* **PM integration**, not at replicating every feature of Atlassian, Linear, or Asana inside Viper.

---

## 2. Personas

| Persona | Primary needs | How Viper helps (directional) |
|---------|----------------|------------------------------|
| **IC developer** | Focus, context, safe edits | Agent modes, inline tools, tests, git assistant |
| **Tech lead** | Visibility, standards, review | Plans linked to changes, rules, usage/SLO signals |
| **PM / EM (read-heavy)** | Status without reading every PR | Summaries, work-item rollups, decision log |
| **Ops / platform** | Reliability, cost, policy | Entitlements, quota, SLO ops, privacy boundaries |

---

## 3. Conceptual pillars

### 3.1 Single workspace, not a second Jira

- **Primary stance:** Viper is the **IDE + AI + glue layer**. **Issues, epics, and company-wide process** stay in the systems enterprises already pay for (**Jira**, **Linear**, **Azure DevOps**, **GitHub Issues/Projects**, **Asana** / **Monday** for some teams, etc.). Viper **integrates** them—deep links, status, optional sync, search—rather than asking customers to migrate PM into a new silo.
- **Repo-native artifacts** (markdown specs, ADRs, checklists in git) remain valuable as **source-adjacent truth** and pair well with `@file` / branch links; they **complement** external trackers, they don’t replace org-wide PM.

### 3.2 Work visibility inside Viper (logical layer)

Even when tickets live in Jira/Linear, Viper can expose:

- **Linked work** — issues/epics tied to the current repo, branch, or PR (via API + keys in commits/messages).
- **Context for AI** — “implement JIRA-123” pulls ticket title/description into prompts **read-only** from the integration, with permission boundaries.
- **Specs in repo** — RFCs and plans in markdown, **linked** from chat and from external issues where possible.

### 3.3 Decision log and AI rationale

- **Why** a change was made: assistant summaries, plan mode output, approvals—**optionally** correlated with **external issue IDs** (`JIRA-…`, `LIN-…`).
- **Traceability:** `request_id`, conversation, commit, **external work item references**—building on existing identity and telemetry in the backend.

### 3.4 Integrations (core to the vision)

| Category | Examples (illustrative) |
|----------|-------------------------|
| **Enterprise / team PM** | Jira (Cloud/Server patterns), Linear, Azure Boards, GitHub Issues & Projects, Asana, Monday.com—**pick per org**, integrate; not reimplemented in Viper. |
| **AI / dev tooling** | Viper’s own agent stack; optional future links to org policies for **other** AI tools where relevant (API keys, allowlists)—**single policy surface** over time. |
| **Chat & comms** | Slack, Microsoft Teams—notifications, deep links, slash commands. |
| **CI / VCS** | GitHub/GitLab/Azure Repos, GitHub Actions, Jenkins—status in workspace, link to runs. |

**Principle:** **Bring data in and send context out** (webhooks, OAuth apps, issue keys, PR URLs). **Do not** rebuild portfolio management, full agile boards, or enterprise permissions models—that belongs in the tools companies already standardized on.

### 3.5 Status surfaces

- **Workspace dashboard** (future): unified view—**open issues from integrations**, recent AI runs, quota/SLO snapshot, CI/blockers—**one pane**, multiple backends.
- **Release readiness:** align with [`docs/SLO.md`](SLO.md) and [`docs/RELEASE.md`](RELEASE.md) for engineering; **roadmap health** still rolls up from **integrated** PM tools + git.

---

## 4. How existing Viper capabilities map (on-ramps)

These **already shipped** pieces are **on-ramps** to PM integration—not the full vision:

| Capability | PM-oriented use |
|------------|-----------------|
| **Plan mode** (read-only, structured output) | Specs, RFC drafts, milestone breakdowns |
| **Agent mode** + execution engine | Implementation tied to plans |
| **Test / Git assistants** | “Done” criteria, commit/PR hygiene |
| **Usage + entitlements + billing hooks** | Seat/plan awareness for teams |
| **Privacy layer** | Safe boundaries for sensitive repos |
| **Eval harness + quality gate** | Regression discipline for AI behavior |

---

## 5. What we deliberately avoid

- **Building an in-house Jira/Linear/Azure Boards replacement**—companies already chose their PM stack; Viper **connects** to it.
- **Forcing** every user through a heavyweight PM workflow—solo devs can use Viper as **IDE + AI** only; integrations **unlock** when the org needs them.
- **Becoming the only chat** for humans—Slack/Teams remain; Viper **pushes/pulls context** and notifications where it helps.

**We do want:** a **single integrated workspace** in the IDE that **feels** unified even when data comes from Jira, Linear, GitHub, and Viper’s own agents.

---

## 6. Phased product roadmap (product, not engineering detail)

| Phase | Theme | Outcomes |
|-------|--------|----------|
| **PM0 — Foundation** | Identity + workspace clarity | Strong workspace model; optional auth; entitlements (partially present) |
| **PM1 — Repo + AI glue** | Markdown specs, ADRs, Plan mode output | Conventions; AI-assisted specs **linked** to branches/PRs |
| **PM2 — External PM integration** | **Jira / Linear / GitHub Issues** (priority order per customer) | OAuth or PAT, read issues, link ticket ↔ branch ↔ chat, optional webhooks for status |
| **PM3 — Deeper sync + team** | Broader tool coverage, shared visibility | More trackers (Azure, etc.), Slack/Teams notifications, multi-user workspace |
| **PM4 — Enterprise** | Policy + audit | Org-wide integration allowlists, retention, compliance, SSO for connectors |

Engineering should prioritize **PM2-style integrations** once PM0–PM1 are stable—**that** is the “single workspace” promise, not a Viper-native issue database.

---

## 7. Dependencies

| Dependency | Status in Viper (directional) |
|------------|-------------------------------|
| **Stable workspace identity** | Path keys + DB workspaces (see F.29/F.30) |
| **Auth for teams** | Schema + dev paths; full OAuth product TBD |
| **Entitlements** | `workspace_entitlements`, env gates |
| **Audit / history** | Usage events, workflow logs; richer **decision** store TBD |
| **UX shell** | Settings hub, chat polish—see experience gap doc |

---

## 7.1 Usage, pricing buckets, and BYOK (commercial)

Subscription economics for **Viper-hosted** inference should split **Auto-style** vs **premium / pinned-model** pools (Cursor-class expectation) and support **bring-your-own API keys** in settings with clear routing (e.g. Claude models → user’s Anthropic key). See draft plan: [`VIPER_USAGE_AND_REVENUE_MODEL.md`](VIPER_USAGE_AND_REVENUE_MODEL.md).

---

## 8. Relationship to Cursor-class IDE work

- **Experience gap plan** ([`VIPER_CURSOR_EXPERIENCE_GAP_AND_PLAN.md`](VIPER_CURSOR_EXPERIENCE_GAP_AND_PLAN.md)): make the **daily IDE + chat** competitive with **modern AI coding tools**.
- **This document**: **unify** that experience with **how real companies run PM**—via **integrations**, not a second backlog product.

Successful execution: **one workspace** that combines **best-in-class AI coding** with **the PM and comms tools enterprises already use**.

---

## Revision

| Date | Note |
|------|------|
| 2026-04 | Initial PM vision doc |
| 2026-04 | Reframed: single workspace + integrate Jira/Linear/enterprise PM and AI tools; explicitly not building in-house Jira |
| 2026-04 | Sequencing note: Cursor-class experience (gap doc Phase 1) before Phase 2 PM integrations |
| 2026-04 | §7.1 link to [`VIPER_USAGE_AND_REVENUE_MODEL.md`](VIPER_USAGE_AND_REVENUE_MODEL.md) (Auto/premium pools + BYOK) |
