-- Product: user-facing tiers are auto | premium only (legacy `fast` → auto).
-- Optional per-conversation premium model id (registry allowlist).

UPDATE conversation_model_preferences SET model_tier = 'auto' WHERE model_tier = 'fast';

ALTER TABLE conversation_model_preferences
  DROP CONSTRAINT IF EXISTS conversation_model_preferences_model_tier_check;

ALTER TABLE conversation_model_preferences
  ADD CONSTRAINT conversation_model_preferences_model_tier_check
  CHECK (model_tier IN ('auto', 'premium'));

ALTER TABLE conversation_model_preferences
  ADD COLUMN IF NOT EXISTS preferred_premium_model_id TEXT NULL;
