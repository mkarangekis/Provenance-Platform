import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * POST /api/catalog/approve
 * Body: { objectId: string, userId: string }
 */
export async function POST(req: Request) {
  try {
    const { objectId, userId } = await req.json();
    if (!objectId || !userId) {
      return NextResponse.json({ error: "Missing objectId or userId" }, { status: 400 });
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

    if (!["admin", "owner"].includes(profile.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { data: obj, error: objErr } = await admin
      .from("objects")
      .select("org_id")
      .eq("id", objectId)
      .single();

    if (objErr || !obj) {
      return NextResponse.json({ error: "Object not found" }, { status: 404 });
    }

    if (obj.org_id !== profile.org_id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    await admin
      .from("objects")
      .update({
        catalog_status: "approved",
        catalog_approved_by: userId,
        catalog_approved_at: new Date().toISOString(),
      })
      .eq("id", objectId);

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
