'use client';

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui-ext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/Notice";
import { GlassCard } from "@/components/registrata/GlassCard";
import { SectionHeader } from "@/components/registrata/SectionHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabaseClient";
import { featureFlags } from "@/lib/featureFlags";
import { ResearchPackageCard } from "@/components/research/ResearchPackageCard";
import type { AIExtraction, Org, ProvenanceEvent, ProvenanceObject } from "@/types/database";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";

type ResearchMessage = { role: "user" | "assistant" | "system"; content: string; created_at: string };

const SUGGESTED_PROMPTS = [
  "Summarize provenance gaps and likely next documents to request.",
  "Generate a catalog-ready entry with evidence-backed claims only.",
  "Assess valuation range with internal comparables first.",
  "Draft buyer personas and a conservative outreach email.",
];

export default function ResearchPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [objects, setObjects] = useState<ProvenanceObject[]>([]);
  const [objectId, setObjectId] = useState("");
  const [threadId, setThreadId] = useState("");
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<ResearchMessage[]>([]);
  const [researchPackage, setResearchPackage] = useState<Record<string, unknown> | null>(null);
  const [jobs, setJobs] = useState<AIExtraction[]>([]);
  const [events, setEvents] = useState<ProvenanceEvent[]>([]);

  const selectedObject = useMemo(
    () => objects.find((entry) => entry.id === objectId) || null,
    [objects, objectId]
  );

  useEffect(() => {
    setEnabled(featureFlags.registrataResearchAssistant);
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) {
        window.location.href = "/auth";
        return;
      }
      setUser(data.session.user);

      const { data: prof } = await supabase
        .from("profiles")
        .select("org_id, orgs(*)")
        .eq("user_id", data.session.user.id)
        .single();
      const orgRow = Array.isArray(prof?.orgs) ? prof?.orgs[0] : prof?.orgs;
      setOrg(orgRow ?? null);

      if (prof?.org_id) {
        const [objectRes, jobsRes, eventsRes] = await Promise.all([
          supabase
            .from("objects")
            .select("*")
            .eq("org_id", prof.org_id)
            .order("updated_at", { ascending: false })
            .limit(100),
          supabase
            .from("ai_extractions")
            .select("*")
            .eq("org_id", prof.org_id)
            .order("created_at", { ascending: false })
            .limit(10),
          supabase
            .from("provenance_events")
            .select("*")
            .eq("org_id", prof.org_id)
            .order("created_at", { ascending: false })
            .limit(10),
        ]);
        const objectRows = objectRes.data;
        setJobs((jobsRes.data || []) as AIExtraction[]);
        setEvents((eventsRes.data || []) as ProvenanceEvent[]);
        setObjects((objectRows || []) as ProvenanceObject[]);
        const requested = new URLSearchParams(window.location.search).get("objectId");
        const chosen = requested && objectRows?.some((entry) => entry.id === requested)
          ? requested
          : objectRows?.[0]?.id || "";
        setObjectId(chosen);
      }
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    async function loadLatest() {
      if (!objectId) return;
      const { data } = await supabase
        .from("ai_extractions")
        .select("*")
        .eq("object_id", objectId)
        .order("created_at", { ascending: false })
        .limit(25);
      const latest = (data || []).find((entry) => {
        const payload = entry.extracted_json as Record<string, unknown> | null;
        return payload?.run_type === "research_chat";
      });
      if (!latest) {
        setMessages([]);
        setResearchPackage(null);
        setThreadId("");
        return;
      }
      const payload = latest.extracted_json as {
        thread_id?: string;
        stage_outputs?: {
          research_thread?: { messages?: ResearchMessage[] };
          research_package?: Record<string, unknown>;
        };
      };
      setThreadId(payload.thread_id || "");
      setMessages(payload.stage_outputs?.research_thread?.messages || []);
      setResearchPackage(payload.stage_outputs?.research_package || null);
    }
    loadLatest();
  }, [objectId]);

  async function runResearch(prompt: string) {
    if (!user?.id || !objectId) return;
    setBusy(true);
    const res = await fetch("/api/research/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: prompt,
        objectId,
        threadId: threadId || undefined,
        userId: user.id,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error("Research run failed", { description: data.error || "Try again." });
      setBusy(false);
      return;
    }
    setThreadId(data.threadId || "");
    setMessages((data.messages || []) as ResearchMessage[]);
    setResearchPackage((data.package || null) as Record<string, unknown> | null);
    setQuery("");
    setBusy(false);
  }

  async function saveObjectFromPackage() {
    if (!user?.id || !objectId) return;
    const res = await fetch("/api/research/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_object",
        objectId,
        userId: user.id,
        package: researchPackage || {},
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error("Save failed", { description: data.error || "Try again." });
      return;
    }
    toast.success("Object updated from research package");
  }

  async function addToCollection() {
    if (!user?.id || !objectId) return;
    const res = await fetch("/api/research/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add_to_collection",
        objectId,
        userId: user.id,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error("Collection update failed", { description: data.error || "Try again." });
      return;
    }
    toast.success("Added to collection");
  }

  function exportResearch(mode: "internal" | "public", format: "json" | "html") {
    if (!user?.id || !objectId) return;
    window.open(
      `/api/export/research?objectId=${objectId}&userId=${user.id}&mode=${mode}&format=${format}`,
      "_blank"
    );
  }

  function startNewResearch() {
    setThreadId("");
    setMessages([]);
    setResearchPackage(null);
    setQuery("");
  }

  if (loading) {
    return (
      <AppShell user={user} org={org}>
        <div className="space-y-4">
          <div className="h-10 w-64 animate-pulse rounded-xl bg-muted" />
          <div className="h-72 animate-pulse rounded-2xl bg-muted" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell user={user} org={org}>
      <div className="space-y-6">
        <PageHeader
          title="Research"
          subtitle="Search and generate a complete research package for an artwork."
          actions={
            <>
              <Button variant="outline" onClick={startNewResearch}>
                New Research
              </Button>
              {objectId ? (
                <Button asChild>
                  <Link href={`/objects/${objectId}`}>Open Object</Link>
                </Button>
              ) : null}
            </>
          }
        />

        {!enabled ? (
          <Notice kind="warning">
            <strong>Research assistant is disabled.</strong> Enable `REGISTRATA_RESEARCH_ASSISTANT=true` to use this page.
          </Notice>
        ) : null}

        {!enabled ? (
          <div className="space-y-8">
            <SectionHeader
              kicker="Stage 2"
              title="AI-Driven Research"
              subtitle="Registrata queries multiple data sources simultaneously, reconciles conflicts, and source-attributes every claim for expert review."
            />
            <div className="grid gap-6 lg:grid-cols-2">
              <GlassCard>
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.25em] text-text-muted">Research Jobs</p>
                  <h3 className="text-lg font-semibold text-white">Recent AI extractions</h3>
                </div>
                <div className="mt-5 overflow-hidden rounded-2xl border border-border-muted">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="py-6 text-sm text-text-muted">
                            No AI extractions yet. Upload documents to start research.
                          </TableCell>
                        </TableRow>
                      ) : (
                        jobs.map((job) => (
                          <TableRow key={job.id}>
                            <TableCell className="capitalize">{job.status}</TableCell>
                            <TableCell className="capitalize">{job.source}</TableCell>
                            <TableCell>{new Date(job.created_at).toLocaleDateString()}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </GlassCard>
              <GlassCard>
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.25em] text-text-muted">Evidence Review</p>
                  <h3 className="text-lg font-semibold text-white">New provenance events</h3>
                </div>
                <div className="mt-5 overflow-hidden rounded-2xl border border-border-muted">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event</TableHead>
                        <TableHead>Confidence</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="py-6 text-sm text-text-muted">
                            No provenance events recorded yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        events.map((event) => (
                          <TableRow key={event.id}>
                            <TableCell>{event.event_type}</TableCell>
                            <TableCell>{event.confidence ? Math.round(event.confidence * 100) : "--"}%</TableCell>
                            <TableCell className="capitalize">{event.status}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </GlassCard>
            </div>
          </div>
        ) : null}

        {enabled && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-3 md:grid-cols-[240px_1fr]">
              <label className="text-sm font-medium">Object</label>
              <select
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={objectId}
                onChange={(event) => setObjectId(event.target.value)}
              >
                <option value="">Select object</option>
                {objects.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.title} {entry.artist ? `- ${entry.artist}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
        )}

        {enabled && (
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Research Thread</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Start by asking a research question for {selectedObject?.title || "an object"}.
                  </p>
                ) : (
                  messages.map((message, index) => (
                    <div key={`${message.created_at}-${index}`} className="rounded-lg border border-border p-3">
                      <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">{message.role}</div>
                      <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ask a Question</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Ask about provenance, valuation, comparables, or risk..."
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && query.trim()) {
                        runResearch(query.trim());
                      }
                    }}
                    disabled={!enabled || busy || !objectId}
                  />
                  <Button disabled={!enabled || busy || !query.trim() || !objectId} onClick={() => runResearch(query.trim())}>
                    {busy ? "Sending..." : "Send"}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      disabled={!enabled || busy || !objectId}
                      onClick={() => runResearch(prompt)}
                    >
                      <Badge variant="default">{prompt}</Badge>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <ResearchPackageCard
            packageData={researchPackage}
            onSave={saveObjectFromPackage}
            onAddToCollection={addToCollection}
            onExport={exportResearch}
            busy={busy}
          />
        </div>
        )}
      </div>
    </AppShell>
  );
}
