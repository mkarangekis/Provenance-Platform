'use client';

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Radar, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GlassCard } from "@/components/registrata/GlassCard";
import { MetricCard } from "@/components/registrata/MetricCard";
import { SectionHeader } from "@/components/registrata/SectionHeader";
import { featureFlags } from "@/lib/featureFlags";
import { OverviewCharts } from "@/components/analytics/OverviewCharts";
import type { AIExtraction, ProvenanceObject, Org } from "@/types/database";
import type { User } from "@supabase/supabase-js";

interface DashboardStats {
  objects: { total: number };
  documents: { total: number };
  events: { pending: number };
  aiJobs: { last7Days: number };
}

type DashboardObject = Pick<
  ProvenanceObject,
  "id" | "title" | "artist" | "status" | "updated_at" | "created_at"
>;

type DashboardJob = Pick<AIExtraction, "id" | "status" | "source" | "created_at" | "object_id">;

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [objects, setObjects] = useState<DashboardObject[]>([]);
  const [aiJobs, setAiJobs] = useState<DashboardJob[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");
  const [intakeTrend, setIntakeTrend] = useState<Array<{ date: string; value: number }>>([]);
  const [aiTrend, setAiTrend] = useState<Array<{ date: string; value: number }>>([]);
  const [statusMix, setStatusMix] = useState<Array<{ status: string; count: number }>>([]);
  const [overviewView, setOverviewView] = useState<"charts" | "table">("charts");
  const [org, setOrg] = useState<Org | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const objectLookup = useMemo(() => {
    const map = new Map<string, string>();
    objects.forEach((obj) => map.set(obj.id, obj.title));
    return map;
  }, [objects]);

  async function requireSession() {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) {
      window.location.href = "/auth";
      return null;
    }
    return data.session.user;
  }

  async function loadData() {
    setLoading(true);
    setError("");

    const sessionRes = await supabase.auth.getSession();
    const u = sessionRes.data.session?.user || null;
    if (!u) return;
    setUser(u);
    const token = sessionRes.data.session?.access_token || null;

    const { data: prof, error: pErr } = await supabase
      .from("profiles")
      .select("org_id, orgs(*)")
      .eq("user_id", u.id)
      .single();

    if (pErr || !prof?.org_id) {
      window.location.href = "/setup";
      return;
    }

    const orgRow = Array.isArray(prof.orgs) ? prof.orgs[0] : prof.orgs;
    setOrg(orgRow ?? null);

    const [statsRes, objectsRes, aiRes] = await Promise.all([
      fetch(`/api/dashboard?userId=${u.id}`),
      supabase
        .from("objects")
        .select("id, title, artist, status, updated_at, created_at")
        .eq("org_id", prof.org_id)
        .order("updated_at", { ascending: false })
        .limit(10),
      supabase
        .from("ai_extractions")
        .select("id, status, source, created_at, object_id")
        .eq("org_id", prof.org_id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    if (statsRes.ok) {
      const statsData = await statsRes.json();
      setStats(statsData);
    }

    if (objectsRes.error) {
      setError(objectsRes.error.message);
    } else {
      setObjects(objectsRes.data || []);
    }

    if (aiRes.error) {
      setError(aiRes.error.message);
    } else {
      setAiJobs(aiRes.data || []);
    }

    if (featureFlags.graphsOverview && token) {
      setAnalyticsLoading(true);
      setAnalyticsError("");
      try {
        const res = await fetch("/api/v1/analytics/overview", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Unable to load overview analytics");
        setIntakeTrend(json.intakeTrend || []);
        setAiTrend(json.aiTrend || []);
        setStatusMix(json.statusMix || []);
      } catch (e: unknown) {
        setAnalyticsError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setAnalyticsLoading(false);
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <AppShell user={user} org={org} primaryAction={{ label: "New Intake", href: "/intake" }}>
        <div className="space-y-6">
          <div className="h-8 w-64 rounded-xl bg-surface animate-pulse-soft" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`metric-${index}`} className="h-28 rounded-2xl bg-surface animate-pulse-soft" />
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="h-64 rounded-2xl bg-surface animate-pulse-soft lg:col-span-2" />
            <div className="h-64 rounded-2xl bg-surface animate-pulse-soft" />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell user={user} org={org} primaryAction={{ label: "New Intake", href: "/intake" }}>
      <div className="space-y-10">
        <SectionHeader
          kicker="Registrata Command"
          title="Executive Dashboard"
          subtitle="Monitor intake volume, research velocity, catalog readiness, valuation risk, and buyer engagement in one unified view."
        />

        {error && (
          <Notice kind="error" onDismiss={() => setError("")}>
            <div className="flex flex-col gap-2">
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={loadData}>
                Retry
              </Button>
            </div>
          </Notice>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Active Artworks" value={stats?.objects.total ?? 0} helper="Across all intake stages" />
          <MetricCard label="Pending Reviews" value={stats?.events.pending ?? 0} helper="Awaiting specialist validation" tone="warning" />
          <MetricCard label="AI Sessions (7d)" value={stats?.aiJobs.last7Days ?? 0} helper="Research + extraction jobs" tone="info" />
          <MetricCard label="Documents" value={stats?.documents.total ?? 0} helper="Evidence repository" tone="success" />
        </div>

        {featureFlags.graphsOverview ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-text-muted">Interactive Overview</p>
                <p className="text-sm text-text-secondary">Charts are additive and can be toggled back to tables.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={overviewView === "charts" ? "default" : "outline"}
                  onClick={() => setOverviewView("charts")}
                >
                  Charts
                </Button>
                <Button
                  size="sm"
                  variant={overviewView === "table" ? "default" : "outline"}
                  onClick={() => setOverviewView("table")}
                >
                  Table
                </Button>
              </div>
            </div>
            {overviewView === "charts" ? (
              <OverviewCharts
                intakeTrend={intakeTrend}
                aiTrend={aiTrend}
                statusMix={statusMix}
                loading={analyticsLoading}
                error={analyticsError}
              />
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-3">
          <GlassCard className="lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-text-muted">Recent Intake</p>
                <h3 className="text-lg font-semibold text-white">Latest artworks in motion</h3>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/intake">View intake</Link>
              </Button>
            </div>
            <div className="mt-5 overflow-hidden rounded-2xl border border-border-muted">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Artwork</TableHead>
                    <TableHead>Artist</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {objects.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-6 text-sm text-text-muted">
                        No intake records yet. Start by creating a new artwork.
                      </TableCell>
                    </TableRow>
                  ) : (
                    objects.map((obj) => (
                      <TableRow key={obj.id}>
                        <TableCell className="font-semibold text-white">{obj.title}</TableCell>
                        <TableCell className="text-text-secondary">{obj.artist || "Unknown"}</TableCell>
                        <TableCell className="text-text-secondary capitalize">{obj.status}</TableCell>
                        <TableCell className="text-text-secondary">
                          {new Date(obj.updated_at || obj.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </GlassCard>

          {!featureFlags.aiTopPanel ? (
            <GlassCard className="flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 text-primary-200">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/15">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-text-muted">AI Pulse</p>
                    <h3 className="text-lg font-semibold text-white">Registrata Signal</h3>
                  </div>
                </div>
                <p className="mt-4 text-sm text-text-secondary">
                  AI research and catalog automation are active. Review prioritized provenance gaps and approve new outputs
                  daily to keep the pipeline moving.
                </p>
              </div>
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-border-muted bg-surface px-4 py-3 text-sm">
                  <span className="text-text-secondary">Queued AI jobs</span>
                  <span className="text-white">{aiJobs.length}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border-muted bg-surface px-4 py-3 text-sm">
                  <span className="text-text-secondary">High-risk flags</span>
                  <span className="text-white">3</span>
                </div>
                <Button variant="outline" asChild>
                  <Link href="/research">Open AI command</Link>
                </Button>
              </div>
            </GlassCard>
          ) : null}
        </div>

        <GlassCard className="relative overflow-hidden">
          <div className="absolute right-6 top-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-500/15 text-primary-200">
            <Radar className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-text-muted">Continuous Intelligence</p>
            <h3 className="text-xl font-semibold text-white">Live monitoring + market feedback loop</h3>
            <p className="text-sm text-text-secondary">
              Automated alerts monitor auction records, market shifts, and provenance events to keep every valuation and
              risk profile current.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            {["Real-time support", "Continuous learning", "Executive visibility"].map((item) => (
              <span
                key={item}
                className="rounded-full border border-primary-500/20 bg-primary-500/10 px-3 py-1 text-xs text-primary-200"
              >
                {item}
              </span>
            ))}
          </div>
        </GlassCard>
      </div>
    </AppShell>
  );
}
