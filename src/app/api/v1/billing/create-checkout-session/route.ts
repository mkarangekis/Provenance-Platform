import { NextResponse } from "next/server";
import { getSupabaseAdmin, requireAuthedUserId } from "@/lib/supabaseServer";
import { getStripe, stripePriceId } from "@/lib/stripe";

function trialDays(): number | null {
  const raw = process.env.STRIPE_TRIAL_DAYS;
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

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

    const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const successUrl = `${origin}/subscribe?success=1`;
    const cancelUrl = `${origin}/subscribe?canceled=1`;

    const stripe = getStripe();
    const priceId = stripePriceId();
    const trial = trialDays();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: orgId,
      metadata: {
        org_id: orgId,
        user_id: userId,
      },
      subscription_data: trial ? { trial_period_days: trial } : undefined,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Create Checkout Session Error]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

