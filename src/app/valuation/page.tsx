'use client';

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { GlassCard } from "@/components/registrata/GlassCard";
import { SectionHeader } from "@/components/registrata/SectionHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabaseClient";
import type { AuctionConsignment, Org } from "@/types/database";
import type { User } from "@supabase/supabase-js";

export default function ValuationPage() {
  const [loading, setLoading] = useState(true);
  const [consignments, setConsignments] = useState<AuctionConsignment[]>([]);
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
          .from("auction_consignments")
          .select("*")
          .eq("org_id", prof.org_id)
          .order("created_at", { ascending: false })
          .limit(15);
        setConsignments(list || []);
      }

      setLoading(false);
    }

    load();
  }, []);

  return (
    <AppShell user={user} org={org} primaryAction={{ label: "Review Valuations", href: "/consignments" }}>
      <div className="space-y-8">
        <SectionHeader
          kicker="Stage 4"
          title="Data-Driven Valuation"
          subtitle="Blend auction history, comparables, and liquidity signals to generate confident reserve guidance."
        />

        <GlassCard>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.25em] text-text-muted">Valuation Pipeline</p>
            <h3 className="text-lg font-semibold text-white">Latest consignments in review</h3>
          </div>
          <div className="mt-5 overflow-hidden rounded-2xl border border-border-muted">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Consignor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Estimate</TableHead>
                  <TableHead>Reserve</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-sm text-text-muted">
                      Loading valuation pipeline...
                    </TableCell>
                  </TableRow>
                ) : consignments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-sm text-text-muted">
                      No consignments found. Create a new consignment to start valuation.
                    </TableCell>
                  </TableRow>
                ) : (
                  consignments.map((consignment) => (
                    <TableRow key={consignment.id}>
                      <TableCell className="text-white font-semibold">{consignment.consignor_name}</TableCell>
                      <TableCell className="text-text-secondary capitalize">{consignment.valuation_status}</TableCell>
                      <TableCell className="text-text-secondary">
                        {consignment.estimate_low ?? "--"} - {consignment.estimate_high ?? "--"}
                      </TableCell>
                      <TableCell className="text-text-secondary">{consignment.reserve_amount ?? "--"}</TableCell>
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
