-- F.30: workspace_entitlements — per-workspace capability plan.
--
-- allowed_modes:        JSON array of ChatMode strings (e.g. ["ask","plan","debug","agent"]).
--                       NULL = all modes allowed.
-- allowed_model_tiers:  JSON array of ModelTierSelection strings (e.g. ["auto","fast"]).
--                       NULL = all tiers allowed (defers to D.20 env caps).
-- flags:                Arbitrary JSONB for future feature flags (default '{}'::jsonb).
--
-- Composition rule (documented here, enforced in entitlements.service.ts):
--   effective = intersection(DB plan, D.20 env caps)
--   i.e. env is a global ceiling; DB narrows further per workspace.
--   When no DB row exists, treat as "allow-all" (safe default during rollout).
CREATE TABLE IF NOT EXISTS workspace_entitlements (
  workspace_id        UUID        PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  allowed_modes       JSONB,
  allowed_model_tiers JSONB,
  flags               JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
