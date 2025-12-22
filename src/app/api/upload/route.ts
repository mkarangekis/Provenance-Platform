import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const objectId = String(form.get("objectId") || "");
    const docType = String(form.get("docType") || "other");

    if (!file || !objectId) {
      return NextResponse.json({ error: "Missing file or objectId" }, { status: 400 });
    }

    // Server-side Supabase client with service role (NEVER expose this in browser)
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Ensure object exists
    const { data: obj, error: objErr } = await admin
      .from("objects")
      .select("id, org_id")
      .eq("id", objectId)
      .single();

    if (objErr || !obj) {
      return NextResponse.json({ error: objErr?.message || "Object not found" }, { status: 404 });
    }

    const path = `objects/${objectId}/${Date.now()}-${file.name}`;

    const { error: upErr } = await admin.storage
      .from("object-docs")
      .upload(path, file, { upsert: false });

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 400 });
    }

    // Record doc in DB (uploaded_by unknown in service context; store null or implement JWT check later)
    const { error: insErr } = await admin.from("object_docs").insert({
      org_id: obj.org_id,
      object_id: objectId,
      uploaded_by: (await admin.auth.getUser()).data.user?.id ?? null,
      storage_path: path,
      doc_type: docType,
    });

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, path });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
