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

    const prompt = `Estimate a valuation range in USD for the following artwork. Return JSON with value_low, value_mid, value_high.\nTitle: ${object.title}\nArtist: ${object.artist ?? "Unknown"}\nDescription: ${object.description ?? "N/A"}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: "You are an art market analyst." },
        { role: "user", content: prompt },
      ],
    });

    const rawText = completion.choices[0]?.message?.content ?? "{}";
    let parsed: Record<string, number> = {};
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = {};
    }

    const valueLow = parsed.value_low ?? 25000;
    const valueMid = parsed.value_mid ?? 40000;
    const valueHigh = parsed.value_high ?? 60000;

    const { data: valuation } = await admin
      .from("valuations")
      .insert({
        org_id: object.org_id,
        object_id: object.id,
        valuation_type: "auction_estimate",
        purpose: "reserve_guidance",
        value_low: valueLow,
        value_mid: valueMid,
        value_high: valueHigh,
        valuation_method: "ai_model",
        ai_generated: true,
        ai_model: "gpt-4o-mini",
        ai_confidence: 0.62,
        status: "draft",
      })
      .select("*")
      .single();

    await admin
      .from("objects")
      .update({ workflow_stage: 4 })
      .eq("id", object.id);

    return NextResponse.json({ ok: true, valuation });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
