import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type CreateObjectPayload = {
  userId?: string;
  title?: string;
  artist?: string | null;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateObjectPayload;
    const userId = body.userId?.trim();
    const title = body.title?.trim();
    const artist = body.artist?.trim() || null;

    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    if (!title) return NextResponse.json({ error: "Missing title" }, { status: 400 });

    const admin = getAdmin();

    const { data: prof, error: profErr } = await admin
      .from("profiles")
      .select("org_id")
      .eq("user_id", userId)
      .single();

    if (profErr) return NextResponse.json({ error: profErr.message }, { status: 403 });
    if (!prof?.org_id) return NextResponse.json({ error: "No org" }, { status: 403 });

    const { data: created, error: insertErr } = await admin
      .from("objects")
      .insert({
        org_id: prof.org_id,
        created_by: userId,
        title,
        artist,
        status: "intake",
      })
      .select("id")
      .single();

    if (insertErr || !created?.id) {
      return NextResponse.json(
        { error: insertErr?.message || "Unable to create object" },
        { status: 400 }
      );
    }

    await admin.from("audit_log").insert({
      org_id: prof.org_id,
      user_id: userId,
      action: "object.created",
      resource_type: "object",
      resource_id: created.id,
      changes: { title, artist },
    });

    return NextResponse.json({ id: created.id });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
