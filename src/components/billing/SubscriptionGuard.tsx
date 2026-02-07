"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/registrata/GlassCard";
import { Button } from "@/components/ui/button";

type EntitlementStatus = "active" | "trialing" | "inactive" | "past_due" | "canceled" | "unknown";

function isEntitled(status: EntitlementStatus) {
  return status === "active" || status === "trialing";
}

export function SubscriptionGuard({
  enabled,
  accessToken,
  pathname,
  children,
}: {
  enabled: boolean;
  accessToken: string | null;
  pathname: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(enabled);
  const [status, setStatus] = useState<EntitlementStatus>("unknown");
  const [error, setError] = useState("");

  const allowlisted = useMemo(() => {
    const first = pathname.split("/").filter(Boolean)[0] || "";
    return ["", "auth", "setup", "onboarding", "subscribe", "legal", "privacy", "terms", "support"].includes(first);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!enabled || allowlisted) {
        setLoading(false);
        return;
      }
      if (!accessToken) {
        setLoading(true);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/v1/billing/entitlement", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to check entitlement");
        const st = (json?.entitlementStatus || "unknown") as EntitlementStatus;
        if (cancelled) return;
        setStatus(st);
        setLoading(false);

        if (!isEntitled(st)) {
          router.push(`/subscribe?from=${encodeURIComponent(pathname)}&status=${encodeURIComponent(st)}`);
        }
      } catch (e: unknown) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Unknown error");
        setStatus("unknown");
        setLoading(false);
        router.push(`/subscribe?from=${encodeURIComponent(pathname)}&status=unknown`);
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [enabled, allowlisted, accessToken, pathname, router]);

  if (!enabled || allowlisted) return <>{children}</>;

  if (loading) {
    return (
      <div className="space-y-4">
        <GlassCard className="h-28 animate-pulse-soft">
          <div />
        </GlassCard>
        <GlassCard className="h-64 animate-pulse-soft">
          <div />
        </GlassCard>
      </div>
    );
  }

  if (error && !isEntitled(status)) {
    return (
      <GlassCard>
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.3em] text-text-muted">Billing</div>
          <div className="text-lg font-semibold text-white">Subscription required</div>
          <div className="text-sm text-text-secondary">{error}</div>
          <div className="pt-2">
            <Button variant="outline" onClick={() => router.push("/subscribe")}>
              Open subscription page
            </Button>
          </div>
        </div>
      </GlassCard>
    );
  }

  return <>{children}</>;
}
