import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function envTruthy(value: unknown): boolean {
  if (value == null) return false;
  const v = String(value).trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function enabled() {
  return envTruthy(process.env.REGISTRATA_RESEARCH_ASSISTANT);
}

export async function GET(req: Request) {
  if (!enabled()) {
    return NextResponse.json({ error: "Research assistant disabled" }, { status: 404 });
  }

  const url = new URL(req.url);
  const objectId = url.searchParams.get("objectId");
  const userId = url.searchParams.get("userId");
  const mode = url.searchParams.get("mode") || "internal";
  const format = url.searchParams.get("format") || "json";

  if (!objectId || !userId) {
    return NextResponse.json({ error: "Missing objectId or userId" }, { status: 400 });
  }

  const admin = getAdmin();
  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("org_id")
    .eq("user_id", userId)
    .single();
  if (profileErr || !profile?.org_id) {
    return NextResponse.json({ error: "User has no org" }, { status: 403 });
  }

  const { data: object } = await admin.from("objects").select("*").eq("id", objectId).single();
  if (!object || object.org_id !== profile.org_id) {
    return NextResponse.json({ error: "Object not found" }, { status: 404 });
  }

  const { data: events } = await admin
    .from("provenance_events")
    .select("*")
    .eq("object_id", objectId)
    .order("event_date", { ascending: true });
  const { data: extractions } = await admin
    .from("ai_extractions")
    .select("id, created_at, extracted_json")
    .eq("object_id", objectId)
    .order("created_at", { ascending: false })
    .limit(20);

  const latest = (extractions || []).find((row) => {
    const payload = row.extracted_json as Record<string, unknown> | null;
    return payload?.run_type === "research_chat";
  });
  const payload = (latest?.extracted_json || {}) as Record<string, unknown>;
  const stageOutputs = (payload.stage_outputs || {}) as Record<string, Record<string, unknown>>;
  const researchPackage = (stageOutputs.research_package || {}) as Record<string, unknown>;
  const thread = (stageOutputs.research_thread || {}) as { messages?: unknown[] };

  const approvedEvents = (events || []).filter((event) => event.status === "approved");
  const internalEvents = (events || []).filter((event) => event.status !== "rejected");

  const data = {
    object: {
      id: object.id,
      title: object.title,
      artist: object.artist,
      description: object.description,
      status: object.status,
    },
    package: researchPackage,
    thread: mode === "internal" ? thread.messages || [] : [],
    events: mode === "internal" ? internalEvents : approvedEvents,
    mode,
    exported_at: new Date().toISOString(),
  };

  if (format === "json") {
    return NextResponse.json(data, {
      headers: {
        "Content-Disposition": `attachment; filename=\"research-${objectId}.json\"`,
      },
    });
  }

  if (format === "html") {
    const provenanceRows = (mode === "internal" ? internalEvents : approvedEvents)
      .map((event) => `<li>${event.event_date || "n.d."} - ${event.description}</li>`)
      .join("");
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Research Export - ${object.title}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 920px; margin: 30px auto; color: #222; line-height: 1.45; }
    h1, h2 { margin-bottom: 8px; }
    .meta { color: #666; font-size: 13px; margin-bottom: 18px; }
    .block { margin-top: 18px; border: 1px solid #ddd; padding: 12px; border-radius: 8px; }
    pre { white-space: pre-wrap; font-size: 12px; }
  </style>
</head>
<body>
  <h1>${object.title}</h1>
  <div class="meta">${object.artist || "Unknown artist"} | Mode: ${mode} | Exported ${new Date().toLocaleString()}</div>
  <div class="block">
    <h2>Research Package</h2>
    <pre>${JSON.stringify(researchPackage, null, 2)}</pre>
  </div>
  <div class="block">
    <h2>Provenance (${mode === "internal" ? "Approved + Pending" : "Approved"})</h2>
    ${provenanceRows ? `<ul>${provenanceRows}</ul>` : "<p>No provenance entries.</p>"}
  </div>
  ${
    mode === "internal"
      ? `<div class="block"><h2>Thread</h2><pre>${JSON.stringify(thread.messages || [], null, 2)}</pre></div>`
      : ""
  }
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html",
        "Content-Disposition": `attachment; filename=\"research-${objectId}.html\"`,
      },
    });
  }

  return NextResponse.json({ error: "Invalid format" }, { status: 400 });
}
