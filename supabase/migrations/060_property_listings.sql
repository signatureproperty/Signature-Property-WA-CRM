-- ============================================================
-- 060_property_listings.sql — Real Estate Property Listings
-- ============================================================

CREATE TABLE IF NOT EXISTS property_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  serial_no TEXT,                         -- e.g. 'P-1', 'LHR-002'
  title TEXT NOT NULL,                     -- e.g. '7.5 Marla Old House, Samanabad'
  contact_number TEXT,                     -- Seller / Owner phone number
  city TEXT,                               -- e.g. 'Lahore'
  area TEXT,                               -- e.g. 'Samanabad', 'DHA Phase 5'
  address TEXT,                            -- Detailed address / landmarks
  property_type TEXT,                      -- 'House', 'Old House', 'Plot', 'Commercial', 'Apartment', etc.
  size TEXT,                               -- '7.5 Marla', '1 Kanal', '120 Sq Yd'
  storey TEXT,                             -- 'Single Storey', 'Double Storey', 'Triple Storey'
  front_dimension TEXT,                    -- e.g. '30 ft'
  length_dimension TEXT,                   -- e.g. '55 ft'
  demand_price TEXT,                       -- e.g. '2.2 Cr' or '22,000,000'
  potential_rent TEXT,                     -- e.g. '75,000 / month'
  utilities TEXT,                          -- e.g. 'Electricity, Gas, Water'
  documents TEXT,                          -- e.g. 'Registry Inteqal', 'Fard', 'Allotment Letter'
  status TEXT NOT NULL DEFAULT 'available',-- 'available', 'under_offer', 'sold', 'rented'
  description TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  custom_fields JSONB NOT NULL DEFAULT '{}',
  images TEXT[] NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for lightning fast search and filtering
CREATE INDEX IF NOT EXISTS idx_property_listings_account_id ON property_listings(account_id);
CREATE INDEX IF NOT EXISTS idx_property_listings_status ON property_listings(account_id, status);
CREATE INDEX IF NOT EXISTS idx_property_listings_city ON property_listings(account_id, city);
CREATE INDEX IF NOT EXISTS idx_property_listings_type ON property_listings(account_id, property_type);

-- Row Level Security
ALTER TABLE property_listings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Drop existing policies if any to ensure idempotency
  DROP POLICY IF EXISTS property_listings_select ON property_listings;
  DROP POLICY IF EXISTS property_listings_insert ON property_listings;
  DROP POLICY IF EXISTS property_listings_update ON property_listings;
  DROP POLICY IF EXISTS property_listings_delete ON property_listings;
END $$;

CREATE POLICY property_listings_select ON property_listings 
  FOR SELECT USING (is_account_member(account_id));

CREATE POLICY property_listings_insert ON property_listings 
  FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));

CREATE POLICY property_listings_update ON property_listings 
  FOR UPDATE USING (is_account_member(account_id, 'agent'));

CREATE POLICY property_listings_delete ON property_listings 
  FOR DELETE USING (is_account_member(account_id, 'agent'));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_property_listings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_property_listings_updated_at ON property_listings;
CREATE TRIGGER tr_property_listings_updated_at
  BEFORE UPDATE ON property_listings
  FOR EACH ROW
  EXECUTE FUNCTION update_property_listings_updated_at();

