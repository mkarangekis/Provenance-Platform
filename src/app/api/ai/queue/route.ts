import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  try {
    const { userId, objectId, docId } = await req.json();

    if (!userId || !objectId) {
      return NextResponse.json({ error: "Missing userId or objectId" }, { status: 400 });
    }

    const admin = getAdmin();

    // 1) caller org
    const { data: prof, error: pErr } = await admin
      .from("profiles")
      .select("org_id")
      .eq("user_id", userId)
      .single();

    if (pErr || !prof?.org_id) {
      return NextResponse.json({ error: pErr?.message || "No org" }, { status: 403 });
    }

    // 2) object belongs to org
    const { data: obj, error: oErr } = await admin
      .from("objects")
      .select("id, org_id")
      .eq("id", objectId)
      .single();

    if (oErr || !obj) return NextResponse.json({ error: oErr?.message || "Object not found" }, { status: 404 });
    if (obj.org_id !== prof.org_id) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

    // 3) if docId given, ensure it belongs to org + object
    if (docId) {
      const { data: doc, error: dErr } = await admin
        .from("object_docs")
        .select("id, org_id, object_id")
        .eq("id", docId)
        .single();

      if (dErr || !doc) return NextResponse.json({ error: dErr?.message || "Doc not found" }, { status: 404 });
      if (doc.org_id !== prof.org_id || doc.object_id !== objectId) {
        return NextResponse.json({ error: "Not authorized for doc" }, { status: 403 });
      }
    }

    // 4) create extraction job
    const { data: row, error: insErr } = await admin
      .from("ai_extractions")
      .insert({
        org_id: prof.org_id,
        object_id: objectId,
        doc_id: docId ?? null,
        status: "queued",
        source: docId ? "document" : "manual",
      })
      .select("id,status")
      .single();

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });

    return NextResponse.json({ ok: true, job: row });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
