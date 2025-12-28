/**
 * Audit Logging Utility
 * Logs user actions for compliance and security
 */

import { createClient } from '@supabase/supabase-js';

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface AuditLogParams {
  orgId: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes?: {
    before?: unknown;
    after?: unknown;
  };
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log an audit event
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
  try {
    const admin = getAdmin();

    await admin.from('audit_log').insert({
      org_id: params.orgId,
      user_id: params.userId,
      action: params.action,
      resource_type: params.resourceType,
      resource_id: params.resourceId,
      changes: params.changes || null,
      metadata: params.metadata || {},
      ip_address: params.ipAddress || null,
      user_agent: params.userAgent || null,
    });
  } catch (error) {
    // Log to console but don't fail the request
    console.error('[Audit Log Error]', error);
  }
}

/**
 * Common audit actions
 */
export const AuditActions = {
  // Object actions
  OBJECT_CREATED: 'object.created',
  OBJECT_UPDATED: 'object.updated',
  OBJECT_DELETED: 'object.deleted',

  // Event actions
  EVENT_CREATED: 'event.created',
  EVENT_APPROVED: 'event.approved',
  EVENT_REJECTED: 'event.rejected',
  EVENT_EDITED: 'event.edited',
  EVENT_DELETED: 'event.deleted',

  // Document actions
  DOCUMENT_UPLOADED: 'document.uploaded',
  DOCUMENT_DOWNLOADED: 'document.downloaded',
  DOCUMENT_DELETED: 'document.deleted',

  // AI actions
  AI_JOB_QUEUED: 'ai.job_queued',
  AI_JOB_PROCESSED: 'ai.job_processed',
  AI_JOB_FAILED: 'ai.job_failed',

  // Member actions
  MEMBER_INVITED: 'member.invited',
  MEMBER_JOINED: 'member.joined',
  MEMBER_REMOVED: 'member.removed',
  MEMBER_ROLE_CHANGED: 'member.role_changed',

  // Invite actions
  INVITE_SENT: 'invite.sent',
  INVITE_ACCEPTED: 'invite.accepted',
  INVITE_REVOKED: 'invite.revoked',
  INVITE_EXPIRED: 'invite.expired',

  // Export actions
  EXPORT_JSON: 'export.json',
  EXPORT_CSV: 'export.csv',
  EXPORT_PDF: 'export.pdf',

  // Org actions
  ORG_CREATED: 'org.created',
  ORG_UPDATED: 'org.updated',
} as const;

/**
 * Resource types
 */
export const ResourceTypes = {
  OBJECT: 'object',
  EVENT: 'provenance_event',
  DOCUMENT: 'object_doc',
  AI_EXTRACTION: 'ai_extraction',
  MEMBER: 'profile',
  INVITE: 'invite',
  ORG: 'org',
} as const;

/**
 * Helper to extract IP and User-Agent from request
 */
export function getRequestMetadata(req: Request) {
  return {
    ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
    userAgent: req.headers.get('user-agent') || undefined,
  };
}

/**
 * Example usage:
 *
 * await logAudit({
 *   orgId: 'org-123',
 *   userId: 'user-456',
 *   action: AuditActions.EVENT_APPROVED,
 *   resourceType: ResourceTypes.EVENT,
 *   resourceId: 'event-789',
 *   changes: {
 *     before: { status: 'pending' },
 *     after: { status: 'approved' },
 *   },
 *   metadata: { confidence: 0.85 },
 *   ...getRequestMetadata(req),
 * });
 */
