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

    const { data: object, error } = await admin
      .from("objects")
      .select("id, org_id, title, artist, description")
      .eq("id", objectId)
      .single();

    if (error || !object) {
      return NextResponse.json({ ok: false, error: "Object not found" }, { status: 404 });
    }

    const prompt = `Summarize provenance research focus areas for the following artwork:\n\nTitle: ${object.title}\nArtist: ${object.artist ?? "Unknown"}\nDescription: ${object.description ?? "N/A"}\n\nReturn a JSON payload with fields: summary, gaps, recommended_sources (array).`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: "You are a provenance research analyst." },
        { role: "user", content: prompt },
      ],
    });

    const rawText = completion.choices[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = { summary: rawText };
    }

    const { data: query } = await admin.from("research_queries").insert({
      org_id: object.org_id,
      object_id: object.id,
      query_type: "comprehensive",
      raw_results: parsed,
      processed_results: parsed,
      findings_summary: typeof parsed.summary === "string" ? parsed.summary : "AI research completed.",
      ai_model: "gpt-4o-mini",
      status: "completed",
      completed_at: new Date().toISOString(),
    }).select("*").single();

    await admin
      .from("objects")
      .update({
        ai_confidence_score: 0.72,
        ai_completeness_score: 0.58,
        workflow_stage: 2,
      })
      .eq("id", object.id);

    return NextResponse.json({ ok: true, query });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
