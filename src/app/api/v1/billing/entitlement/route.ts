import { NextResponse } from "next/server";
import { getSupabaseAdmin, requireAuthedUserId } from "@/lib/supabaseServer";

export type EntitlementStatus = "active" | "trialing" | "inactive" | "past_due" | "canceled" | "unknown";
export type EntitlementSource = "stripe" | "db" | "mock";

function normalizeStatus(value: unknown): EntitlementStatus {
  const v = String(value || "").toLowerCase();
  if (v === "active") return "active";
  if (v === "trialing") return "trialing";
  if (v === "inactive") return "inactive";
  if (v === "past_due") return "past_due";
  if (v === "canceled") return "canceled";
  return "unknown";
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
      return NextResponse.json(
        {
          entitlementStatus: "unknown",
          entitlementSource: "db",
          error: "User has no org",
        },
        { status: 200 }
      );
    }

    const orgId = profile.org_id as string;

    const { data: row, error } = await admin
      .from("billing_entitlements")
      .select("entitlement_status, trial_end, current_period_end, stripe_customer_id")
      .eq("org_id", orgId)
      .maybeSingle();

    // If migration hasn't been applied yet, return unknown instead of hard failing.
    if (error && /billing_entitlements/i.test(error.message)) {
      return NextResponse.json(
        {
          entitlementStatus: "unknown",
          entitlementSource: "db",
          orgId,
          userId,
          message: "Billing table not initialized yet.",
        },
        { status: 200 }
      );
    }

    const entitlementStatus = normalizeStatus(row?.entitlement_status ?? "unknown");

    return NextResponse.json({
      entitlementStatus,
      entitlementSource: "db",
      orgId,
      userId,
      trialEnd: row?.trial_end ?? null,
      currentPeriodEnd: row?.current_period_end ?? null,
      customerId: row?.stripe_customer_id ?? null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Entitlement Error]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

