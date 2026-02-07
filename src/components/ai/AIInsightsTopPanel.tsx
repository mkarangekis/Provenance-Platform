"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Copy, Sparkles, AlertTriangle } from "lucide-react";
import { GlassCard } from "@/components/registrata/GlassCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import type { PageContext } from "@/lib/featureFlags";
import { toast } from "sonner";

type InsightPayload = {
  pageContext: PageContext;
  summary: string;
  riskNotes: string[];
  topActions: Array<{ label: string; href: string }>;
  metrics: Array<{ label: string; value: string }>;
};

export function AIInsightsTopPanel({
  pageContext,
  orgId,
  locationId,
  primaryMetrics,
  recommendations,
}: {
  pageContext: PageContext;
  orgId?: string | null;
  locationId?: string | null;
  primaryMetrics?: Array<{ label: string; value: string }>;
  recommendations?: string[];
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<InsightPayload | null>(null);

  const mergedMetrics = useMemo(() => {
    if (primaryMetrics?.length) return primaryMetrics;
    return data?.metrics || [];
  }, [primaryMetrics, data]);

  const mergedRecommendations = useMemo(() => {
    if (recommendations?.length) return recommendations;
    return data?.riskNotes || [];
  }, [recommendations, data]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/v1/ai/insights?pageContext=${encodeURIComponent(pageContext)}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load AI insights");
        if (!cancelled) setData(json as InsightPayload);
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
  }, [pageContext, orgId, locationId]);

  const summary = data?.summary || "Generating insights from your latest workspace activity.";

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(summary);
      toast.success("Copied AI summary");
    } catch {
      toast.error("Unable to copy", { description: "Clipboard permission denied." });
    }
  }

  return (
    <GlassCard className="p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/15 text-primary-200">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.3em] text-text-muted">AI Insights</p>
              <h3 className="truncate text-lg font-semibold text-white">Copilot Summary</h3>
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">
              <div className="h-4 w-4/5 rounded bg-surface animate-pulse-soft" />
              <div className="h-4 w-3/5 rounded bg-surface animate-pulse-soft" />
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-border-muted bg-surface px-4 py-3 text-sm text-text-secondary">
              <div className="font-semibold text-white">Unable to load AI insights</div>
              <div className="mt-1 text-xs text-text-muted">{error}</div>
            </div>
          ) : (
            <p className="text-sm text-text-secondary">{summary}</p>
          )}

          {mergedRecommendations.length > 0 ? (
            <div className="flex flex-col gap-2 rounded-2xl border border-border-muted bg-surface px-4 py-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-text-muted">
                <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                Risk notes
              </div>
              <ul className="space-y-1 text-sm text-text-secondary">
                {mergedRecommendations.slice(0, 3).map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="flex w-full flex-col gap-3 lg:w-[360px]">
          <div className="grid grid-cols-2 gap-3">
            {mergedMetrics.length === 0 ? (
              <>
                <div className="h-16 rounded-2xl border border-border-muted bg-surface animate-pulse-soft" />
                <div className="h-16 rounded-2xl border border-border-muted bg-surface animate-pulse-soft" />
              </>
            ) : (
              mergedMetrics.slice(0, 4).map((m) => (
                <div
                  key={m.label}
                  className="rounded-2xl border border-border-muted bg-surface px-4 py-3"
                >
                  <div className="text-xs uppercase tracking-[0.25em] text-text-muted">{m.label}</div>
                  <div className="mt-1 text-lg font-semibold text-white">{m.value}</div>
                </div>
              ))
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(data?.topActions || []).slice(0, 2).map((a) => (
              <Button key={a.href + a.label} variant="outline" size="sm" asChild>
                <Link href={a.href}>{a.label}</Link>
              </Button>
            ))}
            <Button variant="outline" size="sm" onClick={copySummary}>
              <Copy className="mr-2 h-4 w-4" /> Copy
            </Button>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

