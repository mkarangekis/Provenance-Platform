-- ============================================================================
-- PROVENANCE PULSE - DATABASE SCHEMA
-- ============================================================================
-- Multi-tenant SaaS for provenance tracking and AI-powered document extraction
--
-- IMPORTANT: Run this schema in your Supabase SQL Editor
-- Then apply RLS policies from rls-policies.sql
-- Then apply storage policies from storage-policies.sql
--
-- ============================================================================

-- Enable UUID extension (required for primary keys)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ORGANIZATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS orgs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orgs_created_at ON orgs(created_at DESC);

-- ============================================================================
-- USER PROFILES
-- ============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_org_id ON profiles(org_id);
CREATE INDEX idx_profiles_role ON profiles(role);

-- ============================================================================
-- ARTIST AUTHORITY & TAXONOMY (Auction)
-- ============================================================================

CREATE TABLE IF NOT EXISTS artist_authority (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  birth_year INT,
  death_year INT,
  nationality TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(name)
);

CREATE INDEX idx_artist_authority_name ON artist_authority(name);

CREATE TABLE IF NOT EXISTS object_taxonomy (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label TEXT NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(label)
);

CREATE INDEX idx_object_taxonomy_label ON object_taxonomy(label);

-- ============================================================================
-- PROVENANCE OBJECTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS objects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  artist TEXT,
  description TEXT,
  status TEXT DEFAULT 'intake' CHECK (status IN ('intake', 'processing', 'review', 'complete', 'archived')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_objects_org_id ON objects(org_id);
CREATE INDEX idx_objects_created_by ON objects(created_by);
CREATE INDEX idx_objects_status ON objects(status);
CREATE INDEX idx_objects_created_at ON objects(created_at DESC);

ALTER TABLE objects
  ADD COLUMN IF NOT EXISTS artist_authority_id UUID REFERENCES artist_authority(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_objects_artist_authority_id ON objects(artist_authority_id);

ALTER TABLE objects
  ADD COLUMN IF NOT EXISTS catalog_title TEXT,
  ADD COLUMN IF NOT EXISTS catalog_year TEXT,
  ADD COLUMN IF NOT EXISTS catalog_medium TEXT,
  ADD COLUMN IF NOT EXISTS catalog_dimensions TEXT,
  ADD COLUMN IF NOT EXISTS catalog_classification TEXT,
  ADD COLUMN IF NOT EXISTS catalog_culture TEXT,
  ADD COLUMN IF NOT EXISTS catalog_description TEXT,
  ADD COLUMN IF NOT EXISTS catalog_keywords TEXT[],
  ADD COLUMN IF NOT EXISTS catalog_provenance_summary TEXT,
  ADD COLUMN IF NOT EXISTS catalog_sources JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS catalog_status TEXT NOT NULL DEFAULT 'draft' CHECK (catalog_status IN ('draft', 'approved')),
  ADD COLUMN IF NOT EXISTS catalog_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS catalog_approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS catalog_approved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_objects_catalog_status ON objects(catalog_status);

-- ============================================================================
-- OBJECT DOCUMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS object_docs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  object_id UUID NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  doc_type TEXT NOT NULL,
  file_size_bytes BIGINT,
  original_filename TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_object_docs_org_id ON object_docs(org_id);
CREATE INDEX idx_object_docs_object_id ON object_docs(object_id);
CREATE INDEX idx_object_docs_uploaded_by ON object_docs(uploaded_by);
CREATE INDEX idx_object_docs_created_at ON object_docs(created_at DESC);

-- ============================================================================
-- AI EXTRACTION JOBS
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_extractions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  object_id UUID NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  doc_id UUID REFERENCES object_docs(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'done', 'failed')),
  source TEXT DEFAULT 'document' CHECK (source IN ('document', 'manual', 'bulk')),
  extracted_text TEXT,
  extracted_json JSONB,
  error TEXT,

  -- Retry logic fields (Phase 2)
  attempts INT DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_extractions_org_id ON ai_extractions(org_id);
CREATE INDEX idx_ai_extractions_object_id ON ai_extractions(object_id);
CREATE INDEX idx_ai_extractions_doc_id ON ai_extractions(doc_id);
CREATE INDEX idx_ai_extractions_status ON ai_extractions(status);
CREATE INDEX idx_ai_extractions_created_at ON ai_extractions(created_at DESC);
CREATE INDEX idx_ai_extractions_next_attempt ON ai_extractions(next_attempt_at) WHERE status = 'queued';

-- ============================================================================
-- PROVENANCE EVENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS provenance_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  object_id UUID NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  source_extraction_id UUID REFERENCES ai_extractions(id) ON DELETE SET NULL,

  -- Event details
  event_date DATE,
  event_type TEXT NOT NULL DEFAULT 'other',
  description TEXT NOT NULL,
  parties TEXT,
  location TEXT,
  evidence TEXT,

  -- Approval workflow
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  confidence REAL CHECK (confidence >= 0 AND confidence <= 1),

  -- Idempotency (Phase 2)
  event_hash TEXT,

  -- Audit fields
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_provenance_events_org_id ON provenance_events(org_id);
CREATE INDEX idx_provenance_events_object_id ON provenance_events(object_id);
CREATE INDEX idx_provenance_events_source_extraction ON provenance_events(source_extraction_id);
CREATE INDEX idx_provenance_events_status ON provenance_events(status);
CREATE INDEX idx_provenance_events_event_date ON provenance_events(event_date);
CREATE INDEX idx_provenance_events_created_at ON provenance_events(created_at DESC);

-- Unique constraint for idempotency (Phase 2)
CREATE UNIQUE INDEX idx_provenance_events_dedup
  ON provenance_events(object_id, event_hash, source_extraction_id)
  WHERE event_hash IS NOT NULL AND source_extraction_id IS NOT NULL;

-- ============================================================================
-- OBJECT TAXONOMY MAPPING
-- ============================================================================

CREATE TABLE IF NOT EXISTS object_taxonomy_map (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  object_id UUID NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  taxonomy_id UUID NOT NULL REFERENCES object_taxonomy(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(object_id, taxonomy_id)
);

CREATE INDEX idx_object_taxonomy_map_object_id ON object_taxonomy_map(object_id);
CREATE INDEX idx_object_taxonomy_map_taxonomy_id ON object_taxonomy_map(taxonomy_id);

-- ============================================================================
-- ORGANIZATION MEMBERS (Phase 4)
-- ============================================================================

CREATE TABLE IF NOT EXISTS org_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(org_id, user_id)
);

CREATE INDEX idx_org_members_org_id ON org_members(org_id);
CREATE INDEX idx_org_members_user_id ON org_members(user_id);
CREATE INDEX idx_org_members_role ON org_members(role);

-- ============================================================================
-- INVITATIONS (Phase 4)
-- ============================================================================

CREATE TABLE IF NOT EXISTS invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(org_id, email, status)
);

CREATE INDEX idx_invites_org_id ON invites(org_id);
CREATE INDEX idx_invites_email ON invites(email);
CREATE INDEX idx_invites_token ON invites(token);
CREATE INDEX idx_invites_status ON invites(status);
CREATE INDEX idx_invites_expires_at ON invites(expires_at);

-- ============================================================================
-- AUDIT LOG (Phase 5)
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Action details
  action TEXT NOT NULL, -- e.g., 'event.approved', 'event.rejected', 'event.edited', 'object.created'
  resource_type TEXT NOT NULL, -- e.g., 'provenance_event', 'object', 'org_member'
  resource_id UUID NOT NULL,

  -- Metadata
  changes JSONB, -- Before/after values for edits
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Context
  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_org_id ON audit_log(org_id);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);

-- ============================================================================
-- AUCTION WORKFLOW (Consignments, Sales, Lots, Bidders, Bids, Invoices)
-- ============================================================================

CREATE TABLE IF NOT EXISTS auction_consignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  object_id UUID REFERENCES objects(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  consignor_name TEXT NOT NULL,
  consignor_email TEXT,
  consignor_phone TEXT,
  status TEXT NOT NULL DEFAULT 'intake' CHECK (status IN ('intake', 'review', 'approved', 'rejected', 'consigned')),
  valuation_status TEXT NOT NULL DEFAULT 'pending' CHECK (valuation_status IN ('pending', 'reviewed', 'approved', 'rejected')),
  valuation_notes TEXT,
  estimate_low NUMERIC,
  estimate_high NUMERIC,
  reserve_amount NUMERIC,
  reserve_approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reserve_approved_at TIMESTAMPTZ,
  contract_status TEXT NOT NULL DEFAULT 'pending' CHECK (contract_status IN ('pending', 'sent', 'signed', 'declined')),
  contract_provider TEXT,
  contract_url TEXT,
  contract_signed_at TIMESTAMPTZ,
  intake_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_auction_consignments_org_id ON auction_consignments(org_id);
CREATE INDEX idx_auction_consignments_object_id ON auction_consignments(object_id);
CREATE INDEX idx_auction_consignments_status ON auction_consignments(status);

CREATE TABLE IF NOT EXISTS auction_sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  sale_date TIMESTAMPTZ,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'live', 'closed', 'settled', 'canceled')),
  currency TEXT NOT NULL DEFAULT 'USD',
  buyer_premium_rate NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_auction_sales_org_id ON auction_sales(org_id);
CREATE INDEX idx_auction_sales_status ON auction_sales(status);
CREATE INDEX idx_auction_sales_date ON auction_sales(sale_date);

CREATE TABLE IF NOT EXISTS auction_lots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES auction_sales(id) ON DELETE SET NULL,
  object_id UUID REFERENCES objects(id) ON DELETE SET NULL,
  lot_number TEXT,
  order_index INT,
  title_override TEXT,
  estimate_low NUMERIC,
  estimate_high NUMERIC,
  reserve_amount NUMERIC,
  guarantee_amount NUMERIC,
  hammer_price NUMERIC,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sold', 'passed', 'withdrawn')),
  withdrawal_reason TEXT,
  financing_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_auction_lots_org_id ON auction_lots(org_id);
CREATE INDEX idx_auction_lots_sale_id ON auction_lots(sale_id);
CREATE INDEX idx_auction_lots_object_id ON auction_lots(object_id);
CREATE INDEX idx_auction_lots_status ON auction_lots(status);
CREATE INDEX idx_auction_lots_order_index ON auction_lots(order_index);

CREATE TABLE IF NOT EXISTS condition_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  lot_id UUID NOT NULL REFERENCES auction_lots(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  summary TEXT,
  report_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(lot_id)
);

CREATE INDEX idx_condition_reports_org_id ON condition_reports(org_id);
CREATE INDEX idx_condition_reports_lot_id ON condition_reports(lot_id);

CREATE TABLE IF NOT EXISTS auction_bidders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  kyc_status TEXT NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'verified', 'failed')),
  registration_status TEXT NOT NULL DEFAULT 'pending' CHECK (registration_status IN ('pending', 'approved', 'denied')),
  bidding_limit NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_auction_bidders_org_id ON auction_bidders(org_id);
CREATE INDEX idx_auction_bidders_status ON auction_bidders(registration_status);

CREATE TABLE IF NOT EXISTS auction_bids (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  lot_id UUID NOT NULL REFERENCES auction_lots(id) ON DELETE CASCADE,
  bidder_id UUID REFERENCES auction_bidders(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  bid_type TEXT NOT NULL DEFAULT 'absentee' CHECK (bid_type IN ('floor', 'phone', 'online', 'absentee')),
  status TEXT NOT NULL DEFAULT 'accepted' CHECK (status IN ('accepted', 'rejected', 'withdrawn')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_auction_bids_org_id ON auction_bids(org_id);
CREATE INDEX idx_auction_bids_lot_id ON auction_bids(lot_id);
CREATE INDEX idx_auction_bids_amount ON auction_bids(amount);

CREATE TABLE IF NOT EXISTS auction_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES auction_sales(id) ON DELETE SET NULL,
  buyer_id UUID REFERENCES auction_bidders(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'paid', 'void', 'overdue')),
  total_amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  issued_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_auction_invoices_org_id ON auction_invoices(org_id);
CREATE INDEX idx_auction_invoices_status ON auction_invoices(status);
CREATE INDEX idx_auction_invoices_buyer_id ON auction_invoices(buyer_id);

CREATE TABLE IF NOT EXISTS auction_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES auction_invoices(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  method TEXT NOT NULL DEFAULT 'wire' CHECK (method IN ('wire', 'card', 'check', 'cash', 'ach')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  provider TEXT,
  provider_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_auction_payments_org_id ON auction_payments(org_id);
CREATE INDEX idx_auction_payments_invoice_id ON auction_payments(invoice_id);
CREATE INDEX idx_auction_payments_status ON auction_payments(status);

-- ============================================================================
-- CATALOG JOBS (Automation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS catalog_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  object_id UUID NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'done', 'failed')),
  attempts INT DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(org_id, object_id)
);

CREATE INDEX IF NOT EXISTS idx_catalog_jobs_org_id ON catalog_jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_catalog_jobs_status ON catalog_jobs(status);
CREATE INDEX IF NOT EXISTS idx_catalog_jobs_next_attempt ON catalog_jobs(next_attempt_at) WHERE status = 'queued';

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get current user's org_id
CREATE OR REPLACE FUNCTION current_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM profiles WHERE user_id = auth.uid()
$$ LANGUAGE SQL STABLE;

-- Function to check if user has role
CREATE OR REPLACE FUNCTION has_role(required_role TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND role = required_role
  )
$$ LANGUAGE SQL STABLE;

-- Function to check if user has minimum role level
CREATE OR REPLACE FUNCTION has_min_role(min_role TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND CASE role
      WHEN 'owner' THEN 4
      WHEN 'admin' THEN 3
      WHEN 'member' THEN 2
      WHEN 'viewer' THEN 1
    END >= CASE min_role
      WHEN 'owner' THEN 4
      WHEN 'admin' THEN 3
      WHEN 'member' THEN 2
      WHEN 'viewer' THEN 1
    END
  )
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp on row update
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_orgs_updated_at BEFORE UPDATE ON orgs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_artist_authority_updated_at BEFORE UPDATE ON artist_authority
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_object_taxonomy_updated_at BEFORE UPDATE ON object_taxonomy
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON objects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_extractions_updated_at BEFORE UPDATE ON ai_extractions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_provenance_events_updated_at BEFORE UPDATE ON provenance_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_auction_consignments_updated_at BEFORE UPDATE ON auction_consignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_auction_sales_updated_at BEFORE UPDATE ON auction_sales
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_auction_lots_updated_at BEFORE UPDATE ON auction_lots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_condition_reports_updated_at BEFORE UPDATE ON condition_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_auction_bidders_updated_at BEFORE UPDATE ON auction_bidders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_auction_invoices_updated_at BEFORE UPDATE ON auction_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_catalog_jobs_updated_at BEFORE UPDATE ON catalog_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INITIAL DATA (Optional)
-- ============================================================================

-- You can add seed data here if needed for testing

-- ============================================================================
-- NOTES
-- ============================================================================
--
-- After running this schema:
-- 1. Apply RLS policies from rls-policies.sql
-- 2. Apply storage policies from storage-policies.sql
-- 3. Create storage bucket "object-docs" if it doesn't exist
-- 4. Enable RLS on all tables
--
-- ============================================================================
