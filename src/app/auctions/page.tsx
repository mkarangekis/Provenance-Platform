'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { AppShell } from "@/components/AppShell";
import { PageHeader, TableSkeleton, EmptyState } from "@/components/ui-ext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { AuctionSale, Org, Profile } from "@/types/database";
import type { User } from "@supabase/supabase-js";

type SaleFormState = {
  name: string;
  sale_date: string;
  location: string;
  status: AuctionSale["status"];
  currency: string;
  buyer_premium_rate: string;
};

const defaultSaleForm: SaleFormState = {
  name: "",
  sale_date: "",
  location: "",
  status: "draft",
  currency: "USD",
  buyer_premium_rate: "",
};

export default function AuctionsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sales, setSales] = useState<AuctionSale[]>([]);
  const [form, setForm] = useState<SaleFormState>(defaultSaleForm);
  const isAdmin = profile?.role === "admin" || profile?.role === "owner";

  async function requireSession() {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) {
      router.push("/auth");
      return null;
    }
    return data.session.user;
  }

  async function loadData() {
    setLoading(true);
    const current = await requireSession();
    if (!current) return;
    setUser(current);

    const { data: prof } = await supabase
      .from("profiles")
      .select("*, orgs(*)")
      .eq("user_id", current.id)
      .single();

    if (!prof?.org_id) {
      router.push("/setup");
      return;
    }

    setProfile(prof);
    const orgRow = Array.isArray(prof.orgs) ? prof.orgs[0] : prof.orgs;
    setOrg(orgRow ?? null);

    const { data: saleRows } = await supabase
      .from("auction_sales")
      .select("*")
      .order("sale_date", { ascending: false });

    setSales((saleRows || []) as AuctionSale[]);
    setLoading(false);
  }

  async function createSale() {
    if (!user || !org) return;
    if (!form.name.trim()) {
      toast.error("Sale name is required.");
      return;
    }

    const { error: saleErr } = await supabase
      .from("auction_sales")
      .insert({
        org_id: org.id,
        created_by: user.id,
        name: form.name.trim(),
        sale_date: form.sale_date ? new Date(form.sale_date).toISOString() : null,
        location: form.location.trim() || null,
        status: form.status,
        currency: form.currency.trim() || "USD",
        buyer_premium_rate: form.buyer_premium_rate ? Number(form.buyer_premium_rate) : null,
      });

    if (saleErr) {
      toast.error("Unable to create sale", { description: saleErr.message });
      return;
    }

    toast.success("Sale created");
    setForm(defaultSaleForm);
    await loadData();
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <AppShell user={user} org={org}>
        <TableSkeleton rows={6} />
      </AppShell>
    );
  }

  return (
    <AppShell user={user} org={org}>
      <div className="space-y-6">
        <PageHeader
          title="Auctions"
          subtitle="Plan, schedule, and launch sales with lot-level controls."
          breadcrumbs={[{ label: "Auctions" }]}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Create a sale</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Sale name</label>
                <Input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  disabled={!isAdmin}
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sale date</label>
                  <Input
                    type="date"
                    value={form.sale_date}
                    onChange={(event) => setForm({ ...form, sale_date: event.target.value })}
                    disabled={!isAdmin}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Location</label>
                  <Input
                    value={form.location}
                    onChange={(event) => setForm({ ...form, location: event.target.value })}
                    disabled={!isAdmin}
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select
                    value={form.status}
                    onValueChange={(value) => setForm({ ...form, status: value as AuctionSale["status"] })}
                    disabled={!isAdmin}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="live">Live</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      <SelectItem value="settled">Settled</SelectItem>
                      <SelectItem value="canceled">Canceled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Currency</label>
                  <Input
                    value={form.currency}
                    onChange={(event) => setForm({ ...form, currency: event.target.value })}
                    disabled={!isAdmin}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Buyer premium %</label>
                  <Input
                    type="number"
                    value={form.buyer_premium_rate}
                    onChange={(event) => setForm({ ...form, buyer_premium_rate: event.target.value })}
                    disabled={!isAdmin}
                  />
                </div>
              </div>

              <Button onClick={createSale} disabled={!isAdmin}>
                Create sale
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sales calendar</CardTitle>
            </CardHeader>
            <CardContent>
              {sales.length === 0 ? (
                <EmptyState
                  title="No sales scheduled"
                  description="Create your first sale to begin lotting."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sale</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="font-semibold">{sale.name}</TableCell>
                        <TableCell className="capitalize text-sm text-muted-foreground">{sale.status}</TableCell>
                        <TableCell>
                          {sale.sale_date ? new Date(sale.sale_date).toLocaleDateString() : "TBD"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/auctions/${sale.id}`}>Open</Link>
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
