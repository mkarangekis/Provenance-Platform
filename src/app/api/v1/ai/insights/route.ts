import { NextResponse } from "next/server";
import { getSupabaseAdmin, requireAuthedUserId } from "@/lib/supabaseServer";
import type { PageContext } from "@/lib/featureFlags";

type InsightResponse = {
  pageContext: PageContext;
  summary: string;
  riskNotes: string[];
  topActions: Array<{ label: string; href: string }>;
  metrics: Array<{ label: string; value: string }>;
};

function clampContext(value: string | null): PageContext {
  switch ((value || "").toLowerCase()) {
    case "overview":
    case "inventory":
    case "ordering":
    case "variance":
    case "settings":
      return value as PageContext;
    default:
      return "overview";
  }
}

export async function GET(req: Request) {
  try {
    const userId = await requireAuthedUserId(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const pageContext = clampContext(url.searchParams.get("pageContext"));

    const admin = getSupabaseAdmin();
    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("org_id")
      .eq("user_id", userId)
      .single();

    if (profileErr || !profile?.org_id) {
      return NextResponse.json({ error: "User has no org" }, { status: 403 });
    }

    const orgId = profile.org_id as string;

    const [pendingEventsRes, queuedAIRes, objectsRes, docsRes] = await Promise.all([
      admin
        .from("provenance_events")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("status", "pending"),
      admin
        .from("ai_extractions")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("status", "queued"),
      admin
        .from("objects")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId),
      admin
        .from("object_docs")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId),
    ]);

    const pendingEvents = pendingEventsRes.count || 0;
    const queuedAI = queuedAIRes.count || 0;
    const objectsTotal = objectsRes.count || 0;
    const docsTotal = docsRes.count || 0;

    const riskNotes: string[] = [];
    if (pendingEvents > 0) riskNotes.push(`${pendingEvents} pending provenance events require specialist review.`);
    if (queuedAI > 10) riskNotes.push(`AI queue is growing (${queuedAI} queued). Consider processing to avoid backlog.`);

    const metrics = [
      { label: "Objects", value: String(objectsTotal) },
      { label: "Docs", value: String(docsTotal) },
      { label: "Pending", value: String(pendingEvents) },
      { label: "AI Queue", value: String(queuedAI) },
    ];

    const topActions =
      pageContext === "settings"
        ? [
            { label: "Invite teammates", href: "/settings" },
            { label: "View audit log", href: "/settings" },
          ]
        : pageContext === "inventory"
        ? [
            { label: "New intake", href: "/objects" },
            { label: "Review pending", href: "/review" },
          ]
        : pageContext === "variance"
        ? [
            { label: "Review risks", href: "/review" },
            { label: "Open monitoring", href: "/monitoring" },
          ]
        : pageContext === "ordering"
        ? [
            { label: "Open valuation", href: "/valuation" },
            { label: "Open catalog", href: "/catalog" },
          ]
        : [
            { label: "Open intake", href: "/intake" },
            { label: "Review timeline", href: "/review" },
          ];

    const summary =
      pendingEvents === 0
        ? "No urgent review items detected. Keep intake moving and run AI extraction on new evidence to maintain coverage."
        : `Prioritize review of ${pendingEvents} pending events. Clearing the queue improves defensibility and downstream catalog/valuation quality.`;

    const payload: InsightResponse = {
      pageContext,
      summary,
      riskNotes,
      topActions,
      metrics,
    };

    return NextResponse.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[AI Insights Error]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

