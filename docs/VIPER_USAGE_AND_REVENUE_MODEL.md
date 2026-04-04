# Viper usage, pricing buckets, and BYOK (draft revenue model)

**Status:** Strategy draft — numbers are **illustrative** until finance and unit economics sign off. **Implementation** should extend existing **F.29–F.35** surfaces (`workspace_entitlements`, `usage_events`, quota, Stripe) rather than inventing a parallel billing system.

**Related:** [`docs/ENV.md`](ENV.md) (entitlements, quota, usage events), [`docs/SLO.md`](SLO.md) (observability), [`VIPER_PRODUCT_MANAGEMENT_VISION.md`](VIPER_PRODUCT_MANAGEMENT_VISION.md) (Phase 2 integrations).

---

## 1. Why two buckets (Auto vs “specific” / premium usage)

Products like Cursor separate:

1. **Included “Auto” (or router-managed) usage** — cheaper for the platform to optimize (routing, caps, model mix). Users stay in a **predictable cost band**.
2. **Premium / pinned-model usage** — user picks a **concrete** strong model; marginal cost is higher and less predictable, so it is **metered separately** and often **smaller** on a fixed-price tier.

Viper already exposes **`modelTier`**: `auto` | `premium` | `fast` in the API. The **revenue plan** below treats:

| User-facing concept | Maps to Viper (today / near-term) | Billing bucket |
|----------------------|-----------------------------------|----------------|
| **Auto-style included usage** | Client `modelTier: "auto"` (router + env defaults) | **Bucket A — included auto** |
| **Specific / premium model usage** | Client `modelTier: "premium"` or future **pinned `modelId`** | **Bucket B — premium / API-style** |
| **Fast tier** | `modelTier: "fast"` | Product choice: sub-bucket of A, or share B with a different multiplier |

**Rule:** Every completed chat request must classify into **exactly one** billable bucket for **Viper-hosted** inference (unless BYOK — see §5).

---

## 2. Illustrative **$20 / month** personal tier (tunable)

Assume a **single seat**, **Viper-hosted** keys, monthly reset (UTC), **request-based** metering first (tokens can layer on later using `usage_events` nullables).

| Pool | Purpose | Example monthly cap | Overage behavior (product choice) |
|------|---------|----------------------|-----------------------------------|
| **A — Auto** | `modelTier: "auto"`; router picks model within allowed registry | **500 requests** | Soft warning at 80%; hard stop at 100% **or** switch to “upgrade / wait for reset” |
| **B — Premium / specific** | `modelTier: "premium"` or future pinned high-cost models | **100 requests** | Stricter: no silent spill to Auto unless user toggles tier in UI |
| **C — Fast-only** *(optional)* | `modelTier: "fast"` only | Include in A (e.g. unlimited within A) **or** separate small pool if you want to cap cheapest path | Document clearly in marketing |

**Composition example (story for landing page):**

- “**~500 Auto requests** included for everyday coding.”
- “**~100 premium-model requests** when you pin Premium or pick a flagship model.”
- “Unused premium requests **do not** roll into Auto (avoids margin surprise); unused Auto **does not** roll to premium.”

**Why sharp split:** Auto pool protects **COGS**; premium pool prices in **worst-case** model cost per request. Adjust ratios after **real** p50/p95 token data from `usage_events` once token columns are populated.

**Stripe mapping:** One **Price** → `workspace_entitlements.flags` JSON, e.g.:

- `monthly_auto_request_quota`
- `monthly_premium_request_quota`  
  (Keep `monthly_request_quota` as **optional** legacy “single bucket” until migration.)

Quota checks in [`apps/backend`](../apps/backend) extend **F.33** to decrement the correct counter from `effective_model_tier` + future `pinned_model_id`.

---

## 3. Enforcement points (no double counting)

1. **Pre-flight (after auth / entitlements):** Resolve `billing_bucket` from `modelTier` + optional pinned model.
2. **On success (`request:complete`):** Increment the right monthly counter; emit `usage_events` with **`billing_bucket`** (new field) for analytics.
3. **BYOK requests (§5):** Increment **Viper** usage **only** if you charge a platform fee; otherwise **exclude** from A/B or use a **“platform fee”** micro-bucket.

**Downgrade path when a bucket is exhausted:**

- **Premium exhausted, Auto available:** HTTP **429** with body explaining “Premium limit reached; switch to Auto or upgrade.” Optionally offer one-click tier downgrade in desktop.
- **Auto exhausted:** Same pattern; upsell next tier.

---

## 4. Higher tiers (sketch)

| Tier | Auto pool (illustr.) | Premium pool (illustr.) | Team features |
|------|----------------------|---------------------------|---------------|
| **$20** | 500 | 100 | — |
| **$40** | 1,200 | 300 | Shared workspace, admin |
| **Team** | Per-seat pools + **optional** shared premium pool | Negotiated | SSO, audit |

Keep **one source of truth** in Stripe metadata → entitlements; avoid hard-coding in app.

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

1. **Schema:** Extend `usage_events` / rollups with `billing_bucket` (`auto` | `premium` | `fast` | `byok_orchestration`) and optional `used_customer_key: boolean`.
2. **Entitlements:** New flags on `workspace_entitlements` for split quotas; Stripe price JSON mapping in [`docs/ENV.md`](ENV.md) pattern.
3. **Quota service:** Dual (or triple) counters per workspace per UTC month; **F.33** branch on resolved bucket.
4. **Desktop + web:** Usage panel shows **Auto used / Auto limit** and **Premium used / Premium limit** (and BYOK indicator).
5. **BYOK:** Key vault API + registry-driven routing in model resolution layer (before OpenAI/Anthropic client creation).

---

## 7. Open decisions (product / legal)

- Token-based vs request-based caps (or **weighted requests**: premium = 3× Auto).
- Rollover, annual plans, and **true-up** for teams.
- Regional pricing and tax (Stripe Tax).
- Whether **fast** tier is unlimited on low tiers (abuse risk).

---

## Revision

| Date | Note |
|------|------|
| 2026-04 | Initial draft: dual bucket $20 example, BYOK, enforcement sketch |
