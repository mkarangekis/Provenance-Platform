'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GlassCard } from "@/components/registrata/GlassCard";
import { SectionHeader } from "@/components/registrata/SectionHeader";
import type { ProvenanceObject, Org } from "@/types/database";
import type { User } from "@supabase/supabase-js";

export default function IntakePage() {
  const [loading, setLoading] = useState(true);
  const [objects, setObjects] = useState<ProvenanceObject[]>([]);
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
          .from("objects")
          .select("*")
          .eq("org_id", prof.org_id)
          .order("created_at", { ascending: false })
          .limit(25);
        setObjects(list || []);
      }

      setLoading(false);
    }

    load();
  }, []);

  return (
    <AppShell user={user} org={org} primaryAction={{ label: "New Intake", href: "/objects" }}>
      <div className="space-y-8">
        <SectionHeader
          kicker="Stage 1"
          title="Structured Object Creation"
          subtitle="Capture artworks once and let Registrata assemble metadata, evidence, and research citations into a single source of truth."
        />

        <GlassCard>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-text-muted">Intake Queue</p>
              <h3 className="text-lg font-semibold text-white">Latest artworks entering the system</h3>
            </div>
            <Button asChild>
              <Link href="/objects">
                <Plus className="mr-2 h-4 w-4" /> Add artwork
              </Link>
            </Button>
          </div>
          <div className="mt-5 overflow-hidden rounded-2xl border border-border-muted">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Artist</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-sm text-text-muted">
                      Loading intake records...
                    </TableCell>
                  </TableRow>
                ) : objects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-sm text-text-muted">
                      No artworks yet. Create your first intake record to begin.
                    </TableCell>
                  </TableRow>
                ) : (
                  objects.map((obj) => (
                    <TableRow key={obj.id}>
                      <TableCell className="font-semibold text-white">{obj.title}</TableCell>
                      <TableCell className="text-text-secondary">{obj.artist || "Unknown"}</TableCell>
                      <TableCell className="text-text-secondary capitalize">{obj.status}</TableCell>
                      <TableCell className="text-text-secondary">
                        {new Date(obj.created_at).toLocaleDateString()}
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
