# Viper usage, pricing buckets, and BYOK (draft revenue model)

**Status:** Strategy draft — numbers are **illustrative** until finance and unit economics sign off. **Implementation** should extend existing **F.29–F.35** surfaces (`workspace_entitlements`, `usage_events`, quota, Stripe) rather than inventing a parallel billing system.

**Related:** [`docs/ENV.md`](ENV.md) (entitlements, quota, usage events), [`docs/SLO.md`](SLO.md) (observability), [`VIPER_PRODUCT_MANAGEMENT_VISION.md`](VIPER_PRODUCT_MANAGEMENT_VISION.md) (Phase 2 integrations).

---

## 1. Why two buckets (Auto vs “specific” / premium usage)

Products like Cursor separate:

1. **Included “Auto” (or router-managed) usage** — cheaper for the platform to optimize (routing, caps, model mix). Users stay in a **predictable cost band**.
2. **Premium / pinned-model usage** — user picks a **concrete** strong model; marginal cost is higher and less predictable, so it is **metered separately** and often **smaller** on a fixed-price tier.

Viper exposes **`modelTier`**: `auto` | `premium` in the product API (legacy clients may send `fast`; it is normalized to `auto`). Optional **`premiumModelId`** selects an allowlisted flagship model when tier is premium. The **revenue plan** below treats:

| User-facing concept | Maps to Viper (today / near-term) | Billing bucket |
|----------------------|-----------------------------------|----------------|
| **Auto-style included usage** | Client `modelTier: "auto"` (router + env defaults) | **Bucket A — included auto** |
| **Specific / premium model usage** | Client `modelTier: "premium"` + optional `premiumModelId` | **Bucket B — premium / API-style** |

**Rule:** Every completed chat request must classify into **exactly one** billable bucket for **Viper-hosted** inference (unless BYOK — see §5).

### 1.1 Why “N premium chats” is the wrong cap

A **fixed number of Premium completions** (e.g. “100 chats”) is **not safe** if the user picks **very expensive** models (e.g. a flagship Claude / “Opus-class” tier). A hundred long threads on such a model can **burn disproportionate COGS** versus the same count on a cheaper premium SKU. **Auto** has the same shape of problem at a smaller spread (router still varies cost), but **Premium + user-selected model** is where the tail risk is largest.

**Product principle:** For **both** Auto and Premium included usage, tie the customer-facing promise to a **bounded included allowance** expressed internally as **usage credits** (derived from **estimated or actual provider cost** per completion using **tokens × model-specific unit economics** from the registry / pricing table). **Do not** show users **dollars** or **raw internal credits** in the product UI — show **percentage of included allowance used** per bucket (e.g. “Auto: 42% of included usage”, “Premium: 18% of included usage”), with soft warnings as they approach 100%.

---

## 2. Illustrative **$20 / month** personal tier (tunable)

Assume a **single seat**, **Viper-hosted** keys, **monthly reset (UTC)**.

| Pool | Purpose | What we fix internally (illustr.) | What the user sees |
|------|---------|-------------------------------------|--------------------|
| **A — Auto** | `modelTier: "auto"`; router picks model | A **monthly included usage budget** for this bucket (credits pegged to expected COGS, e.g. “$3.50 of inference at our blended Auto mix” — finance sets the number) | **% of included Auto usage used** this period (not $, not a raw chat count as the primary meter) |
| **B — Premium** | `modelTier: "premium"` + `premiumModelId` | A **separate, smaller** monthly included budget so Opus-class picks cannot drain the whole plan | **% of included Premium usage used** (not $) |

**Debit rule:** On each **successful** hosted completion, decrement the right bucket by **cost_units** ∝ **tokens in/out × model price sheet** (exact formula is engineering; conservative **pre-flight estimates** + **post-hoc reconciliation** optional). Heavy models burn **more** of the Premium % in **fewer** chats — which is what you want.

**Composition example (story for landing page — marketing may still give a *typical* chat range, but legal/product truth is %-of-included):**

- “**Included Auto usage** for everyday coding — usage shown as **how much of your included allowance you’ve used**.”
- “**Included Premium usage** for when you pick a flagship model — same **percentage** idea, **separate** allowance so expensive models don’t surprise us or you.”
- Unused allowance in one bucket **does not** roll into the other (same as before).

**Stripe mapping:** One **Price** → `workspace_entitlements.flags` JSON, e.g.:

- `included_auto_usage_credits_monthly` (integer or decimal “credit” unit — internal)
- `included_premium_usage_credits_monthly`  
  Legacy: `monthly_auto_request_quota` / `monthly_premium_request_quota` only if you keep a **separate** deprecated path; **preferred** path is credit-based.

Quota checks in [`apps/backend`](../apps/backend) extend **F.33**: before accept, **remaining credits** in the bucket for `effective_model_tier` (and optional model id); after success, **debit** by computed `cost_units`.

---

## 3. Enforcement points (no double counting)

1. **Pre-flight (after auth / entitlements):** Resolve `billing_bucket` from `modelTier` + optional pinned model; estimate **minimum remaining credits** after this request (or use a conservative **max cost per request** cap for pre-check).
2. **On success (`request:complete`):** **Debit** the bucket by **cost_units**; emit `usage_events` with **`billing_bucket`**, **tokens**, **`cost_units`**, **`model_id`** for analytics and reconciliation.
3. **BYOK requests (§5):** Increment **Viper** usage **only** if you charge a platform fee; otherwise **exclude** from A/B or use a **“platform fee”** micro-bucket.

**Downgrade path when a bucket is exhausted (credits → 0% remaining):**

- **Premium exhausted, Auto available:** HTTP **429** with copy like “You’ve used your **included Premium allowance** this period; switch to **Auto** or upgrade.” Optionally one-click tier switch in desktop.
- **Auto exhausted:** Same pattern; upsell next tier.

**UI:** Show **percentage used** (and optional “reset date”), not dollar burn rate to the end user.

---

## 4. Higher tiers (sketch)

| Tier | Included Auto (internal) | Included Premium (internal) | Team features |
|------|--------------------------|-----------------------------|---------------|
| **$20** | Larger **credit** allowance | Smaller **credit** allowance | — |
| **$40** | Higher credits | Higher credits | Shared workspace, admin |
| **Team** | Per-seat credits + optional pool | Per-seat / shared (negotiated) | SSO, audit |

User-facing for all rows: **% used** per bucket, not raw dollars. Keep **one source of truth** in Stripe metadata → entitlements (`included_*_usage_credits_monthly` or equivalent); avoid hard-coding in app.

---

## 5. Bring-your-own-key (BYOK) — settings + routing

### 5.1 Product behavior

- **Settings** (future **P3** / web-app **PW**): per provider sections — e.g. **Anthropic API key**, **OpenAI API key**, toggle **“Use my key for Claude models”** / **“Use my key for OpenAI models”**.
- **Routing rule (example):** If BYOK Anthropic is **on** and effective model id is under **Claude** (`claude-*` or registry `provider === "anthropic"`), execute the request with **user’s key** from **secure storage**; otherwise use **Viper** pool and normal A/B buckets.
- **Transparency:** UI shows a small **“Using your Anthropic key”** badge when BYOK applies so users understand billing.

### 5.2 Security & compliance (non-negotiable)

- Store keys **encrypted at rest** (KMS or libsodium with server secret); **never** log key material; redact in support tools.
- **Scopes:** Keys are **server-side only** (desktop sends “use BYOK” flag + session auth; **not** the raw key over chat API).
- **Rotation:** Let users replace key; revoke old ciphertext immediately.

### 5.3 Revenue interaction

| Model | Viper charges subscription for BYOK? |
|-------|--------------------------------------|
| **Pure pass-through** | $0 marginal on tokens; subscription is for **product** (IDE, sync, PM integrations). |
| **Hybrid** | Small **included** BYOK “orchestration” allowance + fee for managed features. |
| **Cursor-like** | Often **custom API** usage is **separate** from included fast/auto — mirror that with clear copy. |

Recommendation for v1: **BYOK requests do not consume A/B Viper-hosted pools**; they consume **user’s** provider bill. Viper still records **telemetry** (no key) for support and SLOs.

---

## 6. Engineering backlog (ordered)

1. **Schema:** Extend `usage_events` / rollups with `billing_bucket`, **`cost_units`**, token fields, `model_id`, and optional `used_customer_key: boolean`.
2. **Registry / pricing sheet:** Per-**model_id** unit economics (or multipliers) so **cost_units** are computable server-side.
3. **Entitlements:** `included_auto_usage_credits_monthly`, `included_premium_usage_credits_monthly` (names indicative); Stripe price JSON mapping in [`docs/ENV.md`](ENV.md) pattern.
4. **Quota service:** Dual **credit balances** per workspace per UTC month; **F.33** pre-check + post-success debit; handle **unknown** token totals with conservative estimates.
5. **Desktop + web:** Usage surfaces show **% of included Auto** and **% of included Premium** (and BYOK indicator). **No** user-visible dollar meter for included allowance.
6. **BYOK:** Key vault API + registry-driven routing in model resolution layer (before OpenAI/Anthropic client creation).

---

## 7. Open decisions (product / legal)

- **Credit unit** definition (micro-dollars vs abstract points) and **rounding** rules.
- Rollover, annual plans, and **true-up** for teams.
- Regional pricing and tax (Stripe Tax).
- **Hard caps** for a single request (max tokens / max `cost_units`) to bound pre-flight uncertainty.

**Resolved direction (for hosted inference):** **Not** “100 premium chats” as the primary cap — **included credits per bucket** with **%-of-included** UX; expensive models consume credits faster.

---

## 8. Illustrative **$20 / month** economics (how to think about “who gets what”)

**This is not accounting** — it is a **planning frame**. Stripe collects **$20** (**revenue**). Internally you assign **included inference budgets** (credits) to **Auto** and **Premium** so that **even if** someone uses only the most expensive Premium model, they **cannot** exceed the **Premium credit pool** without upgrading — you do **not** rely on chat count.

1. **Pick internal COGS caps (illustrative):** e.g. “We are willing to spend up to **$X** of provider cost on **Auto-shaped** traffic and **$Y** on **Premium-shaped** traffic per seat per month at list $20.” Map **$X** and **$Y** into **`included_auto_usage_credits_monthly`** and **`included_premium_usage_credits_monthly`** using your internal **cost_units ↔ provider $** table.

2. **Meter in cost_units, show %:** Each completion debits the right pool. User sees **“Premium: 76% of included usage”** — not “you spent $4.82” — so the product stays simple and you avoid **margin blow-ups** from Opus-class usage patterns.

3. **Gross margin (illustrative):** If combined internal caps align with **~$7** inference COGS at “heavy but in-bounds” usage and **~$3** payment/tax, **~$10** remains for ops/margin. Finance tunes **$X/$Y** and **list price** together.

**Rule of thumb:** The subscription buys **seat + product**; **included usage** is a **credit pool** per bucket; **UX is percentage**, **engineering is cost-aware**.

---

## Revision

| Date | Note |
|------|------|
| 2026-04 | Initial draft: dual bucket $20 example, BYOK, enforcement sketch |
| 2026-04-02 | Product API: `auto` \| `premium` + `premiumModelId`; §8 illustrative $20 COGS/margin framing |
| 2026-04-02 | Credit-based Auto/Premium pools; user-facing **% of included** only; reject raw “N premium chats” as primary cap |
