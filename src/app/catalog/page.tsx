'use client';

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { GlassCard } from "@/components/registrata/GlassCard";
import { SectionHeader } from "@/components/registrata/SectionHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabaseClient";
import type { CatalogJob, ProvenanceObject, Org } from "@/types/database";
import type { User } from "@supabase/supabase-js";

export default function CatalogPage() {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<CatalogJob[]>([]);
  const [objects, setObjects] = useState<Record<string, ProvenanceObject>>({});
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
        const [jobsRes, objectsRes] = await Promise.all([
          supabase
            .from("catalog_jobs")
            .select("*")
            .eq("org_id", prof.org_id)
            .order("created_at", { ascending: false })
            .limit(10),
          supabase
            .from("objects")
            .select("*")
            .eq("org_id", prof.org_id)
            .order("created_at", { ascending: false })
            .limit(15),
        ]);
        setJobs(jobsRes.data || []);

        const map: Record<string, ProvenanceObject> = {};
        (objectsRes.data || []).forEach((obj) => {
          map[obj.id] = obj;
        });
        setObjects(map);
      }

      setLoading(false);
    }

    load();
  }, []);

  return (
    <AppShell user={user} org={org} primaryAction={{ label: "Generate Catalog", href: "/objects" }}>
      <div className="space-y-8">
        <SectionHeader
          kicker="Stage 3"
          title="AI-Assisted Catalog Production"
          subtitle="Generate standardized, catalog-ready entries with review workflows that preserve expert authority and traceability."
        />

        <GlassCard>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.25em] text-text-muted">Catalog Queue</p>
            <h3 className="text-lg font-semibold text-white">Recent generation jobs</h3>
          </div>
          <div className="mt-5 overflow-hidden rounded-2xl border border-border-muted">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Artwork</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-sm text-text-muted">
                      Loading catalog jobs...
                    </TableCell>
                  </TableRow>
                ) : jobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-sm text-text-muted">
                      No catalog jobs yet. Trigger a catalog build from an artwork record.
                    </TableCell>
                  </TableRow>
                ) : (
                  jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="text-white font-semibold">
                        {objects[job.object_id]?.title || "Artwork"}
                      </TableCell>
                      <TableCell className="text-text-secondary capitalize">{job.status}</TableCell>
                      <TableCell className="text-text-secondary">{job.attempts}</TableCell>
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
      </div>
    </AppShell>
  );
}
