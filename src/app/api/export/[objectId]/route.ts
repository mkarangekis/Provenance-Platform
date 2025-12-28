import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logAudit, AuditActions, ResourceTypes } from '@/lib/audit';

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * GET /api/export/[objectId]?format=json|csv|pdf&userId=<id>
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ objectId: string }> }
) {
  try {
    const { objectId } = await context.params;
    const url = new URL(req.url);
    const format = url.searchParams.get('format') || 'json';
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const admin = getAdmin();

    // Get user's org
    const { data: profile, error: profileErr } = await admin
      .from('profiles')
      .select('org_id')
      .eq('user_id', userId)
      .single();

    if (profileErr || !profile?.org_id) {
      return NextResponse.json({ error: 'User has no org' }, { status: 403 });
    }

    // Get object
    const { data: obj, error: objErr } = await admin
      .from('objects')
      .select('*')
      .eq('id', objectId)
      .single();

    if (objErr || !obj) {
      return NextResponse.json({ error: 'Object not found' }, { status: 404 });
    }

    // Verify org ownership
    if (obj.org_id !== profile.org_id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Get documents
    const { data: docs } = await admin
      .from('object_docs')
      .select('*')
      .eq('object_id', objectId)
      .order('created_at', { ascending: true });

    // Get approved events only
    const { data: events } = await admin
      .from('provenance_events')
      .select('*')
      .eq('object_id', objectId)
      .eq('status', 'approved')
      .order('event_date', { ascending: true });

    // Get AI extractions
    const { data: extractions } = await admin
      .from('ai_extractions')
      .select('id, status, source, created_at')
      .eq('object_id', objectId)
      .order('created_at', { ascending: false });

    type ExportEvent = {
      event_date?: string | null;
      event_type?: string | null;
      description?: string | null;
      parties?: string | null;
      location?: string | null;
      evidence?: string | null;
      confidence?: number | null;
    };

    type ExportDoc = {
      storage_path: string;
      doc_type: string;
      created_at: string;
    };

    const eventRows = (events || []) as ExportEvent[];
    const docRows = (docs || []) as ExportDoc[];

    const exportData = {
      object: obj,
      documents: docRows,
      events: eventRows,
      extractions: extractions || [],
      exportedAt: new Date().toISOString(),
      exportedBy: userId,
    };

    // JSON Export
    if (format === 'json') {
      await logAudit({
        orgId: profile.org_id,
        userId,
        action: AuditActions.EXPORT_JSON,
        resourceType: ResourceTypes.OBJECT,
        resourceId: objectId,
        metadata: {
          description: `Exported object "${obj.title}" as JSON`,
          format: 'json',
          objectTitle: obj.title,
        },
      });

      return NextResponse.json(exportData, {
        headers: {
          'Content-Disposition': `attachment; filename="provenance-${objectId}.json"`,
        },
      });
    }

    // CSV Export
    if (format === 'csv') {
      await logAudit({
        orgId: profile.org_id,
        userId,
        action: AuditActions.EXPORT_CSV,
        resourceType: ResourceTypes.OBJECT,
        resourceId: objectId,
        metadata: {
          description: `Exported object "${obj.title}" as CSV`,
          format: 'csv',
          objectTitle: obj.title,
        },
      });

      const csvRows = [
        ['Event Date', 'Event Type', 'Description', 'Parties', 'Location', 'Evidence', 'Confidence'],
        ...eventRows.map((e) => [
          e.event_date || '',
          e.event_type || '',
          e.description || '',
          e.parties || '',
          e.location || '',
          e.evidence || '',
          e.confidence ? `${Math.round(e.confidence * 100)}%` : '',
        ]),
      ];

      const csv = csvRows.map(row =>
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ).join('\n');

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="provenance-${objectId}.csv"`,
        },
      });
    }

    // PDF Export
    if (format === 'pdf') {
      await logAudit({
        orgId: profile.org_id,
        userId,
        action: AuditActions.EXPORT_PDF,
        resourceType: ResourceTypes.OBJECT,
        resourceId: objectId,
        metadata: {
          description: `Exported object "${obj.title}" as PDF`,
          format: 'pdf',
          objectTitle: obj.title,
        },
      });

      // Generate simple HTML for PDF
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Provenance Report - ${obj.title}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      color: #333;
    }
    h1 { color: #2563eb; margin-bottom: 10px; }
    h2 { color: #1f2937; margin-top: 30px; margin-bottom: 15px; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px; }
    .metadata { background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .metadata-item { margin: 8px 0; }
    .label { font-weight: bold; color: #6b7280; }
    .event { margin: 20px 0; padding: 15px; border-left: 4px solid #3b82f6; background: #f9fafb; }
    .event-date { font-weight: bold; color: #1f2937; }
    .event-type { display: inline-block; background: #dbeafe; color: #1e40af; padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-left: 10px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <h1>Provenance Report</h1>
  <div class="metadata">
    <div class="metadata-item"><span class="label">Object:</span> ${obj.title}</div>
    ${obj.artist ? `<div class="metadata-item"><span class="label">Artist:</span> ${obj.artist}</div>` : ''}
    ${obj.description ? `<div class="metadata-item"><span class="label">Description:</span> ${obj.description}</div>` : ''}
    <div class="metadata-item"><span class="label">Status:</span> ${obj.status}</div>
    <div class="metadata-item"><span class="label">Created:</span> ${new Date(obj.created_at).toLocaleDateString()}</div>
  </div>

  <h2>Provenance Timeline (${eventRows.length} Events)</h2>
  ${eventRows.length === 0 ? '<p>No approved provenance events.</p>' : ''}
  ${eventRows.map((e) => `
    <div class="event">
      <div>
        <span class="event-date">${e.event_date || 'Date unknown'}</span>
        <span class="event-type">${e.event_type}</span>
      </div>
      <p><strong>Description:</strong> ${e.description}</p>
      ${e.parties ? `<p><strong>Parties:</strong> ${e.parties}</p>` : ''}
      ${e.location ? `<p><strong>Location:</strong> ${e.location}</p>` : ''}
      ${e.evidence ? `<p><strong>Evidence:</strong> ${e.evidence}</p>` : ''}
      ${e.confidence ? `<p><strong>Confidence:</strong> ${Math.round(e.confidence * 100)}%</p>` : ''}
    </div>
  `).join('')}

  <h2>Documents (${docRows.length})</h2>
  ${docRows.length === 0 ? '<p>No documents uploaded.</p>' : ''}
  <ul>
    ${docRows.map((d) => `
      <li>${d.storage_path.split('/').pop()} - ${d.doc_type.toUpperCase()} (Uploaded ${new Date(d.created_at).toLocaleDateString()})</li>
    `).join('')}
  </ul>

  <div class="footer">
    <p>Report generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
    <p>Provenance Pulse - AI-Powered Provenance Tracking</p>
  </div>
</body>
</html>
      `;

      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="provenance-${objectId}.html"`,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Export Error]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
