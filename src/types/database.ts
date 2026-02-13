/**
 * Database Types for Registrata
 * Auto-generated type definitions for Supabase tables
 */

// ============================================================================
// ENUMS
// ============================================================================

export type UserRole = 'owner' | 'admin' | 'member' | 'viewer';

export type ObjectStatus = 'intake' | 'processing' | 'review' | 'complete' | 'archived';

export type ExtractionStatus = 'queued' | 'processing' | 'done' | 'failed';

export type ExtractionSource = 'document' | 'manual' | 'bulk';

export type EventStatus = 'pending' | 'approved' | 'rejected';

export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export type AuctionConsignmentStatus = 'intake' | 'review' | 'approved' | 'rejected' | 'consigned';

export type AuctionSaleStatus = 'draft' | 'scheduled' | 'live' | 'closed' | 'settled' | 'canceled';

export type AuctionLotStatus = 'draft' | 'scheduled' | 'sold' | 'passed' | 'withdrawn';

export type AuctionBidStatus = 'accepted' | 'rejected' | 'withdrawn';

export type AuctionBidType = 'floor' | 'phone' | 'online' | 'absentee';

export type AuctionKycStatus = 'pending' | 'verified' | 'failed';

export type AuctionRegistrationStatus = 'pending' | 'approved' | 'denied';

export type AuctionInvoiceStatus = 'draft' | 'issued' | 'paid' | 'void' | 'overdue';

export type AuctionPaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';

export type AuctionPaymentMethod = 'wire' | 'card' | 'check' | 'cash' | 'ach';

// ============================================================================
// DATABASE TABLES
// ============================================================================

export interface Org {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  user_id: string;
  org_id: string | null;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface ProvenanceObject {
  id: string;
  org_id: string;
  created_by: string | null;
  title: string;
  artist: string | null;
  artist_authority_id?: string | null;
  description: string | null;
  status: ObjectStatus;
  metadata: Record<string, unknown>;
  catalog_title?: string | null;
  catalog_year?: string | null;
  catalog_medium?: string | null;
  catalog_dimensions?: string | null;
  catalog_classification?: string | null;
  catalog_culture?: string | null;
  catalog_description?: string | null;
  catalog_keywords?: string[] | null;
  catalog_provenance_summary?: string | null;
  catalog_sources?: Record<string, unknown>[] | null;
  catalog_status?: 'draft' | 'approved';
  catalog_generated_at?: string | null;
  catalog_approved_by?: string | null;
  catalog_approved_at?: string | null;
  workflow_stage?: number | null;
  ai_confidence_score?: number | null;
  ai_risk_score?: number | null;
  ai_completeness_score?: number | null;
  primary_image_url?: string | null;
  estimate_low?: number | null;
  estimate_high?: number | null;
  estimate_currency?: string | null;
  collection_status?: "owned" | "researching" | null;
  collection_label?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ObjectDoc {
  id: string;
  org_id: string;
  object_id: string;
  uploaded_by: string | null;
  storage_path: string;
  doc_type: string;
  file_size_bytes: number | null;
  original_filename: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AIExtraction {
  id: string;
  org_id: string;
  object_id: string;
  doc_id: string | null;
  created_by: string | null;
  status: ExtractionStatus;
  source: ExtractionSource;
  extracted_text: string | null;
  extracted_json: unknown | null;
  error: string | null;
  attempts: number;
  last_attempt_at: string | null;
  next_attempt_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProvenanceEvent {
  id: string;
  org_id: string;
  object_id: string;
  source_extraction_id: string | null;
  event_date: string | null;
  event_type: string;
  description: string;
  parties: string | null;
  location: string | null;
  evidence: string | null;
  status: EventStatus;
  confidence: number | null;
  event_hash: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  role: UserRole;
  invited_by: string | null;
  joined_at: string;
  created_at: string;
}

export interface Invite {
  id: string;
  org_id: string;
  email: string;
  role: UserRole;
  invited_by: string;
  token: string;
  status: InviteStatus;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  org_id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  changes: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface AuctionConsignment {
  id: string;
  org_id: string;
  object_id: string | null;
  created_by: string | null;
  consignor_name: string;
  consignor_email: string | null;
  consignor_phone: string | null;
  status: AuctionConsignmentStatus;
  valuation_status: 'pending' | 'reviewed' | 'approved' | 'rejected';
  valuation_notes: string | null;
  estimate_low: number | null;
  estimate_high: number | null;
  reserve_amount: number | null;
  reserve_approved_by: string | null;
  reserve_approved_at: string | null;
  contract_status: 'pending' | 'sent' | 'signed' | 'declined';
  contract_provider: string | null;
  contract_url: string | null;
  contract_signed_at: string | null;
  intake_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuctionSale {
  id: string;
  org_id: string;
  created_by: string | null;
  name: string;
  sale_date: string | null;
  location: string | null;
  status: AuctionSaleStatus;
  currency: string;
  buyer_premium_rate: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuctionLot {
  id: string;
  org_id: string;
  sale_id: string | null;
  object_id: string | null;
  lot_number: string | null;
  order_index: number | null;
  title_override: string | null;
  estimate_low: number | null;
  estimate_high: number | null;
  reserve_amount: number | null;
  guarantee_amount: number | null;
  hammer_price: number | null;
  status: AuctionLotStatus;
  withdrawal_reason: string | null;
  financing_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuctionBidder {
  id: string;
  org_id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  kyc_status: AuctionKycStatus;
  registration_status: AuctionRegistrationStatus;
  bidding_limit: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuctionBid {
  id: string;
  org_id: string;
  lot_id: string;
  bidder_id: string | null;
  amount: number;
  bid_type: AuctionBidType;
  status: AuctionBidStatus;
  created_at: string;
}

export interface AuctionInvoice {
  id: string;
  org_id: string;
  sale_id: string | null;
  buyer_id: string | null;
  status: AuctionInvoiceStatus;
  total_amount: number;
  currency: string;
  issued_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuctionPayment {
  id: string;
  org_id: string;
  invoice_id: string;
  amount: number;
  method: AuctionPaymentMethod;
  status: AuctionPaymentStatus;
  provider: string | null;
  provider_reference: string | null;
  created_at: string;
}

export interface CatalogJob {
  id: string;
  org_id: string;
  object_id: string;
  created_by: string | null;
  status: 'queued' | 'processing' | 'done' | 'failed';
  attempts: number;
  last_attempt_at: string | null;
  next_attempt_at: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ArtistAuthority {
  id: string;
  name: string;
  birth_year: number | null;
  death_year: number | null;
  nationality: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ObjectTaxonomy {
  id: string;
  label: string;
  category: string | null;
  created_at: string;
  updated_at: string;
}

export interface ObjectTaxonomyMap {
  id: string;
  object_id: string;
  taxonomy_id: string;
  created_at: string;
}

export interface ConditionReport {
  id: string;
  org_id: string;
  lot_id: string;
  created_by: string | null;
  summary: string | null;
  report_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface ObjectImage {
  id: string;
  org_id: string;
  object_id: string;
  storage_path: string;
  image_type: string;
  width: number | null;
  height: number | null;
  file_size: number | null;
  is_primary: boolean;
  ai_description: string | null;
  created_at: string;
}

export interface ResearchQuery {
  id: string;
  org_id: string;
  object_id: string;
  query_type: string | null;
  sources_queried: string[] | null;
  sources_successful: string[] | null;
  sources_failed: string[] | null;
  raw_results: Record<string, unknown> | null;
  processed_results: Record<string, unknown> | null;
  findings_summary: string | null;
  ai_model: string | null;
  ai_tokens_used: number | null;
  ai_processing_time_ms: number | null;
  ai_confidence_score: number | null;
  status: string | null;
  error_message: string | null;
  initiated_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface CatalogEntry {
  id: string;
  org_id: string;
  object_id: string;
  lot_number: string | null;
  title_display: string | null;
  artist_display: string | null;
  date_display: string | null;
  medium_display: string | null;
  dimensions_display: string | null;
  description_short: string | null;
  description_long: string | null;
  provenance_text: string | null;
  exhibition_text: string | null;
  literature_text: string | null;
  condition_summary: string | null;
  estimate_low: number | null;
  estimate_high: number | null;
  estimate_currency: string | null;
  status: string | null;
  ai_generated: boolean;
  ai_model: string | null;
  ai_quality_score: number | null;
  submitted_by: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface Valuation {
  id: string;
  org_id: string;
  object_id: string;
  valuation_type: string | null;
  purpose: string | null;
  value_low: number | null;
  value_mid: number | null;
  value_high: number | null;
  currency: string | null;
  valuation_method: string | null;
  comparable_sales_count: number;
  ai_generated: boolean;
  ai_model: string | null;
  ai_confidence: number | null;
  ai_factors: Record<string, unknown> | null;
  ai_market_analysis: string | null;
  specialist_id: string | null;
  specialist_notes: string | null;
  effective_date: string;
  expiry_date: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarketComparable {
  id: string;
  org_id: string;
  object_id: string | null;
  valuation_id: string | null;
  comparable_title: string | null;
  comparable_artist: string | null;
  sale_date: string | null;
  sale_venue: string | null;
  lot_number: string | null;
  hammer_price: number | null;
  premium_price: number | null;
  currency: string | null;
  similarity_score: number | null;
  similarity_factors: Record<string, unknown> | null;
  source_url: string | null;
  source_type: string | null;
  created_at: string;
}

export interface RiskAssessment {
  id: string;
  org_id: string;
  object_id: string;
  overall_risk_score: number | null;
  provenance_risk_score: number | null;
  authenticity_risk_score: number | null;
  legal_risk_score: number | null;
  market_risk_score: number | null;
  flags: Record<string, unknown>[] | null;
  sensitive_periods: Record<string, unknown>[] | null;
  provenance_gaps: Record<string, unknown>[] | null;
  ai_generated: boolean;
  ai_model: string | null;
  ai_reasoning: string | null;
  ai_recommendations: string[] | null;
  reviewed_by: string | null;
  expert_assessment: string | null;
  final_recommendation: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
}

export interface CRMContact {
  id: string;
  org_id: string;
  type: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  client_tier: string | null;
  relationship_types: string[] | null;
  collecting_interests: string[] | null;
  price_range_low: number | null;
  price_range_high: number | null;
  ai_profile_summary: string | null;
  ai_engagement_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface BuyerMatch {
  id: string;
  org_id: string;
  object_id: string;
  contact_id: string;
  match_score: number | null;
  match_factors: Record<string, unknown> | null;
  ai_reasoning: string | null;
  ai_outreach_suggestion: string | null;
  status: string | null;
  outreach_type: string | null;
  outreach_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarketAlert {
  id: string;
  org_id: string;
  alert_type: string | null;
  priority: string | null;
  title: string;
  description: string | null;
  related_object_id: string | null;
  source_url: string | null;
  source_name: string | null;
  source_date: string | null;
  ai_generated: boolean;
  ai_impact_assessment: string | null;
  ai_relevance_score: number | null;
  status: string | null;
  created_at: string;
}

export interface AIConversation {
  id: string;
  org_id: string;
  user_id: string;
  object_id: string | null;
  title: string | null;
  messages: Record<string, unknown>[];
  context_type: string | null;
  context_data: Record<string, unknown> | null;
  ai_model: string | null;
  total_tokens: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// INSERT TYPES (for creating new records)
// ============================================================================

export type OrgInsert = Omit<Org, 'id' | 'created_at' | 'updated_at'>;

export type ProfileInsert = Omit<Profile, 'created_at' | 'updated_at'>;

export type ProvenanceObjectInsert = Omit<ProvenanceObject, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
};

export type ObjectDocInsert = Omit<ObjectDoc, 'id' | 'created_at'> & {
  id?: string;
};

export type AIExtractionInsert = Omit<AIExtraction, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
};

export type ProvenanceEventInsert = Omit<ProvenanceEvent, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
};

export type OrgMemberInsert = Omit<OrgMember, 'id' | 'joined_at' | 'created_at'> & {
  id?: string;
};

export type InviteInsert = Omit<Invite, 'id' | 'created_at'> & {
  id?: string;
};

export type AuditLogEntryInsert = Omit<AuditLogEntry, 'id' | 'created_at'> & {
  id?: string;
};

export type AuctionConsignmentInsert = Omit<AuctionConsignment, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
};

export type AuctionSaleInsert = Omit<AuctionSale, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
};

export type AuctionLotInsert = Omit<AuctionLot, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
};

export type AuctionBidderInsert = Omit<AuctionBidder, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
};

export type AuctionBidInsert = Omit<AuctionBid, 'id' | 'created_at'> & {
  id?: string;
};

export type AuctionInvoiceInsert = Omit<AuctionInvoice, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
};

export type AuctionPaymentInsert = Omit<AuctionPayment, 'id' | 'created_at'> & {
  id?: string;
};

export type CatalogJobInsert = Omit<CatalogJob, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
};

export type ArtistAuthorityInsert = Omit<ArtistAuthority, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
};

export type ObjectTaxonomyInsert = Omit<ObjectTaxonomy, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
};

export type ObjectTaxonomyMapInsert = Omit<ObjectTaxonomyMap, 'id' | 'created_at'> & {
  id?: string;
};

export type ConditionReportInsert = Omit<ConditionReport, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
};

export type ObjectImageInsert = Omit<ObjectImage, 'id' | 'created_at'> & {
  id?: string;
};

export type ResearchQueryInsert = Omit<ResearchQuery, 'id' | 'created_at'> & {
  id?: string;
};

export type CatalogEntryInsert = Omit<CatalogEntry, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
};

export type ValuationInsert = Omit<Valuation, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
};

export type MarketComparableInsert = Omit<MarketComparable, 'id' | 'created_at'> & {
  id?: string;
};

export type RiskAssessmentInsert = Omit<RiskAssessment, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
};

export type CRMContactInsert = Omit<CRMContact, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
};

export type BuyerMatchInsert = Omit<BuyerMatch, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
};

export type MarketAlertInsert = Omit<MarketAlert, 'id' | 'created_at'> & {
  id?: string;
};

export type AIConversationInsert = Omit<AIConversation, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
};

// ============================================================================
// UPDATE TYPES (for updating existing records)
// ============================================================================

export type OrgUpdate = Partial<Omit<Org, 'id' | 'created_at' | 'updated_at'>>;

export type ProfileUpdate = Partial<Omit<Profile, 'user_id' | 'created_at' | 'updated_at'>>;

export type ProvenanceObjectUpdate = Partial<Omit<ProvenanceObject, 'id' | 'org_id' | 'created_at' | 'updated_at'>>;

export type ObjectDocUpdate = Partial<Omit<ObjectDoc, 'id' | 'org_id' | 'created_at'>>;

export type AIExtractionUpdate = Partial<Omit<AIExtraction, 'id' | 'org_id' | 'created_at' | 'updated_at'>>;

export type ProvenanceEventUpdate = Partial<Omit<ProvenanceEvent, 'id' | 'org_id' | 'created_at' | 'updated_at'>>;

export type OrgMemberUpdate = Partial<Omit<OrgMember, 'id' | 'org_id' | 'user_id' | 'created_at'>>;

export type InviteUpdate = Partial<Omit<Invite, 'id' | 'org_id' | 'created_at'>>;

export type AuctionConsignmentUpdate = Partial<Omit<AuctionConsignment, 'id' | 'org_id' | 'created_at' | 'updated_at'>>;

export type AuctionSaleUpdate = Partial<Omit<AuctionSale, 'id' | 'org_id' | 'created_at' | 'updated_at'>>;

export type AuctionLotUpdate = Partial<Omit<AuctionLot, 'id' | 'org_id' | 'created_at' | 'updated_at'>>;

export type AuctionBidderUpdate = Partial<Omit<AuctionBidder, 'id' | 'org_id' | 'created_at' | 'updated_at'>>;

export type AuctionInvoiceUpdate = Partial<Omit<AuctionInvoice, 'id' | 'org_id' | 'created_at' | 'updated_at'>>;

export type CatalogJobUpdate = Partial<Omit<CatalogJob, 'id' | 'org_id' | 'created_at' | 'updated_at'>>;

export type ArtistAuthorityUpdate = Partial<Omit<ArtistAuthority, 'id' | 'created_at' | 'updated_at'>>;

export type ObjectTaxonomyUpdate = Partial<Omit<ObjectTaxonomy, 'id' | 'created_at' | 'updated_at'>>;

export type ConditionReportUpdate = Partial<Omit<ConditionReport, 'id' | 'org_id' | 'created_at' | 'updated_at'>>;

export type ObjectImageUpdate = Partial<Omit<ObjectImage, 'id' | 'org_id' | 'created_at'>>;

export type ResearchQueryUpdate = Partial<Omit<ResearchQuery, 'id' | 'org_id' | 'created_at'>>;

export type CatalogEntryUpdate = Partial<Omit<CatalogEntry, 'id' | 'org_id' | 'created_at' | 'updated_at'>>;

export type ValuationUpdate = Partial<Omit<Valuation, 'id' | 'org_id' | 'created_at' | 'updated_at'>>;

export type MarketComparableUpdate = Partial<Omit<MarketComparable, 'id' | 'org_id' | 'created_at'>>;

export type RiskAssessmentUpdate = Partial<Omit<RiskAssessment, 'id' | 'org_id' | 'created_at' | 'updated_at'>>;

export type CRMContactUpdate = Partial<Omit<CRMContact, 'id' | 'org_id' | 'created_at' | 'updated_at'>>;

export type BuyerMatchUpdate = Partial<Omit<BuyerMatch, 'id' | 'org_id' | 'created_at' | 'updated_at'>>;

export type MarketAlertUpdate = Partial<Omit<MarketAlert, 'id' | 'org_id' | 'created_at'>>;

export type AIConversationUpdate = Partial<Omit<AIConversation, 'id' | 'org_id' | 'created_at' | 'updated_at'>>;

// ============================================================================
// JOINED TYPES (for queries with relationships)
// ============================================================================

export interface ProvenanceObjectWithCreator extends ProvenanceObject {
  creator?: Profile | null;
}

export interface ProvenanceObjectWithDocs extends ProvenanceObject {
  docs?: ObjectDoc[];
}

export interface ProvenanceEventWithExtraction extends ProvenanceEvent {
  extraction?: AIExtraction | null;
}

export interface AIExtractionWithDoc extends AIExtraction {
  doc?: ObjectDoc | null;
}

export interface OrgMemberWithProfile extends OrgMember {
  profile?: Profile | null;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SortParams {
  field: string;
  direction: 'asc' | 'desc';
}

export interface FilterParams {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in';
  value: unknown;
}
