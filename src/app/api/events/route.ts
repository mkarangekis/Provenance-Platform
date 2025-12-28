import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AuditActions, ResourceTypes, getRequestMetadata, logAudit } from "@/lib/audit";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type EventAction = "approve" | "reject";

/**
 * POST /api/events
 * Body: { action: "approve" | "reject", eventIds: string[], userId: string }
 */
export async function POST(req: Request) {
  try {
    const { action, eventIds, userId } = await req.json();

    if (!action || !Array.isArray(eventIds) || eventIds.length === 0 || !userId) {
      return NextResponse.json(
        { error: "Missing action, eventIds, or userId" },
        { status: 400 }
      );
    }

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const admin = getAdmin();

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("org_id, role")
      .eq("user_id", userId)
      .single();

    if (profileErr || !profile?.org_id) {
      return NextResponse.json({ error: "User has no org" }, { status: 403 });
    }

    if (profile.role === "viewer") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { data: events, error: eventsErr } = await admin
      .from("provenance_events")
      .select("id, object_id, event_type, status")
      .eq("org_id", profile.org_id)
      .in("id", eventIds);

    if (eventsErr) {
      return NextResponse.json({ error: eventsErr.message }, { status: 500 });
    }

    if (!events?.length) {
      return NextResponse.json({ error: "No events found" }, { status: 404 });
    }

    const newStatus = action === "approve" ? "approved" : "rejected";
    const now = new Date().toISOString();

    const { error: updateErr } = await admin
      .from("provenance_events")
      .update({ status: newStatus, approved_by: userId, approved_at: now })
      .eq("org_id", profile.org_id)
      .in("id", eventIds);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    await Promise.all(
      events.map((event) =>
        logAudit({
          orgId: profile.org_id,
          userId,
          action: action === "approve" ? AuditActions.EVENT_APPROVED : AuditActions.EVENT_REJECTED,
          resourceType: ResourceTypes.EVENT,
          resourceId: event.id,
          changes: {
            before: { status: event.status },
            after: { status: newStatus },
          },
          metadata: {
            description: `${action === "approve" ? "Approved" : "Rejected"} event "${event.event_type}"`,
            objectId: event.object_id,
          },
          ...getRequestMetadata(req),
        })
      )
    );

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
