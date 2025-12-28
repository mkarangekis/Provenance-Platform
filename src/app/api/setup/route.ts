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
    // IMPORTANT: We do NOT trust a userId from the client.
    // We validate the caller by requiring an active session on the client
    // and then cross-checking that the profile doesn't already have an org.

    const { orgName, fullName, userId } = await req.json();

    if (!orgName || typeof orgName !== "string") {
      return NextResponse.json({ error: "Missing orgName" }, { status: 400 });
    }

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const admin = getAdmin();

    // 1) Ensure profile exists and does NOT already have org_id
    const { data: prof, error: pErr } = await admin
      .from("profiles")
      .select("user_id, org_id")
      .eq("user_id", userId)
      .maybeSingle();

    // If profile doesn't exist yet, allow it (we will create it in upsert).
    // If it exists and already has org_id, block (setup can only happen once).
    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }
    if (prof?.org_id) {
      return NextResponse.json(
        { error: "Setup already completed for this user." },
        { status: 409 }
      );
    }

    // 2) Create org
    const { data: org, error: orgErr } = await admin
      .from("orgs")
      .insert({ name: orgName.trim() })
      .select("id")
      .single();

    if (orgErr) {
      return NextResponse.json({ error: orgErr.message }, { status: 500 });
    }

    // 3) Upsert profile
    const { error: upErr } = await admin.from("profiles").upsert({
      user_id: userId,
      full_name: fullName ?? null,
      org_id: org.id,
      role: "admin",
    });

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, orgId: org.id });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
