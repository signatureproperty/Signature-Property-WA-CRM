-- ============================================================
-- 063_account_column_settings.sql
-- Store account-level column label overrides and deleted/hidden state
-- for both default system columns and custom columns.
-- ============================================================

CREATE TABLE IF NOT EXISTS account_column_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- 'contact' | 'listing'
  column_id TEXT NOT NULL,   -- e.g. 'company', 'demand_price', etc.
  label TEXT NOT NULL,       -- customized display label
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, entity_type, column_id)
);

CREATE INDEX IF NOT EXISTS idx_account_column_settings_acc_entity
  ON account_column_settings(account_id, entity_type);

ALTER TABLE account_column_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_column_settings_select ON account_column_settings;
CREATE POLICY account_column_settings_select ON account_column_settings
  FOR SELECT USING (is_account_member(account_id));

DROP POLICY IF EXISTS account_column_settings_insert ON account_column_settings;
CREATE POLICY account_column_settings_insert ON account_column_settings
  FOR INSERT WITH CHECK (is_account_member(account_id));

DROP POLICY IF EXISTS account_column_settings_update ON account_column_settings;
CREATE POLICY account_column_settings_update ON account_column_settings
  FOR UPDATE USING (is_account_member(account_id));

DROP POLICY IF EXISTS account_column_settings_delete ON account_column_settings;
CREATE POLICY account_column_settings_delete ON account_column_settings
  FOR DELETE USING (is_account_member(account_id));

