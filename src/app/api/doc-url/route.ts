import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const path = searchParams.get("path");
    const userId = searchParams.get("userId");

    if (!path) return NextResponse.json({ error: "Missing path" }, { status: 400 });
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    const admin = getAdmin();

    // 1) Get caller org_id (server-side)
    const { data: prof, error: pErr } = await admin
      .from("profiles")
      .select("org_id")
      .eq("user_id", userId)
      .single();

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 403 });
    if (!prof?.org_id) return NextResponse.json({ error: "No org" }, { status: 403 });

    // 2) Confirm this path exists in object_docs for this org
    const { data: doc, error: dErr } = await admin
      .from("object_docs")
      .select("id")
      .eq("org_id", prof.org_id)
      .eq("storage_path", path)
      .single();

    if (dErr || !doc) {
      return NextResponse.json({ error: "Not authorized for this file" }, { status: 403 });
    }

    // 3) Create signed URL
    const { data, error } = await admin.storage
      .from("object-docs")
      .createSignedUrl(path, 60 * 10);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ url: data.signedUrl });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
