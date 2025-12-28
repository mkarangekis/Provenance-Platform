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
    const form = await req.formData();

    const file = form.get("file") as File | null;
    const objectId = String(form.get("objectId") || "");
    const docType = String(form.get("docType") || "other");
    const userId = String(form.get("userId") || "");

    if (!file || !objectId || !userId) {
      return NextResponse.json(
        { error: "Missing file, objectId, or userId" },
        { status: 400 }
      );
    }

    const admin = getAdmin();

    // 1) Get caller org_id
    const { data: prof, error: pErr } = await admin
      .from("profiles")
      .select("org_id")
      .eq("user_id", userId)
      .single();

    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 403 });
    }
    if (!prof?.org_id) {
      return NextResponse.json({ error: "User has no org" }, { status: 403 });
    }

    // 2) Confirm object exists and belongs to same org
    const { data: obj, error: oErr } = await admin
      .from("objects")
      .select("id, org_id")
      .eq("id", objectId)
      .single();

    if (oErr || !obj) {
      return NextResponse.json(
        { error: oErr?.message || "Object not found" },
        { status: 404 }
      );
    }

    if (obj.org_id !== prof.org_id) {
      return NextResponse.json(
        { error: "Not authorized for this object" },
        { status: 403 }
      );
    }

    // 3) Upload file to private bucket
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `objects/${objectId}/${Date.now()}-${safeName}`;

    const { error: upErr } = await admin.storage
      .from("object-docs")
      .upload(storagePath, file, { upsert: false });

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 400 });
    }

    // 4) Insert doc record (org-scoped)
    const { error: insErr } = await admin.from("object_docs").insert({
      org_id: prof.org_id,
      object_id: objectId,
      uploaded_by: userId,
      storage_path: storagePath,
      doc_type: docType,
    });

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, path: storagePath });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
