-- 064_contact_real_estate_fields.sql
-- Add Real Estate default fields (Sr No, City, Area, Property Type, Size, Budget) to contacts

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS serial_no TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS area TEXT,
  ADD COLUMN IF NOT EXISTS property_type TEXT,
  ADD COLUMN IF NOT EXISTS size TEXT,
  ADD COLUMN IF NOT EXISTS budget TEXT;

CREATE INDEX IF NOT EXISTS idx_contacts_account_city ON contacts(account_id, city);
CREATE INDEX IF NOT EXISTS idx_contacts_account_serial ON contacts(account_id, serial_no);
CREATE INDEX IF NOT EXISTS idx_contacts_account_prop_type ON contacts(account_id, property_type);

