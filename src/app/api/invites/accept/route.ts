import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AuditActions, ResourceTypes, getRequestMetadata, logAudit } from '@/lib/audit';

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * POST /api/invites/accept - Accept an invite
 */
export async function POST(req: Request) {
  try {
    const { token, userId } = await req.json();

    if (!token || !userId) {
      return NextResponse.json(
        { error: 'Missing token or userId' },
        { status: 400 }
      );
    }

    const admin = getAdmin();

    // Find invite by token
    const { data: invite, error: inviteErr } = await admin
      .from('invites')
      .select('*')
      .eq('token', token)
      .single();

    if (inviteErr || !invite) {
      return NextResponse.json(
        { error: 'Invalid or expired invite' },
        { status: 404 }
      );
    }

    // Check invite status
    if (invite.status !== 'pending') {
      return NextResponse.json(
        { error: `Invite has been ${invite.status}` },
        { status: 400 }
      );
    }

    // Check if expired
    const now = new Date();
    const expiresAt = new Date(invite.expires_at);
    if (now > expiresAt) {
      await admin
        .from('invites')
        .update({ status: 'expired' })
        .eq('id', invite.id);

      return NextResponse.json(
        { error: 'Invite has expired' },
        { status: 400 }
      );
    }

    // Check if user already has an org
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('org_id')
      .eq('user_id', userId)
      .single();

    if (existingProfile?.org_id) {
      return NextResponse.json(
        { error: 'You are already a member of an organization' },
        { status: 409 }
      );
    }

    // Update or create profile
    const { error: profileErr } = await admin.from('profiles').upsert({
      user_id: userId,
      org_id: invite.org_id,
      role: invite.role,
    });

    if (profileErr) {
      return NextResponse.json({ error: profileErr.message }, { status: 500 });
    }

    // Mark invite as accepted
    const { error: updateErr } = await admin
      .from('invites')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', invite.id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    await logAudit({
      orgId: invite.org_id,
      userId,
      action: AuditActions.INVITE_ACCEPTED,
      resourceType: ResourceTypes.INVITE,
      resourceId: invite.id,
      metadata: {
        description: `Accepted invite for ${invite.email}`,
        email: invite.email,
        role: invite.role,
      },
      ...getRequestMetadata(req),
    });

    await logAudit({
      orgId: invite.org_id,
      userId,
      action: AuditActions.MEMBER_JOINED,
      resourceType: ResourceTypes.MEMBER,
      resourceId: userId,
      metadata: {
        description: `Joined organization as ${invite.role}`,
        role: invite.role,
      },
      ...getRequestMetadata(req),
    });

    return NextResponse.json({
      ok: true,
      orgId: invite.org_id,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
