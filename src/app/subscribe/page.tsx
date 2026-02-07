"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, CreditCard, AlertTriangle, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/registrata/GlassCard";
import { featureFlags } from "@/lib/featureFlags";
import { Notice } from "@/components/Notice";

type Entitlement = {
  entitlementStatus: "active" | "trialing" | "inactive" | "past_due" | "canceled" | "unknown";
  entitlementSource: "stripe" | "db" | "mock";
  trialEnd?: string | null;
  currentPeriodEnd?: string | null;
  customerId?: string | null;
};

function SubscribePageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ent, setEnt] = useState<Entitlement | null>(null);

  const banner = useMemo(() => {
    if (params.get("success")) return { kind: "success" as const, text: "Checkout completed. Updating access now." };
    if (params.get("canceled")) return { kind: "info" as const, text: "Checkout canceled. You can try again anytime." };
    return null;
  }, [params]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token || null;
      if (!accessToken) {
        router.push("/auth");
        return;
      }
      setToken(accessToken);

      try {
        const res = await fetch("/api/v1/billing/entitlement", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load billing status");
        if (!cancelled) setEnt(json as Entitlement);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function startCheckout() {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/v1/billing/create-checkout-session", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Checkout failed");
      if (!json.url) throw new Error("Stripe session URL missing");
      window.location.href = json.url as string;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setBusy(false);
    }
  }

  async function openPortal() {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/v1/billing/create-portal-session", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Portal failed");
      if (!json.url) throw new Error("Portal URL missing");
      window.location.href = json.url as string;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setBusy(false);
    }
  }

  const status = ent?.entitlementStatus || "unknown";
  const entitled = status === "active" || status === "trialing";

  return (
    <div className="min-h-screen bg-ink-950 text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-24 left-1/3 h-96 w-96 rounded-full bg-primary-500/10 blur-[140px]" />
        <div className="absolute bottom-0 right-1/4 h-80 w-80 rounded-full bg-primary-600/10 blur-[150px]" />
      </div>

      <div className="relative mx-auto max-w-5xl px-6 py-14">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary-500/30 bg-primary-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary-200">
              <Sparkles className="h-3.5 w-3.5" />
              Subscription
            </div>
            <h1 className="text-3xl font-semibold text-white md:text-4xl">Unlock Registrata Workspace</h1>
            <p className="max-w-2xl text-sm text-text-secondary md:text-base">
              Subscription gating is enforced when <span className="font-mono">SUBSCRIPTION_GATING=true</span>. When enabled,
              you can sign up, but you cannot access the core app until your subscription is active or trialing.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/dashboard">Back to app</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/settings">Settings</Link>
            </Button>
          </div>
        </div>

        {banner ? (
          <div className="mt-6">
            <Notice kind={banner.kind}>{banner.text}</Notice>
          </div>
        ) : null}

        {error ? (
          <div className="mt-6">
            <Notice kind="error">{error}</Notice>
          </div>
        ) : null}

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          <GlassCard className="lg:col-span-2">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-text-muted">Plan</p>
              <h2 className="text-xl font-semibold text-white">Pro tier (trial eligible)</h2>
              <p className="text-sm text-text-secondary">
                Trial and billing terms are controlled by your Stripe configuration and optional{" "}
                <span className="font-mono">STRIPE_TRIAL_DAYS</span>.
              </p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                "Subscription gating enforcement",
                "AI extraction workflows",
                "Audit log and team roles",
                "Executive dashboard + charts",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2 rounded-2xl border border-border-muted bg-surface px-4 py-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary-300" />
                  <div className="text-sm text-text-secondary">{item}</div>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-text-muted">Access</p>
              <h2 className="text-xl font-semibold text-white">Current status</h2>
              <p className="text-sm text-text-secondary">
                {loading ? "Checking entitlement..." : `Status: ${status}`}
              </p>
            </div>

            <div className="mt-6 space-y-3">
              {!featureFlags.subscriptionGating ? (
                <div className="rounded-2xl border border-border-muted bg-surface px-4 py-3 text-sm text-text-secondary">
                  <div className="font-semibold text-white">Gating disabled</div>
                  <div className="mt-1 text-xs text-text-muted">
                    Set <span className="font-mono">SUBSCRIPTION_GATING=true</span> to enforce paywall redirects.
                  </div>
                </div>
              ) : null}

              {entitled ? (
                <Button className="w-full" asChild>
                  <Link href="/dashboard">Continue to dashboard</Link>
                </Button>
              ) : (
                <Button className="w-full" onClick={startCheckout} disabled={busy || loading}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  {busy ? "Starting..." : "Start trial / Subscribe"}
                </Button>
              )}

              {status === "past_due" ? (
                <Button className="w-full" variant="outline" onClick={openPortal} disabled={busy || loading}>
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Update payment method
                </Button>
              ) : (
                <Button className="w-full" variant="outline" onClick={openPortal} disabled={busy || loading}>
                  Manage billing
                </Button>
              )}

              <div className="rounded-2xl border border-border-muted bg-surface px-4 py-3 text-xs text-text-muted">
                Webhook required: <span className="font-mono">/api/v1/billing/webhook</span>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

export default function SubscribePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-ink-950 text-white">
          <div className="mx-auto max-w-5xl px-6 py-14">
            <GlassCard className="h-40 animate-pulse-soft">
              <div />
            </GlassCard>
          </div>
        </div>
      }
    >
      <SubscribePageInner />
    </Suspense>
  );
}
