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
      .select("id, org_id, title, artist, description")
      .eq("id", objectId)
      .single();

    if (!object) {
      return NextResponse.json({ ok: false, error: "Object not found" }, { status: 404 });
    }

    const prompt = `Assess risk for the following artwork. Return JSON with overall_risk_score (0-1) and flags (array of short strings).\nTitle: ${object.title}\nArtist: ${object.artist ?? "Unknown"}\nDescription: ${object.description ?? "N/A"}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: "You are a risk assessor for art provenance." },
        { role: "user", content: prompt },
      ],
    });

    const rawText = completion.choices[0]?.message?.content ?? "{}";
    let parsed: { overall_risk_score?: number; flags?: string[] } = {};
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = {};
    }

    const riskScore = parsed.overall_risk_score ?? 0.35;

    const { data: assessment } = await admin
      .from("risk_assessments")
      .insert({
        org_id: object.org_id,
        object_id: object.id,
        overall_risk_score: riskScore,
        flags: parsed.flags ?? [],
        ai_generated: true,
        ai_model: "gpt-4o-mini",
        ai_reasoning: "Automated risk summary generated.",
        status: "pending",
      })
      .select("*")
      .single();

    await admin
      .from("objects")
      .update({ ai_risk_score: riskScore, workflow_stage: 5 })
      .eq("id", object.id);

    return NextResponse.json({ ok: true, assessment });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
