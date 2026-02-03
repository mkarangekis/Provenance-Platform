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

type ExternalSource = {
  source: string;
  url?: string;
  data: Record<string, unknown>;
};

function buildQuery(obj: { title: string; artist: string | null }) {
  const parts = [obj.title, obj.artist || ""].filter(Boolean);
  return parts.join(" ");
}

async function fetchJson(url: string, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      return null;
    }
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWikidata(query: string): Promise<ExternalSource | null> {
  const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(
    query
  )}&language=en&format=json&limit=3`;
  const search = await fetchJson(searchUrl);
  const top = search?.search?.[0];
  if (!top?.id) return null;

  const entityUrl = `https://www.wikidata.org/wiki/Special:EntityData/${top.id}.json`;
  const entity = await fetchJson(entityUrl);
  return {
    source: "wikidata",
    url: `https://www.wikidata.org/wiki/${top.id}`,
    data: {
      id: top.id,
      label: top.label,
      description: top.description,
      entity,
    },
  };
}

async function fetchMetMuseum(query: string): Promise<ExternalSource | null> {
  const searchUrl = `https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=${encodeURIComponent(
    query
  )}`;
  const search = await fetchJson(searchUrl);
  const objectId = search?.objectIDs?.[0];
  if (!objectId) return null;
  const objectUrl = `https://collectionapi.metmuseum.org/public/collection/v1/objects/${objectId}`;
  const object = await fetchJson(objectUrl);
  if (!object) return null;
  return {
    source: "met_museum",
    url: object?.objectURL,
    data: {
      objectID: object?.objectID,
      title: object?.title,
      artistDisplayName: object?.artistDisplayName,
      objectDate: object?.objectDate,
      medium: object?.medium,
      dimensions: object?.dimensions,
      classification: object?.classification,
      department: object?.department,
      objectURL: object?.objectURL,
    },
  };
}

async function fetchArtInstitute(query: string): Promise<ExternalSource | null> {
  const searchUrl = `https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(
    query
  )}&fields=id,title,artist_title,date_display,medium_display,dimensions,classification_titles,department_title,thumbnail,api_link&limit=1`;
  const search = await fetchJson(searchUrl);
  const top = search?.data?.[0];
  if (!top?.id) return null;
  return {
    source: "art_institute_of_chicago",
    url: top?.api_link,
    data: top,
  };
}

export async function POST(req: Request) {
  const admin = getAdmin();
  let currentJob: { id: string; attempts: number } | null = null;
  try {
    const { data: job } = await admin
      .from("catalog_jobs")
      .select("*")
      .eq("status", "queued")
      .or("next_attempt_at.is.null,next_attempt_at.lte.now()")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!job) {
      return NextResponse.json({ ok: true, message: "No queued jobs" });
    }
    currentJob = { id: job.id, attempts: job.attempts || 0 };

    await admin
      .from("catalog_jobs")
      .update({
        status: "processing",
        attempts: (job.attempts || 0) + 1,
        last_attempt_at: new Date().toISOString(),
        error: null,
      })
      .eq("id", job.id);

    const { data: obj } = await admin
      .from("objects")
      .select("*")
      .eq("id", job.object_id)
      .single();

    if (!obj) throw new Error("Object missing");

    const [docsRes, eventsRes] = await Promise.all([
      admin.from("object_docs").select("*").eq("object_id", job.object_id).order("created_at", { ascending: false }),
      admin
        .from("provenance_events")
        .select("*")
        .eq("object_id", job.object_id)
        .order("event_date", { ascending: true }),
    ]);

    const query = buildQuery({ title: obj.title, artist: obj.artist });
    const [wikidata, met, artic] = await Promise.all([
      fetchWikidata(query),
      fetchMetMuseum(query),
      fetchArtInstitute(query),
    ]);

    const externalSources = [wikidata, met, artic].filter(Boolean) as ExternalSource[];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are a cataloging assistant for fine art. Return JSON ONLY with fields: " +
            "catalog_title, artist, year, medium, dimensions, classification, culture, " +
            "description, provenance_summary, keywords (array), external_refs (array).",
        },
        {
          role: "user",
          content: JSON.stringify({
            object: obj,
            documents: docsRes.data || [],
            events: eventsRes.data || [],
            external_sources: externalSources,
          }),
        },
      ],
    });

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
    } catch {
      parsed = {};
    }

    const generatedAt = new Date().toISOString();
    const updatedMetadata = {
      ...(obj.metadata || {}),
      catalog: {
        generatedAt,
        externalSources,
        result: parsed,
      },
    };

    const normalized = {
      catalog_title: typeof parsed.catalog_title === "string" ? parsed.catalog_title : null,
      catalog_year:
        typeof parsed.year === "string"
          ? parsed.year
          : typeof parsed.year === "number"
          ? String(parsed.year)
          : null,
      catalog_medium: typeof parsed.medium === "string" ? parsed.medium : null,
      catalog_dimensions: typeof parsed.dimensions === "string" ? parsed.dimensions : null,
      catalog_classification: typeof parsed.classification === "string" ? parsed.classification : null,
      catalog_culture: typeof parsed.culture === "string" ? parsed.culture : null,
      catalog_description: typeof parsed.description === "string" ? parsed.description : null,
      catalog_provenance_summary:
        typeof parsed.provenance_summary === "string" ? parsed.provenance_summary : null,
      catalog_keywords: Array.isArray(parsed.keywords)
        ? parsed.keywords.filter((kw) => typeof kw === "string")
        : null,
      catalog_sources: externalSources,
      catalog_status: "draft",
      catalog_generated_at: generatedAt,
      metadata: updatedMetadata,
    };

    await admin.from("objects").update(normalized).eq("id", job.object_id);

    await admin.from("catalog_entries").insert({
      org_id: obj.org_id,
      object_id: obj.id,
      title_display: normalized.catalog_title ?? obj.title,
      artist_display: obj.artist,
      date_display: normalized.catalog_year,
      medium_display: normalized.catalog_medium,
      dimensions_display: normalized.catalog_dimensions,
      description_short: normalized.catalog_description,
      provenance_text: normalized.catalog_provenance_summary,
      estimate_low: obj.estimate_low,
      estimate_high: obj.estimate_high,
      estimate_currency: obj.estimate_currency,
      ai_generated: true,
      ai_model: "gpt-4o-mini",
      status: "draft",
    });

    await admin.from("catalog_jobs").update({ status: "done" }).eq("id", job.id);

    return NextResponse.json({ ok: true, jobId: job.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const nextAttempt = new Date();
    nextAttempt.setMinutes(nextAttempt.getMinutes() + 10);
    const attempts = (currentJob?.attempts || 0) + 1;
    const status = attempts >= 3 ? "failed" : "queued";
    if (currentJob?.id) {
      await admin
        .from("catalog_jobs")
        .update({
          status,
          error: message,
          next_attempt_at: nextAttempt.toISOString(),
        })
        .eq("id", currentJob.id);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
