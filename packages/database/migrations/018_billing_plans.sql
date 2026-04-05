-- Billing plan catalog + workspace.plan pointer.
-- Z/A/P (basis points): z_ratio_bp = % of list price budgeted to provider-side inference (e.g. 4000 = 40%).
-- auto_budget_share_bp / premium_budget_share_bp = split of that inference budget (e.g. 7500/2500 = 75/25).
-- Per-workspace overrides stay in workspace_entitlements (merged on read: plan defaults, then row overrides).

CREATE TABLE IF NOT EXISTS billing_plans (
  slug                    TEXT PRIMARY KEY,
  display_name            TEXT        NOT NULL,
  allowed_modes           JSONB       NULL,
  allowed_model_tiers     JSONB       NOT NULL DEFAULT '["auto","premium"]'::jsonb,
  flags                   JSONB       NOT NULL DEFAULT '{}'::jsonb,
  z_ratio_bp              INT         NULL,
  auto_budget_share_bp    INT         NULL,
  premium_budget_share_bp INT         NULL
);

COMMENT ON TABLE billing_plans IS 'Default entitlements + quota flags per commercial plan; Neon-editable.';
COMMENT ON COLUMN billing_plans.flags IS 'JSONB: monthly_request_quota, included_*_usage_credits_monthly, quota_soft_threshold_ratio, usage_warning_threshold_ratio, etc.';

INSERT INTO billing_plans (slug, display_name, allowed_model_tiers, flags, z_ratio_bp, auto_budget_share_bp, premium_budget_share_bp)
VALUES
  (
    'free',
    'Free',
    '["auto"]'::jsonb,
    jsonb_build_object(
      'monthly_request_quota', 5,
      'usage_warning_threshold_ratio', 0.4
    ),
    NULL,
    NULL,
    NULL
  ),
  (
    'pro_20',
    'Pro ($20)',
    '["auto","premium"]'::jsonb,
    jsonb_build_object(
      'included_auto_usage_credits_monthly', 80000,
      'included_premium_usage_credits_monthly', 24000,
      'quota_soft_threshold_ratio', 0.8,
      'usage_warning_threshold_ratio', 0.4
    ),
    4000,
    7500,
    2500
  ),
  (
    'plus_40',
    'Plus ($40)',
    '["auto","premium"]'::jsonb,
    jsonb_build_object(
      'included_auto_usage_credits_monthly', 160000,
      'included_premium_usage_credits_monthly', 48000,
      'quota_soft_threshold_ratio', 0.8,
      'usage_warning_threshold_ratio', 0.4
    ),
    4000,
    7500,
    2500
  )
ON CONFLICT (slug) DO NOTHING;

-- FK added after seed
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS billing_plan_slug TEXT NOT NULL DEFAULT 'free'
    REFERENCES billing_plans (slug);

-- Backfill existing rows (IF NOT EXISTS column may skip default on old PG — explicit update)
UPDATE workspaces SET billing_plan_slug = 'free' WHERE billing_plan_slug IS NULL;
