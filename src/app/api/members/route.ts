import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logAudit, AuditActions, ResourceTypes } from '@/lib/audit';

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * GET /api/members - List members in user's organization
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
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

    // Get all members in org (profiles table already has org members)
    const { data: members, error: membersErr } = await admin
      .from('profiles')
      .select('user_id, full_name, role, created_at')
      .eq('org_id', profile.org_id)
      .order('created_at', { ascending: true });

    if (membersErr) {
      return NextResponse.json({ error: membersErr.message }, { status: 500 });
    }

    // Get email addresses from auth.users (using service role)
    const membersWithEmails = await Promise.all(
      (members || []).map(async (member) => {
        const { data: authUser } = await admin.auth.admin.getUserById(member.user_id);
        return {
          ...member,
          email: authUser.user?.email || 'Unknown',
        };
      })
    );

    return NextResponse.json({ members: membersWithEmails });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/members - Update member role
 */
export async function PATCH(req: Request) {
  try {
    const { memberId, role, userId } = await req.json();

    if (!memberId || !role || !userId) {
      return NextResponse.json(
        { error: 'Missing memberId, role, or userId' },
        { status: 400 }
      );
    }

    // Validate role
    if (!['owner', 'admin', 'member', 'viewer'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const admin = getAdmin();

    // Get requesting user's org and role
    const { data: profile, error: profileErr } = await admin
      .from('profiles')
      .select('org_id, role')
      .eq('user_id', userId)
      .single();

    if (profileErr || !profile?.org_id) {
      return NextResponse.json({ error: 'User has no org' }, { status: 403 });
    }

    // Only admins and owners can change roles
    if (!['admin', 'owner'].includes(profile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get target member
    const { data: targetMember, error: targetErr } = await admin
      .from('profiles')
      .select('org_id, role')
      .eq('user_id', memberId)
      .single();

    if (targetErr || !targetMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Verify same org
    if (targetMember.org_id !== profile.org_id) {
      return NextResponse.json({ error: 'Member not in your org' }, { status: 403 });
    }

    // Prevent changing own role
    if (memberId === userId) {
      return NextResponse.json(
        { error: 'You cannot change your own role' },
        { status: 400 }
      );
    }

    // Prevent non-owners from assigning owner role
    if (role === 'owner' && profile.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only owners can assign the owner role' },
        { status: 403 }
      );
    }

    // Update member role
    const { error: updateErr } = await admin
      .from('profiles')
      .update({ role })
      .eq('user_id', memberId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Log role change
    await logAudit({
      orgId: profile.org_id,
      userId,
      action: AuditActions.MEMBER_ROLE_CHANGED,
      resourceType: ResourceTypes.MEMBER,
      resourceId: memberId,
      changes: {
        before: { role: targetMember.role },
        after: { role },
      },
      metadata: {
        description: `Changed member role from ${targetMember.role} to ${role}`,
        memberId,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/members - Remove member from organization
 */
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const memberId = url.searchParams.get('memberId');
    const userId = url.searchParams.get('userId');

    if (!memberId || !userId) {
      return NextResponse.json(
        { error: 'Missing memberId or userId' },
        { status: 400 }
      );
    }

    const admin = getAdmin();

    // Get requesting user's org and role
    const { data: profile, error: profileErr } = await admin
      .from('profiles')
      .select('org_id, role')
      .eq('user_id', userId)
      .single();

    if (profileErr || !profile?.org_id) {
      return NextResponse.json({ error: 'User has no org' }, { status: 403 });
    }

    // Only admins and owners can remove members
    if (!['admin', 'owner'].includes(profile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get target member
    const { data: targetMember, error: targetErr } = await admin
      .from('profiles')
      .select('org_id, role')
      .eq('user_id', memberId)
      .single();

    if (targetErr || !targetMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Verify same org
    if (targetMember.org_id !== profile.org_id) {
      return NextResponse.json({ error: 'Member not in your org' }, { status: 403 });
    }

    // Prevent removing yourself
    if (memberId === userId) {
      return NextResponse.json(
        { error: 'You cannot remove yourself from the organization' },
        { status: 400 }
      );
    }

    // Prevent removing the last owner
    if (targetMember.role === 'owner') {
      const { count } = await admin
        .from('profiles')
        .select('user_id', { count: 'exact', head: true })
        .eq('org_id', profile.org_id)
        .eq('role', 'owner');

      if (count && count <= 1) {
        return NextResponse.json(
          { error: 'Cannot remove the last owner' },
          { status: 400 }
        );
      }
    }

    // Remove member by setting org_id to null
    const { error: updateErr } = await admin
      .from('profiles')
      .update({ org_id: null })
      .eq('user_id', memberId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Log member removal
    await logAudit({
      orgId: profile.org_id,
      userId,
      action: AuditActions.MEMBER_REMOVED,
      resourceType: ResourceTypes.MEMBER,
      resourceId: memberId,
      metadata: {
        description: `Removed member from organization`,
        memberId,
        memberRole: targetMember.role,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
