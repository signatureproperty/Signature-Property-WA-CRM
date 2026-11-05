-- ============================================================
-- 062_custom_fields_enhancements.sql
-- Add entity_type to custom_fields to support both Contacts & Listings
-- Allow operational members to manage fields during CSV import
-- ============================================================

ALTER TABLE custom_fields ADD COLUMN IF NOT EXISTS entity_type TEXT NOT NULL DEFAULT 'contact';
CREATE INDEX IF NOT EXISTS idx_custom_fields_account_entity ON custom_fields(account_id, entity_type);

-- Allow all account members to manage custom fields (needed for auto-creating columns on import)
DROP POLICY IF EXISTS custom_fields_insert ON custom_fields;
CREATE POLICY custom_fields_insert ON custom_fields FOR INSERT WITH CHECK (is_account_member(account_id));

DROP POLICY IF EXISTS custom_fields_update ON custom_fields;
CREATE POLICY custom_fields_update ON custom_fields FOR UPDATE USING (is_account_member(account_id));

DROP POLICY IF EXISTS custom_fields_delete ON custom_fields;
CREATE POLICY custom_fields_delete ON custom_fields FOR DELETE USING (is_account_member(account_id));

