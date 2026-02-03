'use client';

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { GlassCard } from "@/components/registrata/GlassCard";
import { SectionHeader } from "@/components/registrata/SectionHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabaseClient";
import type { AIExtraction, ProvenanceEvent, Org } from "@/types/database";
import type { User } from "@supabase/supabase-js";

export default function ResearchPage() {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<AIExtraction[]>([]);
  const [events, setEvents] = useState<ProvenanceEvent[]>([]);
  const [org, setOrg] = useState<Org | null>(null);
  const [user, setUser] = useState<User | null>(null);

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
        const [jobsRes, eventsRes] = await Promise.all([
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
        setJobs(jobsRes.data || []);
        setEvents(eventsRes.data || []);
      }

      setLoading(false);
    }

    load();
  }, []);

  return (
    <AppShell user={user} org={org} primaryAction={{ label: "Run Research", href: "/objects" }}>
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
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-6 text-sm text-text-muted">
                        Loading research jobs...
                      </TableCell>
                    </TableRow>
                  ) : jobs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-6 text-sm text-text-muted">
                        No AI extractions yet. Upload documents to start research.
                      </TableCell>
                    </TableRow>
                  ) : (
                    jobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="text-text-secondary capitalize">{job.status}</TableCell>
                        <TableCell className="text-text-secondary capitalize">{job.source}</TableCell>
                        <TableCell className="text-text-secondary">
                          {new Date(job.created_at).toLocaleDateString()}
                        </TableCell>
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
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-6 text-sm text-text-muted">
                        Loading events...
                      </TableCell>
                    </TableRow>
                  ) : events.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-6 text-sm text-text-muted">
                        No provenance events recorded yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    events.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="text-text-secondary">{event.event_type}</TableCell>
                        <TableCell className="text-text-secondary">
                          {event.confidence ? Math.round(event.confidence * 100) : "--"}%
                        </TableCell>
                        <TableCell className="text-text-secondary capitalize">{event.status}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </GlassCard>
        </div>
      </div>
    </AppShell>
  );
}
