import { NextResponse } from "next/server";
import { getSupabaseAdmin, requireAuthedUserId } from "@/lib/supabaseServer";

type Point = { date: string; value: number };

function toISODate(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function buildDailySeries(rows: Array<{ created_at?: string | null }>, days: number): Point[] {
  const counts = new Map<string, number>();
  rows.forEach((r) => {
    if (!r.created_at) return;
    const dt = new Date(r.created_at);
    if (Number.isNaN(dt.getTime())) return;
    const key = toISODate(dt);
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  const out: Point[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    d.setUTCDate(d.getUTCDate() - i);
    const key = toISODate(d);
    out.push({ date: key, value: counts.get(key) || 0 });
  }
  return out;
}

export async function GET(req: Request) {
  try {
    const userId = await requireAuthedUserId(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    const days = 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const [objectsRes, aiRes, statusesRes] = await Promise.all([
      admin
        .from("objects")
        .select("created_at")
        .eq("org_id", orgId)
        .gte("created_at", since),
      admin
        .from("ai_extractions")
        .select("created_at")
        .eq("org_id", orgId)
        .gte("created_at", since),
      admin.from("objects").select("status").eq("org_id", orgId),
    ]);

    if (objectsRes.error) {
      return NextResponse.json({ error: objectsRes.error.message }, { status: 500 });
    }
    if (aiRes.error) {
      return NextResponse.json({ error: aiRes.error.message }, { status: 500 });
    }
    if (statusesRes.error) {
      return NextResponse.json({ error: statusesRes.error.message }, { status: 500 });
    }

    const intakeTrend = buildDailySeries(objectsRes.data || [], days);
    const aiTrend = buildDailySeries(aiRes.data || [], days);

    const byStatus: Record<string, number> = {};
    (statusesRes.data || []).forEach((r: { status?: string | null }) => {
      const key = r.status || "intake";
      byStatus[key] = (byStatus[key] || 0) + 1;
    });

    return NextResponse.json({
      intakeTrend,
      aiTrend,
      statusMix: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Analytics Overview Error]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

