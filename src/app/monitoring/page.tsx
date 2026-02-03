'use client';

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { GlassCard } from "@/components/registrata/GlassCard";
import { SectionHeader } from "@/components/registrata/SectionHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabaseClient";
import type { AuctionSale, AuditLogEntry, Org } from "@/types/database";
import type { User } from "@supabase/supabase-js";

export default function MonitoringPage() {
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<AuctionSale[]>([]);
  const [activity, setActivity] = useState<AuditLogEntry[]>([]);
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
        const [salesRes, activityRes] = await Promise.all([
          supabase
            .from("auction_sales")
            .select("*")
            .eq("org_id", prof.org_id)
            .order("created_at", { ascending: false })
            .limit(6),
          supabase
            .from("audit_log")
            .select("*")
            .eq("org_id", prof.org_id)
            .order("created_at", { ascending: false })
            .limit(8),
        ]);
        setSales(salesRes.data || []);
        setActivity(activityRes.data || []);
      }

      setLoading(false);
    }

    load();
  }, []);

  return (
    <AppShell user={user} org={org} primaryAction={{ label: "View Alerts", href: "/auctions" }}>
      <div className="space-y-8">
        <SectionHeader
          kicker="Stage 7"
          title="Continuous Intelligence"
          subtitle="Live auction feeds update valuation models, market alerts, and research context so leadership always sees current performance."
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <GlassCard>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.25em] text-text-muted">Market Monitoring</p>
              <h3 className="text-lg font-semibold text-white">Upcoming and active sales</h3>
            </div>
            <div className="mt-5 overflow-hidden rounded-2xl border border-border-muted">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sale</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-6 text-sm text-text-muted">
                        Loading sales...
                      </TableCell>
                    </TableRow>
                  ) : sales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-6 text-sm text-text-muted">
                        No sales scheduled. Create a sale to begin monitoring.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="text-white font-semibold">{sale.name}</TableCell>
                        <TableCell className="text-text-secondary capitalize">{sale.status}</TableCell>
                        <TableCell className="text-text-secondary">
                          {sale.sale_date ? new Date(sale.sale_date).toLocaleDateString() : "--"}
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
              <p className="text-xs uppercase tracking-[0.25em] text-text-muted">Activity Feed</p>
              <h3 className="text-lg font-semibold text-white">Audit and operational updates</h3>
            </div>
            <div className="mt-5 overflow-hidden rounded-2xl border border-border-muted">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-6 text-sm text-text-muted">
                        Loading activity...
                      </TableCell>
                    </TableRow>
                  ) : activity.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-6 text-sm text-text-muted">
                        No activity logged yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    activity.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="text-white font-semibold">{entry.action}</TableCell>
                        <TableCell className="text-text-secondary">{entry.resource_type}</TableCell>
                        <TableCell className="text-text-secondary">
                          {new Date(entry.created_at).toLocaleDateString()}
                        </TableCell>
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
