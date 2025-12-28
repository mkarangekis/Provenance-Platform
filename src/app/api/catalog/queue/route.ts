import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * POST /api/catalog/queue
 * Body: { userId: string, objectId?: string, scope?: "org" | "object" }
 */
export async function POST(req: Request) {
  try {
    const { userId, objectId, scope } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
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

    const targetScope = scope || (objectId ? "object" : "org");

    if (targetScope === "object") {
      if (!objectId) {
        return NextResponse.json({ error: "Missing objectId" }, { status: 400 });
      }
      await admin
        .from("catalog_jobs")
        .upsert(
          { org_id: profile.org_id, object_id: objectId, created_by: userId, status: "queued" },
          { onConflict: "org_id,object_id" }
        );
      return NextResponse.json({ ok: true, queued: 1 });
    }

    if (!["admin", "owner"].includes(profile.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { data: objects } = await admin
      .from("objects")
      .select("id")
      .eq("org_id", profile.org_id);

    const rows = (objects || []).map((obj) => ({
      org_id: profile.org_id,
      object_id: obj.id,
      created_by: userId,
      status: "queued",
    }));

    if (rows.length) {
      await admin.from("catalog_jobs").upsert(rows, { onConflict: "org_id,object_id" });
    }

    return NextResponse.json({ ok: true, queued: rows.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
