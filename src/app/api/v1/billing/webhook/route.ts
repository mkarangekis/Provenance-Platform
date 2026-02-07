import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import type Stripe from "stripe";

function stripeToEntitlementStatus(status: Stripe.Subscription.Status): string {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      return "inactive";
  }
}

async function upsertEntitlement(params: {
  orgId: string;
  customerId?: string | null;
  subscriptionId?: string | null;
  status: string;
  trialEnd?: number | null;
  currentPeriodEnd?: number | null;
}) {
  const admin = getSupabaseAdmin();
  const { orgId, customerId, subscriptionId, status, trialEnd, currentPeriodEnd } = params;
  const toTs = (unix: number | null | undefined) => (unix ? new Date(unix * 1000).toISOString() : null);

  await admin.from("billing_entitlements").upsert(
    {
      org_id: orgId,
      stripe_customer_id: customerId ?? null,
      stripe_subscription_id: subscriptionId ?? null,
      entitlement_status: status,
      trial_end: toTs(trialEnd),
      current_period_end: toTs(currentPeriodEnd),
    },
    { onConflict: "org_id" }
  );
}

export async function POST(req: Request) {
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 });

    const stripe = getStripe();
    const sig = req.headers.get("stripe-signature");
    if (!sig) return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });

    const rawBody = await req.text();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, secret);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Invalid signature";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId = (session.metadata?.org_id || session.client_reference_id) as string | undefined;
      if (!orgId) return NextResponse.json({ ok: true });

      const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;
      const customerId = typeof session.customer === "string" ? session.customer : null;

      if (subscriptionId) {
        const sub = (await stripe.subscriptions.retrieve(subscriptionId)) as unknown as Stripe.Subscription;
        await upsertEntitlement({
          orgId,
          customerId,
          subscriptionId,
          status: stripeToEntitlementStatus(sub.status),
          trialEnd: (sub as any).trial_end ?? null,
          currentPeriodEnd: (sub as any).current_period_end ?? null,
        });
      } else {
        await upsertEntitlement({
          orgId,
          customerId,
          subscriptionId: null,
          status: "inactive",
        });
      }

      return NextResponse.json({ ok: true });
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : null;
      if (!customerId) return NextResponse.json({ ok: true });

      const admin = getSupabaseAdmin();
      const { data: ent } = await admin
        .from("billing_entitlements")
        .select("org_id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();

      const orgId = ent?.org_id as string | undefined;
      if (!orgId) return NextResponse.json({ ok: true });

      await upsertEntitlement({
        orgId,
        customerId,
        subscriptionId: sub.id,
        status: stripeToEntitlementStatus(sub.status),
        trialEnd: (sub as any).trial_end ?? null,
        currentPeriodEnd: (sub as any).current_period_end ?? null,
      });

      return NextResponse.json({ ok: true });
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
      if (!customerId) return NextResponse.json({ ok: true });

      const admin = getSupabaseAdmin();
      const { data: ent } = await admin
        .from("billing_entitlements")
        .select("org_id, stripe_subscription_id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();

      if (!ent?.org_id) return NextResponse.json({ ok: true });

      await upsertEntitlement({
        orgId: ent.org_id as string,
        customerId,
        subscriptionId: (ent.stripe_subscription_id as string) || null,
        status: "past_due",
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Stripe Webhook Error]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
