import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST() {
  const admin = getAdmin();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  try {
    const { data: recentAlerts } = await admin
      .from("market_alerts")
      .select("id")
      .gte("created_at", since)
      .limit(1);

    if (recentAlerts && recentAlerts.length > 0) {
      return NextResponse.json({ ok: true, message: "Recent alerts already generated." });
    }

    const { data: objects, error } = await admin
      .from("objects")
      .select("id, org_id, title, ai_risk_score")
      .order("ai_risk_score", { ascending: false })
      .limit(5);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const alerts = (objects || []).map((obj) => ({
      org_id: obj.org_id,
      alert_type: "market_shift",
      priority: obj.ai_risk_score && obj.ai_risk_score > 0.7 ? "high" : "normal",
      title: `Market shift detected for ${obj.title || "Artwork"}`,
      description: "Automated scan flagged valuation volatility. Review pricing guidance.",
      related_object_id: obj.id,
      ai_generated: true,
      ai_impact_assessment: "Potential pricing adjustment recommended.",
      ai_relevance_score: obj.ai_risk_score ?? 0.35,
      status: "unread",
      created_at: new Date().toISOString(),
    }));

    if (alerts.length > 0) {
      await admin.from("market_alerts").insert(alerts);
    }

    return NextResponse.json({ ok: true, generated: alerts.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
