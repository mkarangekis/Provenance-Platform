'use client';

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PageHeader,
  StatCard,
  EmptyState,
  PageSkeleton,
  TableSkeleton,
  StatusPill,
} from "@/components/ui-ext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Archive, FileText, Brain, Clock } from "lucide-react";
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

    const u = await requireSession();
    if (!u) return;
    setUser(u);

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

    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <AppShell user={user} org={org} primaryAction={{ label: "New Object", href: "/objects" }}>
        <PageSkeleton />
      </AppShell>
    );
  }

  return (
    <AppShell user={user} org={org} primaryAction={{ label: "New Object", href: "/objects" }}>
      <div className="space-y-8">
        <PageHeader
          title="Dashboard"
          subtitle="Monitor object intake, AI activity, and review workload across your organization."
          breadcrumbs={[{ label: "Dashboard" }]}
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

        {stats ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total Objects" value={stats.objects.total} subtext="Across all statuses" icon={<Archive className="h-5 w-5" />} />
            <StatCard label="Pending Events" value={stats.events.pending} subtext="Awaiting review" tone="warning" icon={<Clock className="h-5 w-5" />} />
            <StatCard label="AI Jobs (7d)" value={stats.aiJobs.last7Days} subtext="Recently queued" tone="primary" icon={<Brain className="h-5 w-5" />} />
            <StatCard label="Documents Uploaded" value={stats.documents.total} subtext="Total in repository" tone="success" icon={<FileText className="h-5 w-5" />} />
          </div>
        ) : (
          <TableSkeleton rows={4} />
        )}

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Objects</CardTitle>
                <p className="text-sm text-muted-foreground">Latest additions and updates.</p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/objects">View all</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {objects.length === 0 ? (
                <EmptyState
                  title="Create your first object"
                  description="Capture an object record to begin provenance analysis."
                  actionLabel="Create object"
                  onAction={() => (window.location.href = "/objects")}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Artist</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {objects.map((obj) => (
                      <TableRow key={obj.id}>
                        <TableCell className="font-semibold">{obj.title}</TableCell>
                        <TableCell>{obj.artist || "Unknown"}</TableCell>
                        <TableCell>
                          <StatusPill status={obj.status} />
                        </TableCell>
                        <TableCell>{new Date(obj.updated_at || obj.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/objects/${obj.id}`}>View</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between">
              <div>
                <CardTitle>AI Activity</CardTitle>
                <p className="text-sm text-muted-foreground">Recent extraction jobs and outcomes.</p>
              </div>
            </CardHeader>
            <CardContent>
              {aiJobs.length === 0 ? (
                <EmptyState
                  title="No AI jobs yet"
                  description="Upload a document to queue your first extraction."
                  actionLabel="Go to objects"
                  onAction={() => (window.location.href = "/objects")}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Object</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aiJobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-semibold">
                          {objectLookup.get(job.object_id) || "Object"}
                        </TableCell>
                        <TableCell>
                          <StatusPill status={job.status} />
                        </TableCell>
                        <TableCell className="capitalize">{job.source}</TableCell>
                        <TableCell>{new Date(job.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/objects/${job.object_id}`}>View</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
