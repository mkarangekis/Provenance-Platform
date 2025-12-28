import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Dashboard Statistics API
 * Returns aggregated stats for the user's organization
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const admin = getAdmin();

    // Get user's org_id
    const { data: profile, error: profileErr } = await admin
      .from('profiles')
      .select('org_id')
      .eq('user_id', userId)
      .single();

    if (profileErr || !profile?.org_id) {
      return NextResponse.json({ error: 'User has no org' }, { status: 403 });
    }

    const orgId = profile.org_id;

    // Fetch stats in parallel
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      objectsResult,
      documentsResult,
      eventsResult,
      aiJobsResult,
      aiJobsSevenDaysResult,
    ] = await Promise.all([
      // Objects stats
      admin
        .from('objects')
        .select('status')
        .eq('org_id', orgId),

      // Documents count
      admin
        .from('object_docs')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId),

      // Events stats
      admin
        .from('provenance_events')
        .select('status')
        .eq('org_id', orgId),

      // AI jobs stats
      admin
        .from('ai_extractions')
        .select('status')
        .eq('org_id', orgId),

      // AI jobs in last 7 days
      admin
        .from('ai_extractions')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .gte('created_at', sevenDaysAgo),
    ]);

    // Process objects by status
    const objectsByStatus: Record<string, number> = {};
    (objectsResult.data || []).forEach((obj: { status?: string | null }) => {
      const status = obj.status || 'intake';
      objectsByStatus[status] = (objectsByStatus[status] || 0) + 1;
    });

    // Process events by status
    const eventsByStatus: Record<string, number> = {};
    (eventsResult.data || []).forEach((evt: { status?: string | null }) => {
      const status = evt.status || 'pending';
      eventsByStatus[status] = (eventsByStatus[status] || 0) + 1;
    });

    // Process AI jobs by status
    const jobsByStatus: Record<string, number> = {};
    (aiJobsResult.data || []).forEach((job: { status?: string | null }) => {
      const status = job.status || 'queued';
      jobsByStatus[status] = (jobsByStatus[status] || 0) + 1;
    });

    const stats = {
      objects: {
        total: objectsResult.data?.length || 0,
        byStatus: objectsByStatus,
      },
      documents: {
        total: documentsResult.count || 0,
      },
      events: {
        total: eventsResult.data?.length || 0,
        pending: eventsByStatus.pending || 0,
        approved: eventsByStatus.approved || 0,
        rejected: eventsByStatus.rejected || 0,
      },
      aiJobs: {
        total: aiJobsResult.data?.length || 0,
        queued: jobsByStatus.queued || 0,
        processing: jobsByStatus.processing || 0,
        done: jobsByStatus.done || 0,
        failed: jobsByStatus.failed || 0,
        last7Days: aiJobsSevenDaysResult.count || 0,
      },
    };

    return NextResponse.json(stats);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Dashboard Stats Error]', error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
