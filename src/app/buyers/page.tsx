'use client';

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { GlassCard } from "@/components/registrata/GlassCard";
import { SectionHeader } from "@/components/registrata/SectionHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabaseClient";
import type { AuctionBidder, Org } from "@/types/database";
import type { User } from "@supabase/supabase-js";

export default function BuyersPage() {
  const [loading, setLoading] = useState(true);
  const [bidders, setBidders] = useState<AuctionBidder[]>([]);
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
          .from("auction_bidders")
          .select("*")
          .eq("org_id", prof.org_id)
          .order("created_at", { ascending: false })
          .limit(20);
        setBidders(list || []);
      }

      setLoading(false);
    }

    load();
  }, []);

  return (
    <AppShell user={user} org={org} primaryAction={{ label: "Open CRM", href: "/bidders" }}>
      <div className="space-y-8">
        <SectionHeader
          kicker="Stage 6"
          title="CRM-Driven Intelligence"
          subtitle="Unify bidder history, artist affinity, and collection themes to identify high-probability buyers and automate outreach."
        />

        <GlassCard>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.25em] text-text-muted">Buyer Network</p>
            <h3 className="text-lg font-semibold text-white">Active bidder profiles</h3>
          </div>
          <div className="mt-5 overflow-hidden rounded-2xl border border-border-muted">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>KYC</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-sm text-text-muted">
                      Loading CRM profiles...
                    </TableCell>
                  </TableRow>
                ) : bidders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-sm text-text-muted">
                      No bidder profiles yet. Add contacts to build buyer intelligence.
                    </TableCell>
                  </TableRow>
                ) : (
                  bidders.map((bidder) => (
                    <TableRow key={bidder.id}>
                      <TableCell className="text-white font-semibold">{bidder.name}</TableCell>
                      <TableCell className="text-text-secondary">{bidder.email || "--"}</TableCell>
                      <TableCell className="text-text-secondary capitalize">{bidder.kyc_status}</TableCell>
                      <TableCell className="text-text-secondary capitalize">{bidder.registration_status}</TableCell>
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
