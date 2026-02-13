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
 * GET /api/export/[objectId]?format=json|csv|pdf|html&mode=public|internal&userId=<id>
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ objectId: string }> }
) {
  try {
    const { objectId } = await context.params;
    const url = new URL(req.url);
    const format = url.searchParams.get('format') || 'json';
    const mode = url.searchParams.get('mode') || 'internal';
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
      .select('id, status, source, created_at, extracted_json')
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

    const latestPipeline = (extractions || []).find((row) => {
      const payload = row.extracted_json as Record<string, unknown> | null;
      return payload?.run_type === 'full_catalog';
    });

    const internalPipeline = latestPipeline
      ? {
          id: latestPipeline.id,
          status: latestPipeline.status,
          created_at: latestPipeline.created_at,
          payload: latestPipeline.extracted_json,
        }
      : null;

    const publicCatalog = (() => {
      const payload = (latestPipeline?.extracted_json || {}) as Record<string, unknown>;
      const stageOutputs = (payload.stage_outputs || {}) as Record<string, Record<string, unknown>>;
      const catalog = stageOutputs.stage_3_catalog || {};
      const valuation = stageOutputs.stage_4_valuation || {};
      const risk = stageOutputs.stage_5_risk || {};
      const buyer = stageOutputs.stage_6_buyer_targeting || {};
      return {
        heading_line: catalog.heading_line || obj.catalog_title || obj.title,
        description: catalog.description || obj.catalog_description || obj.description || '',
        provenance: Array.isArray(catalog.provenance) ? catalog.provenance : [],
        literature: Array.isArray(catalog.literature) ? catalog.literature : [],
        exhibitions: Array.isArray(catalog.exhibitions) ? catalog.exhibitions : [],
        notes: catalog.specialist_remarks || '',
        estimate_low: valuation.estimate_low ?? obj.estimate_low ?? null,
        estimate_high: valuation.estimate_high ?? obj.estimate_high ?? null,
        risk_summary: Array.isArray(risk.flags) ? risk.flags : [],
        buyer_targeting: buyer.matches || buyer.personas || [],
      };
    })();

    const exportData = {
      object: obj,
      documents: docRows,
      events: eventRows,
      extractions: extractions || [],
      pipeline: mode === 'internal' ? internalPipeline : publicCatalog,
      exportedAt: new Date().toISOString(),
      exportedBy: userId,
      mode,
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

      if (mode === 'public') {
        return NextResponse.json(
          {
            object: {
              id: obj.id,
              title: obj.title,
              artist: obj.artist,
              description: obj.description,
              status: obj.status,
            },
            catalog: publicCatalog,
            events: eventRows.map((event) => ({
              event_date: event.event_date,
              event_type: event.event_type,
              description: event.description,
              parties: event.parties,
              location: event.location,
            })),
            exportedAt: new Date().toISOString(),
            exportedBy: userId,
            mode,
          },
          {
            headers: {
              'Content-Disposition': `attachment; filename="provenance-${objectId}.json"`,
            },
          }
        );
      }

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

    // Print-ready HTML export
    if (format === 'html') {
      const catalogProvenance = Array.isArray(publicCatalog.provenance)
        ? publicCatalog.provenance as Array<string | number>
        : [];
      const literature = Array.isArray(publicCatalog.literature)
        ? publicCatalog.literature as Array<string | number>
        : [];
      const exhibitions = Array.isArray(publicCatalog.exhibitions)
        ? publicCatalog.exhibitions as Array<string | number>
        : [];
      const listItems = (rows: Array<string | number>) =>
        rows.length
          ? `<ul>${rows.map((row) => `<li>${String(row)}</li>`).join('')}</ul>`
          : '<p>None recorded.</p>';

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Catalog Export - ${obj.title}</title>
  <style>
    body { font-family: "Times New Roman", serif; max-width: 900px; margin: 30px auto; color: #222; line-height: 1.45; }
    h1, h2 { margin-bottom: 8px; }
    .meta { color: #555; margin-bottom: 20px; font-size: 14px; }
    .section { margin-top: 20px; }
    .muted { color: #666; font-size: 13px; }
    .risk { margin-top: 16px; padding: 10px; border: 1px solid #ddd; background: #fafafa; }
  </style>
</head>
<body>
  <h1>${String(publicCatalog.heading_line || obj.title)}</h1>
  <div class="meta">Generated ${new Date().toLocaleString()} | Mode: ${mode}</div>
  <div class="section">
    <h2>Description</h2>
    <p>${String(publicCatalog.description || '')}</p>
  </div>
  <div class="section">
    <h2>Provenance</h2>
    ${listItems(catalogProvenance)}
  </div>
  <div class="section">
    <h2>Literature</h2>
    ${listItems(literature)}
  </div>
  <div class="section">
    <h2>Exhibitions</h2>
    ${listItems(exhibitions)}
  </div>
  <div class="section">
    <h2>Specialist Notes</h2>
    <p>${String(publicCatalog.notes || 'None')}</p>
  </div>
  <div class="section">
    <h2>Estimate</h2>
    <p>${publicCatalog.estimate_low ?? 'N/A'} - ${publicCatalog.estimate_high ?? 'N/A'} ${obj.estimate_currency || 'USD'}</p>
  </div>
  ${mode === 'internal' ? `<div class="risk"><strong>Internal Risk Notes:</strong> ${Array.isArray(publicCatalog.risk_summary) ? publicCatalog.risk_summary.join(', ') : ''}</div>` : ''}
  <p class="muted">Registrata catalog export</p>
</body>
</html>`;

      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="provenance-${objectId}.html"`,
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
    <p>Registrata - AI-Amplified Art Intelligence</p>
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
