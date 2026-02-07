import { NextResponse } from "next/server";
import { getSupabaseAdmin, requireAuthedUserId } from "@/lib/supabaseServer";
import { getStripe } from "@/lib/stripe";

export async function POST(req: Request) {
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
    const { data: ent } = await admin
      .from("billing_entitlements")
      .select("stripe_customer_id")
      .eq("org_id", orgId)
      .maybeSingle();

    const customerId = ent?.stripe_customer_id;
    if (!customerId) {
      return NextResponse.json({ error: "No Stripe customer found for this org yet." }, { status: 400 });
    }

    const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const returnUrl = `${origin}/settings`;

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Create Portal Session Error]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

