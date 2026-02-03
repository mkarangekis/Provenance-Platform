'use client';

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { GlassCard } from "@/components/registrata/GlassCard";
import { SectionHeader } from "@/components/registrata/SectionHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabaseClient";
import type { ProvenanceEvent, Org } from "@/types/database";
import type { User } from "@supabase/supabase-js";

export default function RiskPage() {
  const [loading, setLoading] = useState(true);
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
        const { data: list } = await supabase
          .from("provenance_events")
          .select("*")
          .eq("org_id", prof.org_id)
          .order("created_at", { ascending: false })
          .limit(15);
        setEvents(list || []);
      }

      setLoading(false);
    }

    load();
  }, []);

  return (
    <AppShell user={user} org={org} primaryAction={{ label: "Review Risks", href: "/review" }}>
      <div className="space-y-8">
        <SectionHeader
          kicker="Stage 5"
          title="Risk Scoring & Prioritization"
          subtitle="Registrata highlights provenance gaps, document inconsistencies, and authenticity risks so experts focus on the highest-impact issues."
        />

        <GlassCard>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.25em] text-text-muted">Risk Signals</p>
            <h3 className="text-lg font-semibold text-white">Events requiring validation</h3>
          </div>
          <div className="mt-5 overflow-hidden rounded-2xl border border-border-muted">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event Type</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-sm text-text-muted">
                      Loading risk signals...
                    </TableCell>
                  </TableRow>
                ) : events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-sm text-text-muted">
                      No events to review. Continue monitoring research outputs.
                    </TableCell>
                  </TableRow>
                ) : (
                  events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="text-white font-semibold">{event.event_type}</TableCell>
                      <TableCell className="text-text-secondary">
                        {event.confidence ? Math.round(event.confidence * 100) : "--"}%
                      </TableCell>
                      <TableCell className="text-text-secondary capitalize">{event.status}</TableCell>
                      <TableCell className="text-text-secondary">
                        {new Date(event.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </GlassCard>
      </div>
    </AppShell>
  );
}
