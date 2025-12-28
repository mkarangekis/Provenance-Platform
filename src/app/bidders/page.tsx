'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AppShell } from "@/components/AppShell";
import { PageHeader, TableSkeleton, EmptyState } from "@/components/ui-ext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { AuctionBidder, Org, Profile } from "@/types/database";
import type { User } from "@supabase/supabase-js";

type BidderFormState = {
  name: string;
  email: string;
  phone: string;
  kyc_status: AuctionBidder["kyc_status"];
  registration_status: AuctionBidder["registration_status"];
  bidding_limit: string;
  notes: string;
};

const defaultBidderForm: BidderFormState = {
  name: "",
  email: "",
  phone: "",
  kyc_status: "pending",
  registration_status: "pending",
  bidding_limit: "",
  notes: "",
};

export default function BiddersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bidders, setBidders] = useState<AuctionBidder[]>([]);
  const [form, setForm] = useState<BidderFormState>(defaultBidderForm);
  const canEdit = profile?.role !== "viewer";

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

    const { data: bidderRows } = await supabase
      .from("auction_bidders")
      .select("*")
      .order("created_at", { ascending: false });

    setBidders((bidderRows || []) as AuctionBidder[]);
    setLoading(false);
  }

  async function createBidder() {
    if (!org || !user) return;
    if (!form.name.trim()) {
      toast.error("Bidder name is required.");
      return;
    }

    const { error: bidderErr } = await supabase
      .from("auction_bidders")
      .insert({
        org_id: org.id,
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        kyc_status: form.kyc_status,
        registration_status: form.registration_status,
        bidding_limit: form.bidding_limit ? Number(form.bidding_limit) : null,
        notes: form.notes.trim() || null,
      });

    if (bidderErr) {
      toast.error("Unable to create bidder", { description: bidderErr.message });
      return;
    }

    toast.success("Bidder registered");
    setForm(defaultBidderForm);
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
          title="Bidders"
          subtitle="Manage bidder registration, KYC status, and limits."
          breadcrumbs={[{ label: "Bidders" }]}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Register bidder</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name</label>
                  <Input
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    disabled={!canEdit}
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone</label>
                  <Input
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Bid limit</label>
                  <Input
                    type="number"
                    value={form.bidding_limit}
                    onChange={(event) => setForm({ ...form, bidding_limit: event.target.value })}
                    disabled={!canEdit}
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">KYC status</label>
                  <Select
                    value={form.kyc_status}
                    onValueChange={(value) => setForm({ ...form, kyc_status: value as AuctionBidder["kyc_status"] })}
                    disabled={!canEdit}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="verified">Verified</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Registration</label>
                  <Select
                    value={form.registration_status}
                    onValueChange={(value) => setForm({
                      ...form,
                      registration_status: value as AuctionBidder["registration_status"],
                    })}
                    disabled={!canEdit}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="denied">Denied</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Notes</label>
                <Input
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  disabled={!canEdit}
                />
              </div>
              <Button onClick={createBidder} disabled={!canEdit}>
                Register bidder
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bidder roster</CardTitle>
            </CardHeader>
            <CardContent>
              {bidders.length === 0 ? (
                <EmptyState title="No bidders yet" description="Register your first bidder to start taking bids." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Registration</TableHead>
                      <TableHead>KYC</TableHead>
                      <TableHead>Limit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bidders.map((bidder) => (
                      <TableRow key={bidder.id}>
                        <TableCell className="font-semibold">{bidder.name}</TableCell>
                        <TableCell className="capitalize text-sm text-muted-foreground">{bidder.registration_status}</TableCell>
                        <TableCell className="capitalize text-sm text-muted-foreground">{bidder.kyc_status}</TableCell>
                        <TableCell>{bidder.bidding_limit ?? "—"}</TableCell>
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
