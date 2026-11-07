-- ============================================================
-- 065_notes_and_column_ordering.sql
-- 1. Add notes column to contacts & property_listings
-- 2. Add display_order to account_column_settings
-- 3. Add 'google' provider support to ai_configs and ai_usage_log
-- ============================================================

-- 1. Notes column
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE property_listings
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Display order for custom column ordering
ALTER TABLE account_column_settings
  ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_account_column_settings_order
  ON account_column_settings(account_id, entity_type, display_order);

-- 3. Google Gemini provider support in ai_configs and ai_usage_log
ALTER TABLE ai_configs
  DROP CONSTRAINT IF EXISTS ai_configs_provider_check;

ALTER TABLE ai_configs
  ADD CONSTRAINT ai_configs_provider_check
  CHECK (provider IN ('openai', 'anthropic', 'openai_compatible', 'google'));

ALTER TABLE ai_usage_log
  DROP CONSTRAINT IF EXISTS ai_usage_log_provider_check;

ALTER TABLE ai_usage_log
  ADD CONSTRAINT ai_usage_log_provider_check
  CHECK (provider IN ('openai', 'anthropic', 'openai_compatible', 'google'));

