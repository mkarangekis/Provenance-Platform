import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import crypto from "crypto";

type StageStatus = "queued" | "processing" | "done" | "failed";
type StageState = {
  status: StageStatus;
  updated_at: string;
  message?: string;
};

type StageId =
  | "stage_1_intake"
  | "stage_2_provenance"
  | "stage_3_catalog"
  | "stage_4_valuation"
  | "stage_5_risk"
  | "stage_6_buyer_targeting"
  | "stage_7_monitoring";

type PipelineRunPayload = {
  run_type: "full_catalog";
  deep_research_enabled: boolean;
  stage_status: Record<StageId, StageState>;
  stage_outputs: Record<StageId, Record<string, unknown>>;
  last_stage: StageId | null;
  last_monitored_at: string | null;
};

const STAGES: Array<{ id: StageId; label: string }> = [
  { id: "stage_1_intake", label: "Artwork Intake" },
  { id: "stage_2_provenance", label: "Provenance Research" },
  { id: "stage_3_catalog", label: "Catalog Production" },
  { id: "stage_4_valuation", label: "Valuation & Reserve" },
  { id: "stage_5_risk", label: "Authenticity & Risk" },
  { id: "stage_6_buyer_targeting", label: "Buyer Targeting" },
  { id: "stage_7_monitoring", label: "Monitoring & Feedback" },
];

function envTruthy(value: unknown): boolean {
  if (value == null) return false;
  const v = String(value).trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function isPipelineEnabled(): boolean {
  return envTruthy(process.env.REGISTRATA_PIPELINE_V2);
}

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

function nowIso() {
  return new Date().toISOString();
}

function makeInitialRun(deepResearchEnabled: boolean): PipelineRunPayload {
  const ts = nowIso();
  const stageStatus = STAGES.reduce((acc, stage) => {
    acc[stage.id] = { status: "queued", updated_at: ts };
    return acc;
  }, {} as Record<StageId, StageState>);

  return {
    run_type: "full_catalog",
    deep_research_enabled: deepResearchEnabled,
    stage_status: stageStatus,
    stage_outputs: {
      stage_1_intake: {},
      stage_2_provenance: {},
      stage_3_catalog: {},
      stage_4_valuation: {},
      stage_5_risk: {},
      stage_6_buyer_targeting: {},
      stage_7_monitoring: {},
    },
    last_stage: null,
    last_monitored_at: null,
  };
}

function setStage(
  run: PipelineRunPayload,
  stageId: StageId,
  status: StageStatus,
  output?: Record<string, unknown>,
  message?: string
) {
  run.stage_status[stageId] = {
    status,
    updated_at: nowIso(),
    ...(message ? { message } : {}),
  };
  if (output) {
    run.stage_outputs[stageId] = output;
  }
  run.last_stage = stageId;
}

async function persistRun(
  admin: ReturnType<typeof getAdmin>,
  runId: string,
  run: PipelineRunPayload,
  status: "processing" | "done" | "failed",
  extractedText?: string,
  error?: string
) {
  await admin
    .from("ai_extractions")
    .update({
      status,
      extracted_json: run,
      ...(typeof extractedText === "string" ? { extracted_text: extractedText } : {}),
      ...(error ? { error } : { error: null }),
      ...(status === "done" ? { next_attempt_at: null } : {}),
    })
    .eq("id", runId);
}

function toStr(value: unknown): string | null {
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

function pickFirstString(...values: unknown[]): string | null {
  for (const value of values) {
    const normalized = toStr(value);
    if (normalized) return normalized;
  }
  return null;
}

function scoreContact(interests: string[] | null, text: string): number {
  if (!interests || !interests.length) return 0.2;
  const lower = text.toLowerCase();
  const hits = interests.filter((entry) => lower.includes(entry.toLowerCase())).length;
  return Math.min(0.95, 0.3 + hits * 0.18);
}

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

export async function GET(req: Request) {
  if (!isPipelineEnabled()) {
    return NextResponse.json({ error: "Pipeline v2 disabled" }, { status: 404 });
  }

  const url = new URL(req.url);
  const objectId = url.searchParams.get("objectId");
  const userId = url.searchParams.get("userId");

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

  const { data: obj, error: objErr } = await admin
    .from("objects")
    .select("id, org_id")
    .eq("id", objectId)
    .single();

  if (objErr || !obj) {
    return NextResponse.json({ error: "Object not found" }, { status: 404 });
  }

  if (obj.org_id !== profile.org_id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { data: runs } = await admin
    .from("ai_extractions")
    .select("id, status, created_at, updated_at, error, extracted_json")
    .eq("object_id", objectId)
    .order("created_at", { ascending: false })
    .limit(30);

  const latest = (runs || []).find((row) => {
    const extracted = row.extracted_json as Record<string, unknown> | null;
    return extracted?.run_type === "full_catalog";
  });

  return NextResponse.json({
    ok: true,
    enabled: true,
    run: latest
      ? {
          id: latest.id,
          status: latest.status,
          created_at: latest.created_at,
          updated_at: latest.updated_at,
          error: latest.error,
          data: latest.extracted_json,
        }
      : null,
  });
}

export async function POST(req: Request) {
  if (!isPipelineEnabled()) {
    return NextResponse.json({ error: "Pipeline v2 disabled" }, { status: 404 });
  }

  const admin = getAdmin();
  let runId = "";
  let run = makeInitialRun(false);
  let aggregateText = "";

  try {
    const body = await req.json();
    const objectId = toStr(body.objectId);
    const userId = toStr(body.userId);
    const deepResearchEnabled = Boolean(body.deepResearchEnabled);

    if (!objectId || !userId) {
      return NextResponse.json({ error: "Missing objectId or userId" }, { status: 400 });
    }

    run = makeInitialRun(deepResearchEnabled);

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("org_id")
      .eq("user_id", userId)
      .single();

    if (profileErr || !profile?.org_id) {
      return NextResponse.json({ error: "User has no org" }, { status: 403 });
    }

    const { data: obj, error: objErr } = await admin
      .from("objects")
      .select("*")
      .eq("id", objectId)
      .single();

    if (objErr || !obj) {
      return NextResponse.json({ error: "Object not found" }, { status: 404 });
    }

    if (obj.org_id !== profile.org_id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { data: insertedRun, error: runErr } = await admin
      .from("ai_extractions")
      .insert({
        org_id: profile.org_id,
        object_id: objectId,
        created_by: userId,
        source: "manual",
        status: "processing",
        extracted_json: run,
      })
      .select("id")
      .single();

    if (runErr || !insertedRun?.id) {
      return NextResponse.json({ error: runErr?.message || "Unable to create pipeline run" }, { status: 400 });
    }
    runId = insertedRun.id;

    const [{ data: docs }, { data: historicalExtractions }, { data: allEvents }] = await Promise.all([
      admin.from("object_docs").select("*").eq("object_id", objectId).order("created_at", { ascending: false }),
      admin
        .from("ai_extractions")
        .select("id, extracted_text, extracted_json, status, source, created_at")
        .eq("object_id", objectId)
        .neq("id", runId)
        .order("created_at", { ascending: false })
        .limit(30),
      admin
        .from("provenance_events")
        .select("*")
        .eq("object_id", objectId)
        .order("event_date", { ascending: true }),
    ]);

    aggregateText = (historicalExtractions || [])
      .filter((row) => row.status === "done")
      .map((row) => (typeof row.extracted_text === "string" ? row.extracted_text.trim() : ""))
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 120000);

    if (!aggregateText) {
      aggregateText = [obj.description || "", obj.title || "", obj.artist || ""].filter(Boolean).join("\n");
    }

    setStage(run, "stage_1_intake", "processing");
    await persistRun(admin, runId, run, "processing", aggregateText);

    const extractionHints = (historicalExtractions || [])
      .map((row) => (row.extracted_json && typeof row.extracted_json === "object" ? row.extracted_json : null))
      .filter(Boolean) as Array<Record<string, unknown>>;

    const normalized = {
      title: pickFirstString(obj.title, extractionHints[0]?.title, extractionHints[0]?.catalog_title),
      artist: pickFirstString(obj.artist, extractionHints[0]?.artist),
      medium: pickFirstString(obj.catalog_medium, extractionHints[0]?.medium),
      dimensions: pickFirstString(obj.catalog_dimensions, extractionHints[0]?.dimensions),
      year: pickFirstString(obj.catalog_year, extractionHints[0]?.year),
      inscriptions_or_marks: pickFirstString(extractionHints[0]?.inscriptions, extractionHints[0]?.marks),
    };

    const intakeSummary = [
      `Title: ${normalized.title || "Unknown"}`,
      `Artist: ${normalized.artist || "Unknown"}`,
      `Medium: ${normalized.medium || "Unknown"}`,
      `Dimensions: ${normalized.dimensions || "Unknown"}`,
      `Date: ${normalized.year || "Unknown"}`,
      `Marks: ${normalized.inscriptions_or_marks || "No explicit marks extracted"}`,
      `Documents: ${(docs || []).length}`,
    ].join(" | ");

    await admin
      .from("objects")
      .update({
        title: normalized.title || obj.title,
        artist: normalized.artist || obj.artist,
        workflow_stage: 1,
      })
      .eq("id", objectId);

    setStage(run, "stage_1_intake", "done", {
      normalized_fields: normalized,
      intake_summary: intakeSummary,
    });
    await persistRun(admin, runId, run, "processing", aggregateText);

    setStage(run, "stage_2_provenance", "processing");
    await persistRun(admin, runId, run, "processing", aggregateText);

    const provenanceCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are a provenance analyst. Return JSON only with suggested_events[]. " +
            "Each event must include event_date, event_type, description, parties, location, evidence, confidence.",
        },
        {
          role: "user",
          content: JSON.stringify({
            object: { title: obj.title, artist: obj.artist, description: obj.description },
            existing_events: allEvents || [],
            extracted_text: aggregateText,
          }),
        },
      ],
    });

    let parsedEvents: Array<Record<string, unknown>> = [];
    try {
      const parsed = JSON.parse(provenanceCompletion.choices[0]?.message?.content || "{}");
      parsedEvents = Array.isArray(parsed?.suggested_events) ? parsed.suggested_events : [];
    } catch {
      parsedEvents = [];
    }

    const inserts = parsedEvents
      .map((entry) => ({
        event_date: toStr(entry.event_date),
        event_type: pickFirstString(entry.event_type, "other") as string,
        description: pickFirstString(entry.description, "Undated provenance event") as string,
        parties: toStr(entry.parties),
        location: toStr(entry.location),
        evidence: toStr(entry.evidence),
        confidence:
          typeof entry.confidence === "number"
            ? Math.max(0, Math.min(1, entry.confidence))
            : 0.5,
      }))
      .filter((entry) => entry.description && entry.event_type)
      .map((entry) => ({
        org_id: profile.org_id,
        object_id: objectId,
        event_date: entry.event_date,
        event_type: entry.event_type,
        description: entry.description,
        parties: entry.parties,
        location: entry.location,
        evidence: entry.evidence,
        confidence: entry.confidence,
        status: "pending",
        source_extraction_id: runId,
        event_hash: eventHash({
          event_date: entry.event_date,
          event_type: entry.event_type,
          description: entry.description,
          parties: entry.parties,
          location: entry.location,
        }),
      }));

    let createdEvents = 0;
    if (inserts.length) {
      const { error: insertErr } = await admin.from("provenance_events").insert(inserts);
      if (!insertErr || insertErr.code?.includes("23505") || insertErr.message?.toLowerCase().includes("duplicate")) {
        createdEvents = inserts.length;
      } else {
        throw new Error(insertErr.message);
      }
    }

    setStage(run, "stage_2_provenance", "done", {
      candidates_generated: parsedEvents.length,
      pending_events_inserted: createdEvents,
      linked_source_extraction_id: runId,
    });
    await admin.from("objects").update({ workflow_stage: 2 }).eq("id", objectId);
    await persistRun(admin, runId, run, "processing", aggregateText);

    setStage(run, "stage_3_catalog", "processing");
    await persistRun(admin, runId, run, "processing", aggregateText);

    const { data: timelineEvents } = await admin
      .from("provenance_events")
      .select("*")
      .eq("object_id", objectId)
      .in("status", ["approved", "pending"])
      .order("event_date", { ascending: true });

    const catalogCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.15,
      messages: [
        {
          role: "system",
          content:
            "You are a senior auction house catalog specialist. Use internal data only. " +
            "Return JSON with heading_line, description, provenance (array), literature (array), exhibitions (array), notes, confidence, evidence_map.",
        },
        {
          role: "user",
          content: JSON.stringify({
            object: {
              title: obj.title,
              artist: obj.artist,
              description: obj.description,
              medium: normalized.medium,
              dimensions: normalized.dimensions,
              year: normalized.year,
            },
            events: timelineEvents || [],
            extracted_text: aggregateText,
            docs: (docs || []).map((doc) => ({
              file: doc.original_filename || doc.storage_path,
              doc_type: doc.doc_type,
            })),
          }),
        },
      ],
    });

    let catalogParsed: Record<string, unknown> = {};
    try {
      catalogParsed = JSON.parse(catalogCompletion.choices[0]?.message?.content || "{}");
    } catch {
      catalogParsed = {};
    }

    const provenanceList = Array.isArray(catalogParsed.provenance)
      ? catalogParsed.provenance.filter((item) => typeof item === "string")
      : (timelineEvents || []).map((evt) => `${evt.event_date || "n.d."} - ${evt.description}`);
    const literatureList = Array.isArray(catalogParsed.literature)
      ? catalogParsed.literature.filter((item) => typeof item === "string")
      : [];
    const exhibitionsList = Array.isArray(catalogParsed.exhibitions)
      ? catalogParsed.exhibitions.filter((item) => typeof item === "string")
      : [];

    const headingLine =
      pickFirstString(catalogParsed.heading_line) ||
      `${normalized.artist || "Unknown Artist"}, ${normalized.title || obj.title}, ${normalized.medium || "Unknown medium"}, ${normalized.dimensions || "Unknown dimensions"}, ${normalized.year || "n.d."}`;
    const descriptionText = pickFirstString(catalogParsed.description, obj.description) || "";
    const specialistNotes = pickFirstString(catalogParsed.notes);

    const metadata = {
      ...(obj.metadata || {}),
      catalog: {
        generatedAt: nowIso(),
        result: {
          heading_line: headingLine,
          description: descriptionText,
          provenance: provenanceList,
          literature: literatureList,
          exhibitions: exhibitionsList,
          notes: specialistNotes,
        },
      },
    };

    await admin
      .from("objects")
      .update({
        catalog_title: normalized.title || obj.title,
        catalog_year: normalized.year,
        catalog_medium: normalized.medium,
        catalog_dimensions: normalized.dimensions,
        catalog_description: descriptionText,
        catalog_provenance_summary: provenanceList.join("\n"),
        catalog_status: "draft",
        catalog_generated_at: nowIso(),
        metadata,
        workflow_stage: 3,
      })
      .eq("id", objectId);

    await admin.from("catalog_entries").insert({
      org_id: profile.org_id,
      object_id: objectId,
      title_display: normalized.title || obj.title,
      artist_display: normalized.artist || obj.artist,
      date_display: normalized.year,
      medium_display: normalized.medium,
      dimensions_display: normalized.dimensions,
      description_short: descriptionText,
      provenance_text: provenanceList.join("\n"),
      literature_text: literatureList.join("\n"),
      exhibition_text: exhibitionsList.join("\n"),
      condition_summary: specialistNotes,
      ai_generated: true,
      ai_model: "gpt-4o-mini",
      status: "draft",
    });

    setStage(run, "stage_3_catalog", "done", {
      heading_line: headingLine,
      description: descriptionText,
      provenance: provenanceList,
      literature: literatureList,
      exhibitions: exhibitionsList,
      specialist_remarks: specialistNotes,
      confidence: catalogParsed.confidence ?? 0.6,
      evidence_map: catalogParsed.evidence_map ?? {},
    });
    await persistRun(admin, runId, run, "processing", aggregateText);

    setStage(run, "stage_4_valuation", "processing");
    await persistRun(admin, runId, run, "processing", aggregateText);

    const artist = normalized.artist || obj.artist;
    let comps: Array<{ object_id: string; title: string; estimate_low: number | null; estimate_high: number | null }> = [];
    if (artist) {
      const { data: compObjects } = await admin
        .from("objects")
        .select("id, title, estimate_low, estimate_high")
        .eq("org_id", profile.org_id)
        .eq("artist", artist)
        .neq("id", objectId)
        .limit(8);
      comps = (compObjects || []).map((entry) => ({
        object_id: entry.id,
        title: entry.title,
        estimate_low: entry.estimate_low,
        estimate_high: entry.estimate_high,
      }));
    }

    const compMidpoints = comps
      .map((comp) => {
        if (typeof comp.estimate_low === "number" && typeof comp.estimate_high === "number") {
          return (comp.estimate_low + comp.estimate_high) / 2;
        }
        return null;
      })
      .filter((value): value is number => typeof value === "number");

    const marketMid = median(compMidpoints) || (typeof obj.estimate_low === "number" && typeof obj.estimate_high === "number"
      ? (obj.estimate_low + obj.estimate_high) / 2
      : 50000);
    const estimateLow = Math.max(1000, Math.round(marketMid * 0.8));
    const estimateHigh = Math.max(estimateLow + 1000, Math.round(marketMid * 1.2));

    await admin.from("valuations").insert({
      org_id: profile.org_id,
      object_id: objectId,
      valuation_type: "auction_estimate",
      purpose: "reserve_guidance",
      value_low: estimateLow,
      value_mid: Math.round((estimateLow + estimateHigh) / 2),
      value_high: estimateHigh,
      currency: obj.estimate_currency || "USD",
      valuation_method: "internal_comps",
      comparable_sales_count: comps.length,
      ai_generated: true,
      ai_model: "pipeline_v2",
      ai_confidence: comps.length > 0 ? 0.72 : 0.45,
      ai_factors: {
        comps,
        rationale:
          comps.length > 0
            ? "Estimated from internal artist-level comparables."
            : "No internal comparables found; fallback baseline estimate used.",
      },
      status: "draft",
    });

    await admin
      .from("objects")
      .update({
        estimate_low: estimateLow,
        estimate_high: estimateHigh,
        workflow_stage: 4,
      })
      .eq("id", objectId);

    setStage(run, "stage_4_valuation", "done", {
      estimate_low: estimateLow,
      estimate_high: estimateHigh,
      rationale:
        comps.length > 0
          ? "Internal comparables informed estimate range."
          : "No internal comparables found.",
      comps: comps.length ? comps : [{ note: "none found" }],
    });
    await persistRun(admin, runId, run, "processing", aggregateText);

    setStage(run, "stage_5_risk", "processing");
    await persistRun(admin, runId, run, "processing", aggregateText);

    const pendingCount = (timelineEvents || []).filter((evt) => evt.status === "pending").length;
    const approvedCount = (timelineEvents || []).filter((evt) => evt.status === "approved").length;
    const flags: string[] = [];
    if (approvedCount === 0) flags.push("No approved provenance chain");
    if (pendingCount > 3) flags.push("High pending provenance volume");
    if (!normalized.inscriptions_or_marks) flags.push("No marks/signature evidence extracted");
    if (aggregateText.length < 200) flags.push("Limited documentary evidence");

    const riskScore = Math.max(0, Math.min(100, 25 + pendingCount * 8 + (approvedCount === 0 ? 20 : 0) + flags.length * 6));
    const riskConfidence = Math.min(0.95, 0.5 + (timelineEvents?.length || 0) * 0.04);

    await admin.from("risk_assessments").insert({
      org_id: profile.org_id,
      object_id: objectId,
      overall_risk_score: Number((riskScore / 100).toFixed(3)),
      provenance_risk_score: Number(Math.min(1, (pendingCount + 1) / 5).toFixed(3)),
      authenticity_risk_score: Number((!normalized.inscriptions_or_marks ? 0.65 : 0.35).toFixed(3)),
      legal_risk_score: Number((approvedCount === 0 ? 0.55 : 0.3).toFixed(3)),
      market_risk_score: Number((comps.length === 0 ? 0.5 : 0.32).toFixed(3)),
      flags: flags.map((flag) => ({ label: flag })),
      provenance_gaps: approvedCount === 0 ? [{ label: "No approved origin baseline" }] : [],
      ai_generated: true,
      ai_model: "pipeline_v2",
      ai_reasoning: "Rule-based risk synthesis from provenance and document completeness.",
      status: "pending",
    });

    await admin
      .from("objects")
      .update({ ai_risk_score: Number((riskScore / 100).toFixed(3)), workflow_stage: 5 })
      .eq("id", objectId);

    setStage(run, "stage_5_risk", "done", {
      risk_score: riskScore,
      flags,
      rationale: "Risk score derived from provenance gaps, evidence coverage, and approval state.",
      confidence: Number(riskConfidence.toFixed(2)),
    });
    await persistRun(admin, runId, run, "processing", aggregateText);

    setStage(run, "stage_6_buyer_targeting", "processing");
    await persistRun(admin, runId, run, "processing", aggregateText);

    const { data: contacts } = await admin
      .from("crm_contacts")
      .select("id, first_name, last_name, collecting_interests, client_tier")
      .eq("org_id", profile.org_id)
      .limit(20);

    const targetingText = [
      normalized.artist || "",
      normalized.title || obj.title || "",
      normalized.medium || "",
      descriptionText,
      ...provenanceList,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const rankedContacts = (contacts || [])
      .map((contact) => ({
        id: contact.id,
        name: `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || "Unnamed Contact",
        tier: contact.client_tier || "standard",
        collecting_interests: contact.collecting_interests || [],
        score: scoreContact(contact.collecting_interests, targetingText),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (rankedContacts.length > 0) {
      await admin.from("buyer_matches").upsert(
        rankedContacts.map((contact) => ({
          org_id: profile.org_id,
          object_id: objectId,
          contact_id: contact.id,
          match_score: Number(contact.score.toFixed(2)),
          match_factors: {
            tier: contact.tier,
            collecting_interests: contact.collecting_interests,
          },
          ai_reasoning: "Matched using internal collecting interests and object profile alignment.",
          ai_outreach_suggestion: `Share a private preview of ${normalized.title || obj.title} with provenance highlights.`,
          status: "suggested",
        })),
        { onConflict: "object_id,contact_id" }
      );
    }

    const outreachDraft = `Subject: Private Preview - ${normalized.title || obj.title}

Hi {{recipient_name}},

We are preparing ${normalized.artist || "an important artist"}'s ${normalized.title || obj.title} for catalog release.
Estimate guidance: ${estimateLow.toLocaleString()}-${estimateHigh.toLocaleString()} ${obj.estimate_currency || "USD"}.
Key provenance points:
${provenanceList.slice(0, 3).map((line) => `- ${line}`).join("\n") || "- Provenance currently under review"}

If this aligns with your collecting interests, we can share the full internal dossier.
`;

    setStage(run, "stage_6_buyer_targeting", "done", {
      matches:
        rankedContacts.length > 0
          ? rankedContacts.map((entry) => ({
              name: entry.name,
              score: Number(entry.score.toFixed(2)),
              interests: entry.collecting_interests,
            }))
          : [],
      personas:
        rankedContacts.length === 0
          ? ["Institutional modern buyer", "Private collector (mid-market)", "Cross-category speculative buyer"]
          : [],
      tags:
        rankedContacts.length === 0
          ? [normalized.artist || "artist-led", normalized.medium || "fine-art", "catalog-priority"]
          : [],
      outreach_draft: outreachDraft,
    });
    await admin.from("objects").update({ workflow_stage: 6 }).eq("id", objectId);
    await persistRun(admin, runId, run, "processing", aggregateText);

    setStage(run, "stage_7_monitoring", "processing");
    await persistRun(admin, runId, run, "processing", aggregateText);

    const { data: alerts } = await admin
      .from("market_alerts")
      .select("id, priority, title, created_at")
      .eq("related_object_id", objectId)
      .order("created_at", { ascending: false })
      .limit(5);

    const monitoredAt = nowIso();
    run.last_monitored_at = monitoredAt;
    setStage(run, "stage_7_monitoring", "done", {
      scheduler_route: "/api/ai/monitoring-scan",
      recent_alerts: alerts || [],
      refreshed_at: monitoredAt,
      internal_only: true,
    });
    await admin.from("objects").update({ workflow_stage: 7 }).eq("id", objectId);

    await persistRun(admin, runId, run, "done", aggregateText);

    return NextResponse.json({
      ok: true,
      runId,
      status: "done",
      stage_status: run.stage_status,
      stage_outputs: run.stage_outputs,
      last_stage: run.last_stage,
      last_monitored_at: run.last_monitored_at,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (runId) {
      const failedStage = run.last_stage || "stage_1_intake";
      setStage(run, failedStage, "failed", run.stage_outputs[failedStage], message);
      await persistRun(admin, runId, run, "failed", aggregateText, message);
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
