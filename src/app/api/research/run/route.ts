import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import crypto from "crypto";
import { fetchTrustedSources } from "@/lib/research/trustedSourcesAdapter";

type StageStatus = "queued" | "processing" | "done" | "failed";
type StageId =
  | "stage_1_intake"
  | "stage_2_provenance"
  | "stage_3_catalog"
  | "stage_4_valuation"
  | "stage_5_risk"
  | "stage_6_buyer_targeting"
  | "stage_7_monitoring";

type ResearchMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

type ResearchPayload = {
  run_type: "research_chat";
  thread_id: string;
  stage_status: Record<StageId, { status: StageStatus; updated_at: string; message?: string }>;
  stage_outputs: {
    research_thread: { messages: ResearchMessage[] };
    research_package: Record<string, unknown>;
  } & Record<StageId, Record<string, unknown>>;
  last_stage: StageId | null;
  deep_research_enabled: boolean;
  trusted_sources_enabled: boolean;
  last_run_at: string;
};

type RequestBody = {
  query?: string;
  objectId?: string;
  threadId?: string;
  deepResearch?: boolean;
  userId?: string;
  action?: "run" | "save_object" | "add_to_collection";
  package?: Record<string, unknown>;
};

const STAGES: StageId[] = [
  "stage_1_intake",
  "stage_2_provenance",
  "stage_3_catalog",
  "stage_4_valuation",
  "stage_5_risk",
  "stage_6_buyer_targeting",
  "stage_7_monitoring",
];

function envTruthy(value: unknown): boolean {
  if (value == null) return false;
  const v = String(value).trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function enabled() {
  return envTruthy(process.env.REGISTRATA_RESEARCH_ASSISTANT);
}

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

function ts() {
  return new Date().toISOString();
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function eventHash(event: {
  event_date?: string | null;
  event_type: string;
  description: string;
  parties?: string | null;
  location?: string | null;
}): string {
  return crypto.createHash("sha256").update(JSON.stringify(event)).digest("hex");
}

function makePayload(threadId: string, messages: ResearchMessage[], deepResearch: boolean): ResearchPayload {
  const now = ts();
  const stageStatus = STAGES.reduce((acc, stage) => {
    acc[stage] = { status: "queued", updated_at: now };
    return acc;
  }, {} as Record<StageId, { status: StageStatus; updated_at: string; message?: string }>);

  return {
    run_type: "research_chat",
    thread_id: threadId,
    stage_status: stageStatus,
    stage_outputs: {
      research_thread: { messages },
      research_package: {},
      stage_1_intake: {},
      stage_2_provenance: {},
      stage_3_catalog: {},
      stage_4_valuation: {},
      stage_5_risk: {},
      stage_6_buyer_targeting: {},
      stage_7_monitoring: {},
    },
    last_stage: null,
    deep_research_enabled: deepResearch,
    trusted_sources_enabled: envTruthy(process.env.TRUSTED_SOURCES_ENABLED),
    last_run_at: now,
  };
}

function setStage(
  payload: ResearchPayload,
  stage: StageId,
  status: StageStatus,
  output?: Record<string, unknown>,
  message?: string
) {
  payload.stage_status[stage] = {
    status,
    updated_at: ts(),
    ...(message ? { message } : {}),
  };
  if (output) payload.stage_outputs[stage] = output;
  payload.last_stage = stage;
}

function firstString(values: unknown[], fallback = ""): string {
  for (const value of values) {
    const parsed = str(value);
    if (parsed) return parsed;
  }
  return fallback;
}

async function resolveObjectId(admin: ReturnType<typeof getAdmin>, orgId: string, preferred?: string | null) {
  if (preferred) {
    const { data: obj } = await admin.from("objects").select("id, org_id").eq("id", preferred).single();
    if (obj?.org_id === orgId) return obj.id;
  }
  const { data: fallback } = await admin
    .from("objects")
    .select("id")
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return fallback?.id || null;
}

export async function POST(req: Request) {
  if (!enabled()) {
    return NextResponse.json({ error: "Research assistant disabled" }, { status: 404 });
  }

  const admin = getAdmin();
  try {
    const body = (await req.json()) as RequestBody;
    const userId = str(body.userId);
    const action = body.action || "run";
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("org_id")
      .eq("user_id", userId)
      .single();
    if (profileErr || !profile?.org_id) {
      return NextResponse.json({ error: "User has no org" }, { status: 403 });
    }

    const objectId = await resolveObjectId(admin, profile.org_id, str(body.objectId));
    if (!objectId) {
      return NextResponse.json({ error: "No object found. Create or select an object first." }, { status: 400 });
    }

    const { data: object } = await admin.from("objects").select("*").eq("id", objectId).single();
    if (!object || object.org_id !== profile.org_id) {
      return NextResponse.json({ error: "Object not found" }, { status: 404 });
    }

    if (action === "save_object") {
      const pkg = body.package || {};
      const objectSummary = (pkg.object_summary || {}) as Record<string, unknown>;
      const catalogEntry = (pkg.catalog_entry || {}) as Record<string, unknown>;
      const valuation = (pkg.valuation || {}) as Record<string, unknown>;
      const updates = {
        title: firstString([objectSummary.title, catalogEntry.heading_line, object.title], object.title),
        artist: firstString([objectSummary.artist, object.artist], object.artist || "") || null,
        description: firstString([objectSummary.summary, object.description], object.description || "") || null,
        catalog_description: firstString([catalogEntry.description, object.catalog_description], object.catalog_description || "") || null,
        estimate_low: typeof valuation.estimate_low === "number" ? valuation.estimate_low : object.estimate_low,
        estimate_high: typeof valuation.estimate_high === "number" ? valuation.estimate_high : object.estimate_high,
        workflow_stage: 3,
      };
      await admin.from("objects").update(updates).eq("id", objectId);
      return NextResponse.json({ ok: true, objectId, saved: true });
    }

    if (action === "add_to_collection") {
      await admin
        .from("objects")
        .update({ collection_status: "owned", collection_label: "research_assistant" })
        .eq("id", objectId);
      return NextResponse.json({ ok: true, objectId, collection_status: "owned" });
    }

    const prompt = str(body.query) || "Generate a complete research package for this artwork.";
    const deepResearch = Boolean(body.deepResearch);
    const threadId = str(body.threadId) || crypto.randomUUID();

    const { data: docs } = await admin
      .from("object_docs")
      .select("*")
      .eq("object_id", objectId)
      .order("created_at", { ascending: false })
      .limit(20);
    const { data: events } = await admin
      .from("provenance_events")
      .select("*")
      .eq("object_id", objectId)
      .order("event_date", { ascending: true })
      .limit(100);
    const { data: valuations } = await admin
      .from("valuations")
      .select("*")
      .eq("object_id", objectId)
      .order("created_at", { ascending: false })
      .limit(3);
    const { data: risks } = await admin
      .from("risk_assessments")
      .select("*")
      .eq("object_id", objectId)
      .order("created_at", { ascending: false })
      .limit(3);
    const { data: buyers } = await admin
      .from("buyer_matches")
      .select("id, match_score, ai_reasoning, ai_outreach_suggestion, contact_id")
      .eq("object_id", objectId)
      .order("created_at", { ascending: false })
      .limit(6);
    const { data: contacts } = await admin
      .from("crm_contacts")
      .select("id, first_name, last_name, collecting_interests")
      .eq("org_id", profile.org_id)
      .limit(10);
    const { data: prior } = await admin
      .from("ai_extractions")
      .select("id, extracted_json, extracted_text, created_at")
      .eq("object_id", objectId)
      .order("created_at", { ascending: false })
      .limit(15);

    const latestThread = (prior || []).find((row) => {
      const payload = row.extracted_json as Record<string, unknown> | null;
      return payload?.run_type === "research_chat" && payload?.thread_id === threadId;
    });
    const priorMessages =
      ((latestThread?.extracted_json as ResearchPayload | undefined)?.stage_outputs?.research_thread?.messages || []) as ResearchMessage[];
    const extractedText = (prior || [])
      .map((entry) => (typeof entry.extracted_text === "string" ? entry.extracted_text.trim() : ""))
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 120000);
    const messages: ResearchMessage[] = [
      ...priorMessages.slice(-20),
      { role: "user", content: prompt, created_at: ts() },
    ];

    const trustedSources = await fetchTrustedSources(`${object.title} ${object.artist || ""}`.trim());
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: deepResearch ? 0.35 : 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are Registrata's art research assistant. Return JSON only with fields: " +
            "object_summary, catalog_entry, provenance, literature_exhibitions, auction_history_comparables, valuation, risk, buyer_targeting, sources, assistant_response. " +
            "Under provenance include candidate_events array with event_date,event_type,description,parties,location,evidence,confidence.",
        },
        {
          role: "user",
          content: JSON.stringify({
            prompt,
            object,
            docs: docs || [],
            events: events || [],
            valuations: valuations || [],
            risks: risks || [],
            buyers: buyers || [],
            contacts: contacts || [],
            extracted_text: extractedText,
            trusted_sources: trustedSources,
          }),
        },
      ],
    });

    let researchPackage: Record<string, unknown> = {};
    try {
      researchPackage = JSON.parse(completion.choices[0]?.message?.content || "{}");
    } catch {
      researchPackage = {};
    }

    const assistantMessage = firstString(
      [
        researchPackage.assistant_response,
        (researchPackage.object_summary as Record<string, unknown> | undefined)?.summary,
      ],
      "Research package generated."
    );
    messages.push({ role: "assistant", content: assistantMessage, created_at: ts() });

    const payload = makePayload(threadId, messages, deepResearch);
    const provenanceBlock = (researchPackage.provenance || {}) as Record<string, unknown>;
    const candidateEvents = Array.isArray(provenanceBlock.candidate_events)
      ? provenanceBlock.candidate_events
      : [];

    setStage(payload, "stage_1_intake", "done", {
      normalized: {
        title: object.title,
        artist: object.artist,
        medium: object.catalog_medium,
        dimensions: object.catalog_dimensions,
        year: object.catalog_year,
      },
    });

    setStage(payload, "stage_2_provenance", "done", {
      candidate_events: candidateEvents,
      inserted_pending_events: 0,
    });
    setStage(payload, "stage_3_catalog", "done", (researchPackage.catalog_entry || {}) as Record<string, unknown>);
    setStage(payload, "stage_4_valuation", "done", (researchPackage.valuation || {}) as Record<string, unknown>);
    setStage(payload, "stage_5_risk", "done", (researchPackage.risk || {}) as Record<string, unknown>);
    setStage(payload, "stage_6_buyer_targeting", "done", (researchPackage.buyer_targeting || {}) as Record<string, unknown>);
    setStage(payload, "stage_7_monitoring", "done", {
      last_run: ts(),
      next_action: "Use /api/ai/monitoring-scan for scheduled refreshes.",
    });

    payload.stage_outputs.research_package = {
      object_summary: researchPackage.object_summary || {},
      catalog_entry: researchPackage.catalog_entry || {},
      provenance: researchPackage.provenance || {},
      literature_exhibitions: researchPackage.literature_exhibitions || {},
      auction_history_comparables: researchPackage.auction_history_comparables || {},
      valuation: researchPackage.valuation || {},
      risk: researchPackage.risk || {},
      buyer_targeting: researchPackage.buyer_targeting || {},
      sources:
        researchPackage.sources ||
        trustedSources ||
        [{ source: "internal", verified: false, note: "Unverified" }],
    };

    const inserts = candidateEvents
      .map((entry) => entry as Record<string, unknown>)
      .map((entry) => {
        const normalized = {
          event_date: str(entry.event_date),
          event_type: firstString([entry.event_type], "other"),
          description: firstString([entry.description], "Research candidate event"),
          parties: str(entry.parties),
          location: str(entry.location),
          evidence: str(entry.evidence),
          confidence: typeof entry.confidence === "number" ? entry.confidence : 0.5,
        };
        return {
          org_id: profile.org_id,
          object_id: objectId,
          source_extraction_id: null as string | null,
          event_date: normalized.event_date,
          event_type: normalized.event_type,
          description: normalized.description,
          parties: normalized.parties,
          location: normalized.location,
          evidence: normalized.evidence,
          confidence: normalized.confidence,
          status: "pending",
          event_hash: eventHash({
            event_date: normalized.event_date,
            event_type: normalized.event_type,
            description: normalized.description,
            parties: normalized.parties,
            location: normalized.location,
          }),
        };
      });

    const { data: extraction, error: extractionErr } = await admin
      .from("ai_extractions")
      .insert({
        org_id: profile.org_id,
        object_id: objectId,
        created_by: userId,
        source: "manual",
        status: "done",
        extracted_text: prompt,
        extracted_json: payload,
      })
      .select("id, created_at")
      .single();
    if (extractionErr || !extraction?.id) {
      return NextResponse.json({ error: extractionErr?.message || "Unable to save research run" }, { status: 500 });
    }

    if (inserts.length) {
      const rows = inserts.map((row) => ({ ...row, source_extraction_id: extraction.id }));
      const { error: eventErr } = await admin.from("provenance_events").insert(rows);
      if (!eventErr || eventErr.code?.includes("23505") || eventErr.message?.toLowerCase().includes("duplicate")) {
        payload.stage_outputs.stage_2_provenance.inserted_pending_events = rows.length;
      } else {
        payload.stage_status.stage_2_provenance.message = eventErr.message;
      }
      await admin
        .from("ai_extractions")
        .update({ extracted_json: payload })
        .eq("id", extraction.id);
    }

    return NextResponse.json({
      ok: true,
      objectId,
      threadId,
      extractionId: extraction.id,
      messages,
      package: payload.stage_outputs.research_package,
      stage_status: payload.stage_status,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
