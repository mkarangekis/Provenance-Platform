import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

function extFromPath(p: string) {
  const i = p.lastIndexOf(".");
  return i >= 0 ? p.slice(i + 1).toLowerCase() : "";
}

async function fileToText(buf: ArrayBuffer, filename: string): Promise<string> {
  const ext = extFromPath(filename);

  // Plain text
  if (["txt", "csv", "json"].includes(ext)) {
    return new TextDecoder("utf-8").decode(new Uint8Array(buf));
  }

  const buffer = Buffer.from(new Uint8Array(buf));

  // ---------- PDF OCR (Responses API – safe) ----------
  if (ext === "pdf") {
    const file = await openai.files.create({
      purpose: "user_data",
      file: new File([buffer], filename, { type: "application/pdf" }),
    });

    const resp = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_file", file_id: file.id },
            {
              type: "input_text",
              text:
                "Extract ALL readable text from this PDF. " +
                "Return plain text only. Preserve line breaks.",
            },
          ],
        },
      ],
    });

    return resp.output_text || "";
  }

  // ---------- IMAGE OCR (Chat Completions – type-safe) ----------
  if (["png", "jpg", "jpeg", "webp"].includes(ext)) {
    const base64 = buffer.toString("base64");
    const mime =
      ext === "png"
        ? "image/png"
        : ext === "webp"
        ? "image/webp"
        : "image/jpeg";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "OCR this image. Extract ALL visible text verbatim." },
            {
              type: "image_url",
              image_url: { url: `data:${mime};base64,${base64}` },
            },
          ],
        },
      ],
    });

    return completion.choices[0]?.message?.content || "";
  }

  return `UNSUPPORTED_FILE_TYPE: ${filename}`;
}

export async function POST(req: Request) {
  try {
    const { jobId } = await req.json();
    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
    }

    const admin = getAdmin();

    // 1) Load job
    const { data: job } = await admin
      .from("ai_extractions")
      .select("*")
      .eq("id", jobId)
      .single();

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    await admin
      .from("ai_extractions")
      .update({ status: "processing", error: null })
      .eq("id", jobId);

    // 2) Load object
    const { data: obj } = await admin
      .from("objects")
      .select("*")
      .eq("id", job.object_id)
      .single();

    if (!obj) throw new Error("Object missing");

    // 3) Load document
    let extractedText = "";
    let docMeta = null;

    if (job.doc_id) {
      const { data: doc } = await admin
        .from("object_docs")
        .select("*")
        .eq("id", job.doc_id)
        .single();

      if (!doc) throw new Error("Document missing");

      docMeta = doc;

      const { data: blob } = await admin.storage
        .from("object-docs")
        .download(doc.storage_path);

      if (!blob) throw new Error("Failed to download file");

      extractedText = await fileToText(
        await blob.arrayBuffer(),
        doc.storage_path
      );
    } else {
      extractedText = `Manual extraction for ${obj.title}`;
    }

    // 4) Provenance extraction
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are a provenance analysis assistant. Return JSON ONLY.",
        },
        {
          role: "user",
          content: JSON.stringify({
            object: obj,
            document: docMeta,
            extracted_text: extractedText.slice(0, 120000),
          }),
        },
      ],
    });

    type SuggestedEvent = {
      event_date?: string;
      event_type?: string;
      description?: string;
      parties?: string[] | string;
      location?: string;
      confidence?: number;
      evidence?: string;
    };
    type ParsedExtraction = { suggested_events?: SuggestedEvent[] };

    let parsed: ParsedExtraction = {};
    try {
      const json = JSON.parse(completion.choices[0].message.content || "{}");
      if (json && typeof json === "object") {
        parsed = json as ParsedExtraction;
      }
    } catch {
      parsed = {};
    }

    // 5) Insert provenance events
    const events = Array.isArray(parsed.suggested_events) ? parsed.suggested_events : [];

    const inserts = events
      .filter((e) => typeof e.confidence === "number" && e.confidence >= 0.55)
      .map((e) => ({
        org_id: job.org_id,
        object_id: job.object_id,
        event_date: e.event_date || null,
        event_type: e.event_type || "other",
        description: e.description || "",
        parties: Array.isArray(e.parties)
          ? e.parties.join(", ")
          : typeof e.parties === "string"
          ? e.parties
          : null,
        location: e.location || null,
        status: "pending",
        confidence: typeof e.confidence === "number" ? e.confidence : null,
        source_extraction_id: jobId,
        evidence: e.evidence || null,
      }));

    if (inserts.length) {
      await admin.from("provenance_events").insert(inserts);
    }

    await admin
      .from("ai_extractions")
      .update({
        status: "done",
        extracted_text: extractedText,
        extracted_json: parsed,
      })
      .eq("id", jobId);

    return NextResponse.json({ ok: true, jobId });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
