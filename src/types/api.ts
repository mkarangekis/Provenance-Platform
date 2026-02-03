/**
 * API Request/Response Types for Registrata
 */

import {
  ProvenanceObject,
  UserRole,
  ObjectStatus,
} from './database';

// ============================================================================
// API RESPONSE WRAPPER
// ============================================================================

export interface ApiResponse<T = unknown> {
  ok?: boolean;
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}

// ============================================================================
// SETUP API
// ============================================================================

export interface SetupRequest {
  orgName: string;
  fullName?: string;
  userId: string;
}

export interface SetupResponse {
  success: boolean;
  orgId: string;
}

// ============================================================================
// UPLOAD API
// ============================================================================

export interface UploadRequest extends FormData {
  file: File;
  objectId: string;
  docType: string;
  userId: string;
}

export interface UploadResponse {
  ok: boolean;
  path: string;
}

// ============================================================================
// DOCUMENT URL API
// ============================================================================

export interface DocUrlRequest {
  docId: string;
  userId: string;
}

export interface DocUrlResponse {
  url: string;
}

// ============================================================================
// AI PROCESSING API
// ============================================================================

export interface AIProcessRequest {
  jobId: string;
}

export interface AIProcessResponse {
  ok: boolean;
  jobId: string;
}

export interface AIQueueRequest {
  objectId: string;
  docId?: string;
  userId: string;
  source?: 'document' | 'manual' | 'bulk';
}

export interface AIQueueResponse {
  ok: boolean;
  jobId: string;
}

// ============================================================================
// BACKGROUND WORKER API (Phase 2)
// ============================================================================

export interface ProcessNextJobResponse {
  ok: boolean;
  processed: boolean;
  jobId?: string;
  message?: string;
}

// ============================================================================
// EVENTS API
// ============================================================================

export interface EventApprovalRequest {
  eventId: string;
  userId: string;
  action: 'approve' | 'reject';
}

export interface EventApprovalResponse {
  ok: boolean;
  eventId: string;
}

export interface EventUpdateRequest {
  eventId: string;
  userId: string;
  updates: {
    event_date?: string;
    event_type?: string;
    description?: string;
    parties?: string;
    location?: string;
    evidence?: string;
  };
}

export interface EventUpdateResponse {
  ok: boolean;
  eventId: string;
}

export interface BulkEventActionRequest {
  eventIds: string[];
  userId: string;
  action: 'approve' | 'reject' | 'delete';
}

export interface BulkEventActionResponse {
  ok: boolean;
  processed: number;
  failed: number;
}

// ============================================================================
// OBJECTS API
// ============================================================================

export interface CreateObjectRequest {
  title: string;
  artist?: string;
  description?: string;
  userId: string;
}

export interface CreateObjectResponse {
  ok: boolean;
  objectId: string;
}

export interface UpdateObjectRequest {
  objectId: string;
  userId: string;
  updates: {
    title?: string;
    artist?: string;
    description?: string;
    status?: ObjectStatus;
  };
}

export interface UpdateObjectResponse {
  ok: boolean;
  objectId: string;
}

export interface ListObjectsRequest {
  userId: string;
  page?: number;
  pageSize?: number;
  search?: string;
  status?: ObjectStatus;
  sortBy?: 'created_at' | 'updated_at' | 'title';
  sortDir?: 'asc' | 'desc';
}

export interface ListObjectsResponse {
  data: ProvenanceObject[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================================================
// INVITES API (Phase 4)
// ============================================================================

export interface CreateInviteRequest {
  email: string;
  role: UserRole;
  userId: string;
}

export interface CreateInviteResponse {
  ok: boolean;
  inviteId: string;
  token: string;
}

export interface AcceptInviteRequest {
  token: string;
  userId: string;
}

export interface AcceptInviteResponse {
  ok: boolean;
  orgId: string;
}

export interface RevokeInviteRequest {
  inviteId: string;
  userId: string;
}

export interface RevokeInviteResponse {
  ok: boolean;
  inviteId: string;
}

// ============================================================================
// ORG MEMBERS API (Phase 4)
// ============================================================================

export interface UpdateMemberRoleRequest {
  memberId: string;
  role: UserRole;
  userId: string;
}

export interface UpdateMemberRoleResponse {
  ok: boolean;
  memberId: string;
}

export interface RemoveMemberRequest {
  memberId: string;
  userId: string;
}

export interface RemoveMemberResponse {
  ok: boolean;
  memberId: string;
}

// ============================================================================
// EXPORT API (Phase 5)
// ============================================================================

export interface ExportObjectRequest {
  objectId: string;
  userId: string;
  format: 'json' | 'csv' | 'pdf';
}

export interface ExportObjectResponse {
  ok: boolean;
  url?: string;
  data?: unknown;
}

// ============================================================================
// HEALTH CHECK API
// ============================================================================

export interface HealthCheckResponse {
  timestamp: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    supabase: { status: 'pass' | 'fail' | 'unknown'; message: string };
    openai: { status: 'pass' | 'fail' | 'unknown'; message: string };
    environment: { status: 'pass' | 'fail' | 'unknown'; message: string };
  };
}

// ============================================================================
// DASHBOARD STATS API
// ============================================================================

export interface DashboardStatsRequest {
  userId: string;
}

export interface DashboardStatsResponse {
  objects: {
    total: number;
    byStatus: Record<ObjectStatus, number>;
  };
  documents: {
    total: number;
  };
  events: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  aiJobs: {
    total: number;
    queued: number;
    processing: number;
    done: number;
    failed: number;
  };
}
