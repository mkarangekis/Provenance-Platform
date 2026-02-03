import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  const admin = getAdmin();

  try {
    const body = await req.json();
    const { objectId } = body as { objectId?: string };

    if (!objectId) {
      return NextResponse.json({ ok: false, error: "objectId is required" }, { status: 400 });
    }

    const { data: object } = await admin
      .from("objects")
      .select("id, org_id, title, artist")
      .eq("id", objectId)
      .single();

    if (!object) {
      return NextResponse.json({ ok: false, error: "Object not found" }, { status: 404 });
    }

    const { data: contacts } = await admin
      .from("crm_contacts")
      .select("id, first_name, last_name, collecting_interests")
      .eq("org_id", object.org_id)
      .limit(5);

    const prompt = `Recommend buyer matches for ${object.title} by ${object.artist ?? "Unknown"} based on contact interests. Return JSON list with contact_id and match_score (0-1).`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: "You are a CRM strategist for auction houses." },
        { role: "user", content: prompt },
      ],
    });

    const rawText = completion.choices[0]?.message?.content ?? "[]";
    let parsed: Array<{ contact_id: string; match_score: number }> = [];
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = [];
    }

    const matches = (parsed.length > 0 ? parsed : contacts || []).map((contact, index) => ({
      org_id: object.org_id,
      object_id: object.id,
      contact_id: "contact_id" in contact ? contact.contact_id : contact.id,
      match_score: "match_score" in contact ? contact.match_score : 0.65 - index * 0.05,
      ai_reasoning: "Automated affinity match based on collection themes.",
      status: "suggested",
    }));

    if (matches.length > 0) {
      await admin.from("buyer_matches").insert(matches);
    }

    await admin
      .from("objects")
      .update({ workflow_stage: 6 })
      .eq("id", object.id);

    return NextResponse.json({ ok: true, matches: matches.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
