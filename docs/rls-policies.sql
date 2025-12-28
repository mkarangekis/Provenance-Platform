-- ============================================================================
-- PROVENANCE PULSE - ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- Multi-tenant data isolation using Supabase RLS
--
-- IMPORTANT: Run schema.sql BEFORE running this file
-- These policies enforce org_id scoping on all tables
--
-- ============================================================================

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE object_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE provenance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_consignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE condition_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_bidders ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE artist_authority ENABLE ROW LEVEL SECURITY;
ALTER TABLE object_taxonomy ENABLE ROW LEVEL SECURITY;
ALTER TABLE object_taxonomy_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_jobs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ORGANIZATIONS POLICIES
-- ============================================================================

-- Users can view their own organization
CREATE POLICY "Users can view their own org"
  ON orgs FOR SELECT
  USING (id = current_org_id());

-- Users can update their own organization (admin+ only)
CREATE POLICY "Admins can update their org"
  ON orgs FOR UPDATE
  USING (id = current_org_id() AND has_min_role('admin'))
  WITH CHECK (id = current_org_id() AND has_min_role('admin'));

-- Service role has full access (bypasses RLS)
-- No policy needed - service role bypasses RLS by default

-- ============================================================================
-- PROFILES POLICIES
-- ============================================================================

-- Users can view all profiles in their organization
CREATE POLICY "Users can view org profiles"
  ON profiles FOR SELECT
  USING (org_id = current_org_id());

-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (user_id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins can update profiles in their org (except role changes)
CREATE POLICY "Admins can update org profiles"
  ON profiles FOR UPDATE
  USING (org_id = current_org_id() AND has_min_role('admin'))
  WITH CHECK (org_id = current_org_id() AND has_min_role('admin'));

-- ============================================================================
-- OBJECTS POLICIES
-- ============================================================================

-- Users can view objects in their organization
CREATE POLICY "Users can view org objects"
  ON objects FOR SELECT
  USING (org_id = current_org_id());

-- Members can create objects in their organization
CREATE POLICY "Members can create objects"
  ON objects FOR INSERT
  WITH CHECK (org_id = current_org_id() AND has_min_role('member'));

-- Members can update objects in their organization
CREATE POLICY "Members can update objects"
  ON objects FOR UPDATE
  USING (org_id = current_org_id() AND has_min_role('member'))
  WITH CHECK (org_id = current_org_id() AND has_min_role('member'));

-- Admins can delete objects in their organization
CREATE POLICY "Admins can delete objects"
  ON objects FOR DELETE
  USING (org_id = current_org_id() AND has_min_role('admin'));

-- ============================================================================
-- OBJECT DOCUMENTS POLICIES
-- ============================================================================

-- Users can view documents for objects in their organization
CREATE POLICY "Users can view org documents"
  ON object_docs FOR SELECT
  USING (org_id = current_org_id());

-- Members can upload documents to objects in their organization
CREATE POLICY "Members can upload documents"
  ON object_docs FOR INSERT
  WITH CHECK (org_id = current_org_id() AND has_min_role('member'));

-- Members can update documents in their organization
CREATE POLICY "Members can update documents"
  ON object_docs FOR UPDATE
  USING (org_id = current_org_id() AND has_min_role('member'))
  WITH CHECK (org_id = current_org_id() AND has_min_role('member'));

-- Admins can delete documents in their organization
CREATE POLICY "Admins can delete documents"
  ON object_docs FOR DELETE
  USING (org_id = current_org_id() AND has_min_role('admin'));

-- ============================================================================
-- AI EXTRACTIONS POLICIES
-- ============================================================================

-- Users can view AI extractions in their organization
CREATE POLICY "Users can view org extractions"
  ON ai_extractions FOR SELECT
  USING (org_id = current_org_id());

-- Members can create AI extraction jobs in their organization
CREATE POLICY "Members can create extractions"
  ON ai_extractions FOR INSERT
  WITH CHECK (org_id = current_org_id() AND has_min_role('member'));

-- Members can update AI extractions in their organization
CREATE POLICY "Members can update extractions"
  ON ai_extractions FOR UPDATE
  USING (org_id = current_org_id() AND has_min_role('member'))
  WITH CHECK (org_id = current_org_id() AND has_min_role('member'));

-- Admins can delete AI extractions in their organization
CREATE POLICY "Admins can delete extractions"
  ON ai_extractions FOR DELETE
  USING (org_id = current_org_id() AND has_min_role('admin'));

-- ============================================================================
-- PROVENANCE EVENTS POLICIES
-- ============================================================================

-- Users can view provenance events in their organization
CREATE POLICY "Users can view org events"
  ON provenance_events FOR SELECT
  USING (org_id = current_org_id());

-- Members can create provenance events in their organization
CREATE POLICY "Members can create events"
  ON provenance_events FOR INSERT
  WITH CHECK (org_id = current_org_id() AND has_min_role('member'));

-- Members can update events in their organization
-- (But approval requires admin - enforced in application logic)
CREATE POLICY "Members can update events"
  ON provenance_events FOR UPDATE
  USING (org_id = current_org_id() AND has_min_role('member'))
  WITH CHECK (org_id = current_org_id() AND has_min_role('member'));

-- Admins can delete events in their organization
CREATE POLICY "Admins can delete events"
  ON provenance_events FOR DELETE
  USING (org_id = current_org_id() AND has_min_role('admin'));

-- ============================================================================
-- ORG MEMBERS POLICIES (Phase 4)
-- ============================================================================

-- Users can view members in their organization
CREATE POLICY "Users can view org members"
  ON org_members FOR SELECT
  USING (org_id = current_org_id());

-- Admins can add members to their organization
CREATE POLICY "Admins can add org members"
  ON org_members FOR INSERT
  WITH CHECK (org_id = current_org_id() AND has_min_role('admin'));

-- Admins can update member roles in their organization
CREATE POLICY "Admins can update org members"
  ON org_members FOR UPDATE
  USING (org_id = current_org_id() AND has_min_role('admin'))
  WITH CHECK (org_id = current_org_id() AND has_min_role('admin'));

-- Admins can remove members from their organization
CREATE POLICY "Admins can remove org members"
  ON org_members FOR DELETE
  USING (org_id = current_org_id() AND has_min_role('admin'));

-- ============================================================================
-- INVITES POLICIES (Phase 4)
-- ============================================================================

-- Admins can view invites in their organization
CREATE POLICY "Admins can view org invites"
  ON invites FOR SELECT
  USING (org_id = current_org_id() AND has_min_role('admin'));

-- Admins can create invites in their organization
CREATE POLICY "Admins can create invites"
  ON invites FOR INSERT
  WITH CHECK (org_id = current_org_id() AND has_min_role('admin'));

-- Admins can update invites in their organization
CREATE POLICY "Admins can update invites"
  ON invites FOR UPDATE
  USING (org_id = current_org_id() AND has_min_role('admin'))
  WITH CHECK (org_id = current_org_id() AND has_min_role('admin'));

-- Admins can delete invites in their organization
CREATE POLICY "Admins can delete invites"
  ON invites FOR DELETE
  USING (org_id = current_org_id() AND has_min_role('admin'));

-- ============================================================================
-- AUDIT LOG POLICIES (Phase 5)
-- ============================================================================

-- Admins can view audit logs in their organization
CREATE POLICY "Admins can view org audit logs"
  ON audit_log FOR SELECT
  USING (org_id = current_org_id() AND has_min_role('admin'));

-- System can insert audit logs (via service role)
-- No INSERT policy needed - service role bypasses RLS

-- ============================================================================
-- AUCTION WORKFLOW POLICIES
-- ============================================================================

-- Artist authority
CREATE POLICY "Users can view artist authority"
  ON artist_authority FOR SELECT
  USING (has_min_role('viewer'));

CREATE POLICY "Members can manage artist authority"
  ON artist_authority FOR INSERT
  WITH CHECK (has_min_role('member'));

CREATE POLICY "Members can update artist authority"
  ON artist_authority FOR UPDATE
  USING (has_min_role('member'))
  WITH CHECK (has_min_role('member'));

CREATE POLICY "Admins can delete artist authority"
  ON artist_authority FOR DELETE
  USING (has_min_role('admin'));

-- Object taxonomy
CREATE POLICY "Users can view taxonomy"
  ON object_taxonomy FOR SELECT
  USING (has_min_role('viewer'));

CREATE POLICY "Members can manage taxonomy"
  ON object_taxonomy FOR INSERT
  WITH CHECK (has_min_role('member'));

CREATE POLICY "Members can update taxonomy"
  ON object_taxonomy FOR UPDATE
  USING (has_min_role('member'))
  WITH CHECK (has_min_role('member'));

CREATE POLICY "Admins can delete taxonomy"
  ON object_taxonomy FOR DELETE
  USING (has_min_role('admin'));

-- Object taxonomy mapping
CREATE POLICY "Users can view object taxonomy mapping"
  ON object_taxonomy_map FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM objects
    WHERE objects.id = object_taxonomy_map.object_id
    AND objects.org_id = current_org_id()
  ));

CREATE POLICY "Members can manage object taxonomy mapping"
  ON object_taxonomy_map FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM objects
    WHERE objects.id = object_taxonomy_map.object_id
    AND objects.org_id = current_org_id()
    AND has_min_role('member')
  ));

CREATE POLICY "Members can update object taxonomy mapping"
  ON object_taxonomy_map FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM objects
    WHERE objects.id = object_taxonomy_map.object_id
    AND objects.org_id = current_org_id()
    AND has_min_role('member')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM objects
    WHERE objects.id = object_taxonomy_map.object_id
    AND objects.org_id = current_org_id()
    AND has_min_role('member')
  ));

CREATE POLICY "Admins can delete object taxonomy mapping"
  ON object_taxonomy_map FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM objects
    WHERE objects.id = object_taxonomy_map.object_id
    AND objects.org_id = current_org_id()
    AND has_min_role('admin')
  ));

-- Consignments
CREATE POLICY "Users can view org consignments"
  ON auction_consignments FOR SELECT
  USING (org_id = current_org_id());

CREATE POLICY "Members can manage consignments"
  ON auction_consignments FOR INSERT
  WITH CHECK (org_id = current_org_id() AND has_min_role('member'));

CREATE POLICY "Members can update consignments"
  ON auction_consignments FOR UPDATE
  USING (org_id = current_org_id() AND has_min_role('member'))
  WITH CHECK (org_id = current_org_id() AND has_min_role('member'));

CREATE POLICY "Admins can delete consignments"
  ON auction_consignments FOR DELETE
  USING (org_id = current_org_id() AND has_min_role('admin'));

-- Sales
CREATE POLICY "Users can view org sales"
  ON auction_sales FOR SELECT
  USING (org_id = current_org_id());

CREATE POLICY "Admins can manage sales"
  ON auction_sales FOR INSERT
  WITH CHECK (org_id = current_org_id() AND has_min_role('admin'));

CREATE POLICY "Admins can update sales"
  ON auction_sales FOR UPDATE
  USING (org_id = current_org_id() AND has_min_role('admin'))
  WITH CHECK (org_id = current_org_id() AND has_min_role('admin'));

CREATE POLICY "Admins can delete sales"
  ON auction_sales FOR DELETE
  USING (org_id = current_org_id() AND has_min_role('admin'));

-- Lots
CREATE POLICY "Users can view org lots"
  ON auction_lots FOR SELECT
  USING (org_id = current_org_id());

CREATE POLICY "Members can manage lots"
  ON auction_lots FOR INSERT
  WITH CHECK (org_id = current_org_id() AND has_min_role('member'));

CREATE POLICY "Members can update lots"
  ON auction_lots FOR UPDATE
  USING (org_id = current_org_id() AND has_min_role('member'))
  WITH CHECK (org_id = current_org_id() AND has_min_role('member'));

CREATE POLICY "Admins can delete lots"
  ON auction_lots FOR DELETE
  USING (org_id = current_org_id() AND has_min_role('admin'));

-- Condition reports
CREATE POLICY "Users can view condition reports"
  ON condition_reports FOR SELECT
  USING (org_id = current_org_id());

CREATE POLICY "Members can manage condition reports"
  ON condition_reports FOR INSERT
  WITH CHECK (org_id = current_org_id() AND has_min_role('member'));

CREATE POLICY "Members can update condition reports"
  ON condition_reports FOR UPDATE
  USING (org_id = current_org_id() AND has_min_role('member'))
  WITH CHECK (org_id = current_org_id() AND has_min_role('member'));

CREATE POLICY "Admins can delete condition reports"
  ON condition_reports FOR DELETE
  USING (org_id = current_org_id() AND has_min_role('admin'));

-- Bidders
CREATE POLICY "Users can view org bidders"
  ON auction_bidders FOR SELECT
  USING (org_id = current_org_id());

CREATE POLICY "Members can manage bidders"
  ON auction_bidders FOR INSERT
  WITH CHECK (org_id = current_org_id() AND has_min_role('member'));

CREATE POLICY "Members can update bidders"
  ON auction_bidders FOR UPDATE
  USING (org_id = current_org_id() AND has_min_role('member'))
  WITH CHECK (org_id = current_org_id() AND has_min_role('member'));

CREATE POLICY "Admins can delete bidders"
  ON auction_bidders FOR DELETE
  USING (org_id = current_org_id() AND has_min_role('admin'));

-- Bids
CREATE POLICY "Users can view org bids"
  ON auction_bids FOR SELECT
  USING (org_id = current_org_id());

CREATE POLICY "Members can place bids"
  ON auction_bids FOR INSERT
  WITH CHECK (org_id = current_org_id() AND has_min_role('member'));

CREATE POLICY "Admins can update bids"
  ON auction_bids FOR UPDATE
  USING (org_id = current_org_id() AND has_min_role('admin'))
  WITH CHECK (org_id = current_org_id() AND has_min_role('admin'));

CREATE POLICY "Admins can delete bids"
  ON auction_bids FOR DELETE
  USING (org_id = current_org_id() AND has_min_role('admin'));

-- Invoices
CREATE POLICY "Admins can view invoices"
  ON auction_invoices FOR SELECT
  USING (org_id = current_org_id() AND has_min_role('admin'));

CREATE POLICY "Admins can manage invoices"
  ON auction_invoices FOR INSERT
  WITH CHECK (org_id = current_org_id() AND has_min_role('admin'));

CREATE POLICY "Admins can update invoices"
  ON auction_invoices FOR UPDATE
  USING (org_id = current_org_id() AND has_min_role('admin'))
  WITH CHECK (org_id = current_org_id() AND has_min_role('admin'));

CREATE POLICY "Admins can delete invoices"
  ON auction_invoices FOR DELETE
  USING (org_id = current_org_id() AND has_min_role('admin'));

-- Payments
CREATE POLICY "Admins can view payments"
  ON auction_payments FOR SELECT
  USING (org_id = current_org_id() AND has_min_role('admin'));

CREATE POLICY "Admins can manage payments"
  ON auction_payments FOR INSERT
  WITH CHECK (org_id = current_org_id() AND has_min_role('admin'));

CREATE POLICY "Admins can update payments"
  ON auction_payments FOR UPDATE
  USING (org_id = current_org_id() AND has_min_role('admin'))
  WITH CHECK (org_id = current_org_id() AND has_min_role('admin'));

CREATE POLICY "Admins can delete payments"
  ON auction_payments FOR DELETE
  USING (org_id = current_org_id() AND has_min_role('admin'));

-- Catalog jobs
CREATE POLICY "Users can view catalog jobs"
  ON catalog_jobs FOR SELECT
  USING (org_id = current_org_id());

CREATE POLICY "Members can manage catalog jobs"
  ON catalog_jobs FOR INSERT
  WITH CHECK (org_id = current_org_id() AND has_min_role('member'));

CREATE POLICY "Members can update catalog jobs"
  ON catalog_jobs FOR UPDATE
  USING (org_id = current_org_id() AND has_min_role('member'))
  WITH CHECK (org_id = current_org_id() AND has_min_role('member'));

CREATE POLICY "Admins can delete catalog jobs"
  ON catalog_jobs FOR DELETE
  USING (org_id = current_org_id() AND has_min_role('admin'));

-- ============================================================================
-- TESTING RLS POLICIES
-- ============================================================================
--
-- To test RLS policies, create test users and organizations:
--
-- 1. Sign up two test users in Supabase Auth
-- 2. Create two orgs and assign each user to a different org
-- 3. Try to query objects from user A while authenticated as user B
-- 4. Verify that no cross-org data is returned
--
-- Example test queries (run as authenticated user):
--
-- SELECT * FROM objects; -- Should only return objects for current user's org
-- SELECT * FROM provenance_events WHERE org_id != current_org_id(); -- Should return 0 rows
--
-- ============================================================================
-- NOTES
-- ============================================================================
--
-- RLS is your primary security mechanism for multi-tenancy
-- Always test policies thoroughly before going to production
--
-- Service role key BYPASSES all RLS policies
-- Only use service role in trusted server-side code
-- NEVER expose service role key to client
--
-- Helper functions used:
-- - current_org_id() - Returns current user's org_id from profiles
-- - has_role(role) - Checks if user has exact role
-- - has_min_role(role) - Checks if user has at least the specified role level
--
-- ============================================================================
