-- Registrata Initial Schema + Extensions
-- Safe to run multiple times in Supabase

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";
create extension if not exists "vector";

-- Enums
create type if not exists user_role as enum ('owner', 'admin', 'member', 'viewer');
create type if not exists object_status as enum ('intake', 'processing', 'review', 'complete', 'archived');
create type if not exists extraction_status as enum ('queued', 'processing', 'done', 'failed');
create type if not exists extraction_source as enum ('document', 'manual', 'bulk');
create type if not exists event_status as enum ('pending', 'approved', 'rejected');
create type if not exists catalog_job_status as enum ('queued', 'processing', 'done', 'failed');

-- Core org + profiles
create table if not exists orgs (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid references orgs(id),
  full_name text,
  role user_role default 'member',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists org_members (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references orgs(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role user_role default 'member',
  invited_by uuid,
  joined_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists invites (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references orgs(id) on delete cascade,
  email text not null,
  role user_role default 'member',
  invited_by uuid,
  token text not null,
  status text default 'pending',
  expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz default now()
);

-- Core objects
create table if not exists objects (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references orgs(id) on delete cascade,
  created_by uuid references auth.users(id),
  title text not null,
  artist text,
  artist_authority_id uuid,
  description text,
  status object_status default 'intake',
  metadata jsonb default '{}'::jsonb,
  catalog_title text,
  catalog_year text,
  catalog_medium text,
  catalog_dimensions text,
  catalog_classification text,
  catalog_culture text,
  catalog_description text,
  catalog_keywords text[] default '{}'::text[],
  catalog_provenance_summary text,
  catalog_sources jsonb[] default '{}'::jsonb[],
  catalog_status text default 'draft',
  catalog_generated_at timestamptz,
  catalog_approved_by uuid,
  catalog_approved_at timestamptz,
  workflow_stage integer default 1,
  ai_confidence_score numeric,
  ai_risk_score numeric,
  ai_completeness_score numeric,
  primary_image_url text,
  estimate_low numeric,
  estimate_high numeric,
  estimate_currency text default 'USD',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists object_images (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references orgs(id) on delete cascade,
  object_id uuid references objects(id) on delete cascade,
  storage_path text not null,
  image_type text default 'main',
  width integer,
  height integer,
  file_size integer,
  is_primary boolean default false,
  ai_description text,
  created_at timestamptz default now()
);

create table if not exists object_docs (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references orgs(id) on delete cascade,
  object_id uuid references objects(id) on delete cascade,
  uploaded_by uuid references auth.users(id),
  storage_path text not null,
  doc_type text,
  file_size_bytes integer,
  original_filename text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create or replace function update_object_primary_image()
returns trigger as $$
begin
  if new.is_primary = true then
    update object_images
    set is_primary = false
    where object_id = new.object_id and id <> new.id and is_primary = true;

    update objects
    set primary_image_url = new.storage_path
    where id = new.object_id;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trigger_update_primary_image
  after insert or update of is_primary on object_images
  for each row execute function update_object_primary_image();

create table if not exists ai_extractions (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references orgs(id) on delete cascade,
  object_id uuid references objects(id) on delete cascade,
  doc_id uuid references object_docs(id) on delete set null,
  created_by uuid references auth.users(id),
  status extraction_status default 'queued',
  source extraction_source default 'document',
  extracted_text text,
  extracted_json jsonb,
  error text,
  attempts integer default 0,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists provenance_events (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references orgs(id) on delete cascade,
  object_id uuid references objects(id) on delete cascade,
  source_extraction_id uuid references ai_extractions(id) on delete set null,
  event_date text,
  event_type text not null,
  description text not null,
  parties text,
  location text,
  evidence text,
  status event_status default 'pending',
  confidence numeric,
  event_hash text,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(object_id, event_hash)
);

create table if not exists audit_log (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references orgs(id) on delete cascade,
  user_id uuid,
  action text not null,
  resource_type text not null,
  resource_id text not null,
  changes jsonb,
  metadata jsonb default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz default now()
);

-- Auctions + sales
create table if not exists auction_consignments (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references orgs(id) on delete cascade,
  object_id uuid references objects(id),
  created_by uuid references auth.users(id),
  consignor_name text not null,
  consignor_email text,
  consignor_phone text,
  status text default 'intake',
  valuation_status text default 'pending',
  valuation_notes text,
  estimate_low numeric,
  estimate_high numeric,
  reserve_amount numeric,
  reserve_approved_by uuid,
  reserve_approved_at timestamptz,
  contract_status text default 'pending',
  contract_provider text,
  contract_url text,
  contract_signed_at timestamptz,
  intake_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists auction_sales (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references orgs(id) on delete cascade,
  created_by uuid references auth.users(id),
  name text not null,
  sale_date date,
  location text,
  status text default 'draft',
  currency text default 'USD',
  buyer_premium_rate numeric,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists auction_lots (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references orgs(id) on delete cascade,
  sale_id uuid references auction_sales(id),
  object_id uuid references objects(id),
  lot_number text,
  order_index integer,
  title_override text,
  estimate_low numeric,
  estimate_high numeric,
  reserve_amount numeric,
  guarantee_amount numeric,
  hammer_price numeric,
  status text default 'draft',
  withdrawal_reason text,
  financing_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists auction_bidders (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references orgs(id) on delete cascade,
  user_id uuid,
  name text not null,
  email text,
  phone text,
  kyc_status text default 'pending',
  registration_status text default 'pending',
  bidding_limit numeric,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists auction_bids (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references orgs(id) on delete cascade,
  lot_id uuid references auction_lots(id) on delete cascade,
  bidder_id uuid references auction_bidders(id),
  amount numeric not null,
  bid_type text default 'online',
  status text default 'accepted',
  created_at timestamptz default now()
);

create table if not exists auction_invoices (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references orgs(id) on delete cascade,
  sale_id uuid references auction_sales(id),
  buyer_id uuid references auction_bidders(id),
  status text default 'draft',
  total_amount numeric default 0,
  currency text default 'USD',
  issued_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists auction_payments (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references orgs(id) on delete cascade,
  invoice_id uuid references auction_invoices(id) on delete cascade,
  amount numeric not null,
  method text default 'wire',
  status text default 'pending',
  provider text,
  provider_reference text,
  created_at timestamptz default now()
);

-- Catalog jobs
create table if not exists catalog_jobs (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references orgs(id) on delete cascade,
  object_id uuid references objects(id) on delete cascade,
  created_by uuid references auth.users(id),
  status catalog_job_status default 'queued',
  attempts integer default 0,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Registrata extensions
create table if not exists research_queries (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references orgs(id) on delete cascade,
  object_id uuid references objects(id) on delete cascade,
  query_type text,
  sources_queried text[] default '{}'::text[],
  sources_successful text[] default '{}'::text[],
  sources_failed text[] default '{}'::text[],
  raw_results jsonb,
  processed_results jsonb,
  findings_summary text,
  ai_model text,
  ai_tokens_used integer,
  ai_processing_time_ms integer,
  ai_confidence_score numeric,
  status text default 'pending',
  error_message text,
  initiated_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  completed_at timestamptz
);

create table if not exists catalog_entries (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references orgs(id) on delete cascade,
  object_id uuid references objects(id) on delete cascade,
  lot_number text,
  title_display text,
  artist_display text,
  date_display text,
  medium_display text,
  dimensions_display text,
  description_short text,
  description_long text,
  provenance_text text,
  exhibition_text text,
  literature_text text,
  condition_summary text,
  estimate_low numeric,
  estimate_high numeric,
  estimate_currency text default 'USD',
  status text default 'draft',
  ai_generated boolean default false,
  ai_model text,
  ai_quality_score numeric,
  submitted_by uuid,
  submitted_at timestamptz,
  reviewed_by uuid,
  reviewed_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  version integer default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists valuations (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references orgs(id) on delete cascade,
  object_id uuid references objects(id) on delete cascade,
  valuation_type text,
  purpose text,
  value_low numeric,
  value_mid numeric,
  value_high numeric,
  currency text default 'USD',
  valuation_method text,
  comparable_sales_count integer default 0,
  ai_generated boolean default false,
  ai_model text,
  ai_confidence numeric,
  ai_factors jsonb default '{}'::jsonb,
  ai_market_analysis text,
  specialist_id uuid,
  specialist_notes text,
  effective_date date default current_date,
  expiry_date date,
  status text default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists market_comparables (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references orgs(id) on delete cascade,
  object_id uuid references objects(id),
  valuation_id uuid references valuations(id) on delete cascade,
  comparable_title text,
  comparable_artist text,
  sale_date date,
  sale_venue text,
  lot_number text,
  hammer_price numeric,
  premium_price numeric,
  currency text,
  similarity_score numeric,
  similarity_factors jsonb default '{}'::jsonb,
  source_url text,
  source_type text,
  created_at timestamptz default now()
);

create table if not exists risk_assessments (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references orgs(id) on delete cascade,
  object_id uuid references objects(id) on delete cascade,
  overall_risk_score numeric,
  provenance_risk_score numeric,
  authenticity_risk_score numeric,
  legal_risk_score numeric,
  market_risk_score numeric,
  flags jsonb default '[]'::jsonb,
  sensitive_periods jsonb default '[]'::jsonb,
  provenance_gaps jsonb default '[]'::jsonb,
  ai_generated boolean default false,
  ai_model text,
  ai_reasoning text,
  ai_recommendations text[] default '{}'::text[],
  reviewed_by uuid,
  expert_assessment text,
  final_recommendation text,
  status text default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists crm_contacts (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references orgs(id) on delete cascade,
  type text,
  first_name text,
  last_name text,
  company text,
  job_title text,
  email text,
  phone text,
  city text,
  state text,
  country text,
  client_tier text default 'standard',
  relationship_types text[] default '{}'::text[],
  collecting_interests text[] default '{}'::text[],
  price_range_low numeric,
  price_range_high numeric,
  ai_profile_summary text,
  ai_engagement_score numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists buyer_matches (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references orgs(id) on delete cascade,
  object_id uuid references objects(id) on delete cascade,
  contact_id uuid references crm_contacts(id) on delete cascade,
  match_score numeric,
  match_factors jsonb default '{}'::jsonb,
  ai_reasoning text,
  ai_outreach_suggestion text,
  status text default 'suggested',
  outreach_type text,
  outreach_date timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(object_id, contact_id)
);

create table if not exists market_alerts (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references orgs(id) on delete cascade,
  alert_type text,
  priority text default 'normal',
  title text not null,
  description text,
  related_object_id uuid references objects(id),
  source_url text,
  source_name text,
  source_date timestamptz,
  ai_generated boolean default false,
  ai_impact_assessment text,
  ai_relevance_score numeric,
  status text default 'unread',
  created_at timestamptz default now()
);

create table if not exists ai_conversations (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references orgs(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  object_id uuid references objects(id),
  title text,
  messages jsonb default '[]'::jsonb,
  context_type text,
  context_data jsonb default '{}'::jsonb,
  ai_model text,
  total_tokens integer default 0,
  is_archived boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Updated-at trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_orgs_updated_at before update on orgs
for each row execute function update_updated_at();

create trigger update_profiles_updated_at before update on profiles
for each row execute function update_updated_at();

create trigger update_objects_updated_at before update on objects
for each row execute function update_updated_at();

create trigger update_ai_extractions_updated_at before update on ai_extractions
for each row execute function update_updated_at();

create trigger update_catalog_jobs_updated_at before update on catalog_jobs
for each row execute function update_updated_at();

create trigger update_catalog_entries_updated_at before update on catalog_entries
for each row execute function update_updated_at();

create trigger update_valuations_updated_at before update on valuations
for each row execute function update_updated_at();

create trigger update_risk_updated_at before update on risk_assessments
for each row execute function update_updated_at();

create trigger update_crm_contacts_updated_at before update on crm_contacts
for each row execute function update_updated_at();

create trigger update_ai_conversations_updated_at before update on ai_conversations
for each row execute function update_updated_at();

-- RLS
alter table orgs enable row level security;
alter table profiles enable row level security;
alter table objects enable row level security;
alter table object_docs enable row level security;
alter table ai_extractions enable row level security;
alter table provenance_events enable row level security;
alter table auction_consignments enable row level security;
alter table auction_sales enable row level security;
alter table auction_lots enable row level security;
alter table auction_bidders enable row level security;
alter table auction_bids enable row level security;
alter table auction_invoices enable row level security;
alter table auction_payments enable row level security;
alter table catalog_jobs enable row level security;
alter table catalog_entries enable row level security;
alter table valuations enable row level security;
alter table market_comparables enable row level security;
alter table risk_assessments enable row level security;
alter table crm_contacts enable row level security;
alter table buyer_matches enable row level security;
alter table market_alerts enable row level security;
alter table ai_conversations enable row level security;

create or replace function get_user_org_id()
returns uuid as $$
  select org_id from profiles where user_id = auth.uid()
$$ language sql security definer;

create policy "orgs_select" on orgs for select using (id = get_user_org_id());
create policy "profiles_select" on profiles for select using (user_id = auth.uid() or org_id = get_user_org_id());
create policy "profiles_update" on profiles for update using (user_id = auth.uid());

create policy "objects_org" on objects for all using (org_id = get_user_org_id()) with check (org_id = get_user_org_id());
create policy "object_docs_org" on object_docs for all using (org_id = get_user_org_id()) with check (org_id = get_user_org_id());
create policy "ai_extractions_org" on ai_extractions for all using (org_id = get_user_org_id()) with check (org_id = get_user_org_id());
create policy "provenance_events_org" on provenance_events for all using (org_id = get_user_org_id()) with check (org_id = get_user_org_id());
create policy "catalog_jobs_org" on catalog_jobs for all using (org_id = get_user_org_id()) with check (org_id = get_user_org_id());
create policy "catalog_entries_org" on catalog_entries for all using (org_id = get_user_org_id()) with check (org_id = get_user_org_id());
create policy "valuations_org" on valuations for all using (org_id = get_user_org_id()) with check (org_id = get_user_org_id());
create policy "market_comparables_org" on market_comparables for all using (org_id = get_user_org_id()) with check (org_id = get_user_org_id());
create policy "risk_assessments_org" on risk_assessments for all using (org_id = get_user_org_id()) with check (org_id = get_user_org_id());
create policy "crm_contacts_org" on crm_contacts for all using (org_id = get_user_org_id()) with check (org_id = get_user_org_id());
create policy "buyer_matches_org" on buyer_matches for all using (org_id = get_user_org_id()) with check (org_id = get_user_org_id());
create policy "market_alerts_org" on market_alerts for all using (org_id = get_user_org_id()) with check (org_id = get_user_org_id());
create policy "ai_conversations_org" on ai_conversations for all using (org_id = get_user_org_id()) with check (org_id = get_user_org_id());

create policy "auction_consignments_org" on auction_consignments for all using (org_id = get_user_org_id()) with check (org_id = get_user_org_id());
create policy "auction_sales_org" on auction_sales for all using (org_id = get_user_org_id()) with check (org_id = get_user_org_id());
create policy "auction_lots_org" on auction_lots for all using (org_id = get_user_org_id()) with check (org_id = get_user_org_id());
create policy "auction_bidders_org" on auction_bidders for all using (org_id = get_user_org_id()) with check (org_id = get_user_org_id());
create policy "auction_bids_org" on auction_bids for all using (org_id = get_user_org_id()) with check (org_id = get_user_org_id());
create policy "auction_invoices_org" on auction_invoices for all using (org_id = get_user_org_id()) with check (org_id = get_user_org_id());
create policy "auction_payments_org" on auction_payments for all using (org_id = get_user_org_id()) with check (org_id = get_user_org_id());

