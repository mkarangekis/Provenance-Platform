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

    const prompt = `Write a catalog-ready description for the artwork.\nTitle: ${object.title}\nArtist: ${object.artist ?? "Unknown"}\nNotes: ${object.description ?? "N/A"}\nReturn JSON with description_short, description_long.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: "You are a catalog editor for an auction house." },
        { role: "user", content: prompt },
      ],
    });

    const rawText = completion.choices[0]?.message?.content ?? "{}";
    let parsed: Record<string, string> = {};
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = { description_short: rawText };
    }

    const { data: entry } = await admin
      .from("catalog_entries")
      .insert({
        org_id: object.org_id,
        object_id: object.id,
        title_display: object.title,
        artist_display: object.artist,
        description_short: parsed.description_short ?? rawText,
        description_long: parsed.description_long ?? null,
        ai_generated: true,
        ai_model: "gpt-4o-mini",
        status: "draft",
      })
      .select("*")
      .single();

    await admin
      .from("objects")
      .update({ workflow_stage: 3 })
      .eq("id", object.id);

    return NextResponse.json({ ok: true, entry });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
