import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { logAudit, AuditActions, ResourceTypes } from '@/lib/audit';

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * GET /api/invites - List invites for user's organization
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const admin = getAdmin();

    // Get user's org and role
    const { data: profile, error: profileErr } = await admin
      .from('profiles')
      .select('org_id, role')
      .eq('user_id', userId)
      .single();

    if (profileErr || !profile?.org_id) {
      return NextResponse.json({ error: 'User has no org' }, { status: 403 });
    }

    // Only admins and owners can view invites
    if (!['admin', 'owner'].includes(profile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get invites for org
    const { data: invites, error: invitesErr } = await admin
      .from('invites')
      .select('*')
      .eq('org_id', profile.org_id)
      .order('created_at', { ascending: false });

    if (invitesErr) {
      return NextResponse.json({ error: invitesErr.message }, { status: 500 });
    }

    return NextResponse.json({ invites });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/invites - Create new invite
 */
export async function POST(req: Request) {
  try {
    const { email, role, userId } = await req.json();

    if (!email || !role || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: email, role, userId' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Validate role
    if (!['admin', 'member', 'viewer'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const admin = getAdmin();

    // Get user's org and role
    const { data: profile, error: profileErr } = await admin
      .from('profiles')
      .select('org_id, role')
      .eq('user_id', userId)
      .single();

    if (profileErr || !profile?.org_id) {
      return NextResponse.json({ error: 'User has no org' }, { status: 403 });
    }

    // Only admins and owners can invite
    if (!['admin', 'owner'].includes(profile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Check if user is already in org
    const { data: existingMember } = await admin
      .from('profiles')
      .select('user_id')
      .eq('org_id', profile.org_id)
      .ilike('email', email)
      .maybeSingle();

    if (existingMember) {
      return NextResponse.json(
        { error: 'User is already a member of this organization' },
        { status: 409 }
      );
    }

    // Check if there's already a pending invite
    const { data: existingInvite } = await admin
      .from('invites')
      .select('id')
      .eq('org_id', profile.org_id)
      .eq('email', email)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingInvite) {
      return NextResponse.json(
        { error: 'An invite has already been sent to this email' },
        { status: 409 }
      );
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');

    // Create invite (expires in 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data: invite, error: inviteErr } = await admin
      .from('invites')
      .insert({
        org_id: profile.org_id,
        email,
        role,
        invited_by: userId,
        token,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (inviteErr) {
      return NextResponse.json({ error: inviteErr.message }, { status: 500 });
    }

    // Log invite creation
    await logAudit({
      orgId: profile.org_id,
      userId,
      action: AuditActions.MEMBER_INVITED,
      resourceType: ResourceTypes.INVITE,
      resourceId: invite.id,
      metadata: {
        description: `Invited ${email} as ${role}`,
        email,
        role,
      },
    });

    // Optional: send email with invite link
    // const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/invites/accept?token=${token}`;

    return NextResponse.json({
      ok: true,
      invite,
      inviteLink: `/invites/accept?token=${token}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/invites?inviteId=<id>&userId=<id> - Revoke invite
 */
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const inviteId = url.searchParams.get('inviteId');
    const userId = url.searchParams.get('userId');

    if (!inviteId || !userId) {
      return NextResponse.json(
        { error: 'Missing inviteId or userId' },
        { status: 400 }
      );
    }

    const admin = getAdmin();

    // Get user's org and role
    const { data: profile, error: profileErr } = await admin
      .from('profiles')
      .select('org_id, role')
      .eq('user_id', userId)
      .single();

    if (profileErr || !profile?.org_id) {
      return NextResponse.json({ error: 'User has no org' }, { status: 403 });
    }

    // Only admins and owners can revoke invites
    if (!['admin', 'owner'].includes(profile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Update invite status
    const { data: invite, error: updateErr } = await admin
      .from('invites')
      .update({ status: 'revoked' })
      .eq('id', inviteId)
      .eq('org_id', profile.org_id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    if (invite) {
      await logAudit({
        orgId: profile.org_id,
        userId,
        action: AuditActions.INVITE_REVOKED,
        resourceType: ResourceTypes.INVITE,
        resourceId: invite.id,
        metadata: {
          description: `Revoked invite for ${invite.email}`,
          email: invite.email,
          role: invite.role,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
