'use client';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AppShell } from "@/components/AppShell";
import { PageHeader, TableSkeleton, EmptyState } from "@/components/ui-ext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import type { AuctionConsignment, Org, Profile, ProvenanceObject } from "@/types/database";
import type { User } from "@supabase/supabase-js";

type ConsignmentFormState = {
  consignor_name: string;
  consignor_email: string;
  consignor_phone: string;
  object_title: string;
  object_artist: string;
  artist_authority_name: string;
  taxonomy_labels: string;
  object_description: string;
  valuation_status: "pending" | "reviewed" | "approved" | "rejected";
  valuation_notes: string;
  estimate_low: string;
  estimate_high: string;
  reserve_amount: string;
  reserve_approved: boolean;
  contract_status: "pending" | "sent" | "signed" | "declined";
  contract_provider: string;
  contract_url: string;
  intake_notes: string;
};

const defaultFormState: ConsignmentFormState = {
  consignor_name: "",
  consignor_email: "",
  consignor_phone: "",
  object_title: "",
  object_artist: "",
  artist_authority_name: "",
  taxonomy_labels: "",
  object_description: "",
  valuation_status: "pending",
  valuation_notes: "",
  estimate_low: "",
  estimate_high: "",
  reserve_amount: "",
  reserve_approved: false,
  contract_status: "pending",
  contract_provider: "",
  contract_url: "",
  intake_notes: "",
};

export default function ConsignmentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [consignments, setConsignments] = useState<AuctionConsignment[]>([]);
  const [objects, setObjects] = useState<Record<string, ProvenanceObject>>({});
  const [form, setForm] = useState<ConsignmentFormState>(defaultFormState);
  const canEdit = profile?.role !== "viewer";
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

    const { data: consignmentRows } = await supabase
      .from("auction_consignments")
      .select("*")
      .order("created_at", { ascending: false });

    const objectIds = (consignmentRows || [])
      .map((row) => row.object_id)
      .filter(Boolean) as string[];

    let objectMap: Record<string, ProvenanceObject> = {};
    if (objectIds.length) {
      const { data: objectRows } = await supabase
        .from("objects")
        .select("*")
        .in("id", objectIds);

      objectMap = (objectRows || []).reduce<Record<string, ProvenanceObject>>((acc, obj) => {
        acc[obj.id] = obj;
        return acc;
      }, {});
    }

    setObjects(objectMap);
    setConsignments((consignmentRows || []) as AuctionConsignment[]);
    setLoading(false);
  }

  async function createConsignment() {
    if (!user || !org) return;
    if (!form.consignor_name.trim() || !form.object_title.trim()) {
      toast.error("Consignor name and object title are required.");
      return;
    }

    let artistAuthorityId: string | null = null;
    if (form.artist_authority_name.trim()) {
      const { data: authorityRow, error: authorityErr } = await supabase
        .from("artist_authority")
        .upsert(
          { name: form.artist_authority_name.trim() },
          { onConflict: "name" }
        )
        .select()
        .single();

      if (authorityErr) {
        toast.error("Unable to save artist authority", { description: authorityErr.message });
        return;
      }
      artistAuthorityId = authorityRow?.id ?? null;
    }

    const { data: objectRow, error: objectErr } = await supabase
      .from("objects")
      .insert({
        org_id: org.id,
        created_by: user.id,
        title: form.object_title.trim(),
        artist: form.object_artist.trim() || null,
        artist_authority_id: artistAuthorityId,
        description: form.object_description.trim() || null,
        status: "intake",
      })
      .select()
      .single();

    if (objectErr || !objectRow) {
      toast.error("Unable to create object", { description: objectErr?.message });
      return;
    }

    const reserveApprovedAt = form.reserve_approved ? new Date().toISOString() : null;
    const reserveApprovedBy = form.reserve_approved ? user.id : null;

    const { error: consignmentErr } = await supabase
      .from("auction_consignments")
      .insert({
        org_id: org.id,
        object_id: objectRow.id,
        created_by: user.id,
        consignor_name: form.consignor_name.trim(),
        consignor_email: form.consignor_email.trim() || null,
        consignor_phone: form.consignor_phone.trim() || null,
        valuation_status: form.valuation_status,
        valuation_notes: form.valuation_notes.trim() || null,
        estimate_low: form.estimate_low ? Number(form.estimate_low) : null,
        estimate_high: form.estimate_high ? Number(form.estimate_high) : null,
        reserve_amount: form.reserve_amount ? Number(form.reserve_amount) : null,
        reserve_approved_by: reserveApprovedBy,
        reserve_approved_at: reserveApprovedAt,
        contract_status: form.contract_status,
        contract_provider: form.contract_provider.trim() || null,
        contract_url: form.contract_url.trim() || null,
        intake_notes: form.intake_notes.trim() || null,
        status: "intake",
      });

    if (consignmentErr) {
      toast.error("Unable to create consignment", { description: consignmentErr.message });
      return;
    }

    if (form.taxonomy_labels.trim()) {
      const labels = form.taxonomy_labels
        .split(",")
        .map((label) => label.trim())
        .filter(Boolean);

      if (labels.length) {
        const { data: taxonomyRows, error: taxonomyErr } = await supabase
          .from("object_taxonomy")
          .upsert(labels.map((label) => ({ label })), { onConflict: "label" })
          .select();

        if (taxonomyErr) {
          toast.error("Unable to save taxonomy", { description: taxonomyErr.message });
          return;
        }

        const mapRows = (taxonomyRows || []).map((row) => ({
          object_id: objectRow.id,
          taxonomy_id: row.id,
        }));

        const { error: mapErr } = await supabase
          .from("object_taxonomy_map")
          .upsert(mapRows, { onConflict: "object_id,taxonomy_id" });

        if (mapErr) {
          toast.error("Unable to map taxonomy", { description: mapErr.message });
          return;
        }
      }
    }

    toast.success("Consignment created");
    setForm(defaultFormState);
    await loadData();
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const consignmentRows = useMemo(() => consignments, [consignments]);

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
          title="Consignments"
          subtitle="Capture consignor intake details and link objects to upcoming sales."
          breadcrumbs={[{ label: "Consignments" }]}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>New consignment intake</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Consignor name</label>
                  <Input
                    value={form.consignor_name}
                    onChange={(event) => setForm({ ...form, consignor_name: event.target.value })}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Consignor email</label>
                  <Input
                    type="email"
                    value={form.consignor_email}
                    onChange={(event) => setForm({ ...form, consignor_email: event.target.value })}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Consignor phone</label>
                  <Input
                    value={form.consignor_phone}
                    onChange={(event) => setForm({ ...form, consignor_phone: event.target.value })}
                    disabled={!canEdit}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Object title</label>
                <Input
                  value={form.object_title}
                  onChange={(event) => setForm({ ...form, object_title: event.target.value })}
                  disabled={!canEdit}
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Artist</label>
                  <Input
                    value={form.object_artist}
                    onChange={(event) => setForm({ ...form, object_artist: event.target.value })}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Artist authority</label>
                  <Input
                    value={form.artist_authority_name}
                    onChange={(event) => setForm({ ...form, artist_authority_name: event.target.value })}
                    disabled={!canEdit}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Taxonomy labels</label>
                <Input
                  value={form.taxonomy_labels}
                  onChange={(event) => setForm({ ...form, taxonomy_labels: event.target.value })}
                  placeholder="Painting, Impressionist, 19th century"
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={form.object_description}
                  onChange={(event) => setForm({ ...form, object_description: event.target.value })}
                  disabled={!canEdit}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Valuation status</label>
                  <select
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.valuation_status}
                    onChange={(event) => setForm({
                      ...form,
                      valuation_status: event.target.value as ConsignmentFormState["valuation_status"],
                    })}
                    disabled={!canEdit}
                  >
                    <option value="pending">Pending</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Reserve approved</label>
                  <select
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.reserve_approved ? "yes" : "no"}
                    onChange={(event) => setForm({ ...form, reserve_approved: event.target.value === "yes" })}
                    disabled={!isAdmin}
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Valuation notes</label>
                <Textarea
                  value={form.valuation_notes}
                  onChange={(event) => setForm({ ...form, valuation_notes: event.target.value })}
                  disabled={!canEdit}
                />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Estimate low</label>
                  <Input
                    type="number"
                    value={form.estimate_low}
                    onChange={(event) => setForm({ ...form, estimate_low: event.target.value })}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Estimate high</label>
                  <Input
                    type="number"
                    value={form.estimate_high}
                    onChange={(event) => setForm({ ...form, estimate_high: event.target.value })}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Reserve</label>
                  <Input
                    type="number"
                    value={form.reserve_amount}
                    onChange={(event) => setForm({ ...form, reserve_amount: event.target.value })}
                    disabled={!canEdit}
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Contract status</label>
                  <select
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.contract_status}
                    onChange={(event) => setForm({
                      ...form,
                      contract_status: event.target.value as ConsignmentFormState["contract_status"],
                    })}
                    disabled={!canEdit}
                  >
                    <option value="pending">Pending</option>
                    <option value="sent">Sent</option>
                    <option value="signed">Signed</option>
                    <option value="declined">Declined</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Contract provider</label>
                  <Input
                    value={form.contract_provider}
                    onChange={(event) => setForm({ ...form, contract_provider: event.target.value })}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Contract URL</label>
                  <Input
                    value={form.contract_url}
                    onChange={(event) => setForm({ ...form, contract_url: event.target.value })}
                    disabled={!canEdit}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Intake notes</label>
                <Textarea
                  value={form.intake_notes}
                  onChange={(event) => setForm({ ...form, intake_notes: event.target.value })}
                  disabled={!canEdit}
                />
              </div>

              <Button onClick={createConsignment} disabled={!canEdit}>
                Create consignment
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent consignments</CardTitle>
            </CardHeader>
            <CardContent>
              {consignmentRows.length === 0 ? (
                <EmptyState
                  title="No consignments yet"
                  description="Create your first consignment intake to populate the pipeline."
                />
              ) : (
                <Table>
                  <TableHeader>
                  <TableRow>
                    <TableHead>Consignor</TableHead>
                    <TableHead>Object</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Valuation</TableHead>
                    <TableHead>Estimate</TableHead>
                    <TableHead>Reserve</TableHead>
                  </TableRow>
                  </TableHeader>
                  <TableBody>
                  {consignmentRows.map((row) => {
                    const obj = row.object_id ? objects[row.object_id] : undefined;
                    const estimate = row.estimate_low || row.estimate_high
                      ? `${row.estimate_low ?? "-"} - ${row.estimate_high ?? "-"}`
                      : "—";
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-semibold">{row.consignor_name}</TableCell>
                        <TableCell>{obj?.title || "Unlinked"}</TableCell>
                        <TableCell className="capitalize text-sm text-muted-foreground">{row.status}</TableCell>
                        <TableCell className="capitalize text-sm text-muted-foreground">{row.valuation_status}</TableCell>
                        <TableCell>{estimate}</TableCell>
                        <TableCell>{row.reserve_amount ?? "—"}</TableCell>
                      </TableRow>
                    );
                  })}
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
