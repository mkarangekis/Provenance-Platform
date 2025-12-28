'use client';

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AppShell } from "@/components/AppShell";
import { PageHeader, TableSkeleton, EmptyState } from "@/components/ui-ext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import type {
  AuctionBid,
  AuctionBidder,
  AuctionLot,
  AuctionSale,
  Org,
  Profile,
  ProvenanceObject,
} from "@/types/database";
import type { User } from "@supabase/supabase-js";

type LotFormState = {
  object_id: string;
  lot_number: string;
  title_override: string;
  order_index: string;
  estimate_low: string;
  estimate_high: string;
  reserve_amount: string;
  guarantee_amount: string;
  hammer_price: string;
  withdrawal_reason: string;
  financing_notes: string;
  status: AuctionLot["status"];
};

type BidFormState = {
  lot_id: string;
  bidder_id: string;
  amount: string;
  bid_type: AuctionBid["bid_type"];
};

const defaultLotForm: LotFormState = {
  object_id: "",
  lot_number: "",
  title_override: "",
  order_index: "",
  estimate_low: "",
  estimate_high: "",
  reserve_amount: "",
  guarantee_amount: "",
  hammer_price: "",
  withdrawal_reason: "",
  financing_notes: "",
  status: "draft",
};

const defaultBidForm: BidFormState = {
  lot_id: "",
  bidder_id: "",
  amount: "",
  bid_type: "absentee",
};

type BulkUpdateState = {
  status: AuctionLot["status"] | "";
  estimate_low: string;
  estimate_high: string;
  reserve_amount: string;
  order_index: string;
};

const defaultBulkUpdate: BulkUpdateState = {
  status: "",
  estimate_low: "",
  estimate_high: "",
  reserve_amount: "",
  order_index: "",
};

export default function AuctionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const saleId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sale, setSale] = useState<AuctionSale | null>(null);
  const [lots, setLots] = useState<AuctionLot[]>([]);
  const [objects, setObjects] = useState<ProvenanceObject[]>([]);
  const [bidders, setBidders] = useState<AuctionBidder[]>([]);
  const [bids, setBids] = useState<AuctionBid[]>([]);
  const [lotForm, setLotForm] = useState<LotFormState>(defaultLotForm);
  const [bidForm, setBidForm] = useState<BidFormState>(defaultBidForm);
  const [bidOpen, setBidOpen] = useState(false);
  const [lotEditOpen, setLotEditOpen] = useState(false);
  const [activeLot, setActiveLot] = useState<AuctionLot | null>(null);
  const [selectedLots, setSelectedLots] = useState<string[]>([]);
  const [bulkUpdate, setBulkUpdate] = useState<BulkUpdateState>(defaultBulkUpdate);
  const [conditionOpen, setConditionOpen] = useState(false);
  const [conditionLot, setConditionLot] = useState<AuctionLot | null>(null);
  const [conditionSummary, setConditionSummary] = useState("");
  const [conditionText, setConditionText] = useState("");

  const isAdmin = profile?.role === "admin" || profile?.role === "owner";
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

    const { data: saleRow } = await supabase
      .from("auction_sales")
      .select("*")
      .eq("id", saleId)
      .single();

    if (!saleRow) {
      setLoading(false);
      return;
    }

    const [lotRes, objectRes, bidderRes] = await Promise.all([
      supabase
        .from("auction_lots")
        .select("*")
        .eq("sale_id", saleId)
        .order("order_index", { ascending: true, nullsFirst: false })
        .order("lot_number", { ascending: true }),
      supabase
        .from("objects")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("auction_bidders")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

    const lotRows = (lotRes.data || []) as AuctionLot[];
    const lotIds = lotRows.map((lot) => lot.id);

    let bidRows: AuctionBid[] = [];
    if (lotIds.length) {
      const { data: bidRes } = await supabase
        .from("auction_bids")
        .select("*")
        .in("lot_id", lotIds)
        .order("created_at", { ascending: false });
      bidRows = (bidRes || []) as AuctionBid[];
    }

    setSale(saleRow as AuctionSale);
    setLots(lotRows);
    setObjects((objectRes.data || []) as ProvenanceObject[]);
    setBidders((bidderRes.data || []) as AuctionBidder[]);
    setBids(bidRows);
    setLoading(false);
  }

  async function createLot() {
    if (!user || !org) return;
    if (!lotForm.object_id) {
      toast.error("Select an object for the lot.");
      return;
    }

    const { error: lotErr } = await supabase
      .from("auction_lots")
      .insert({
        org_id: org.id,
        sale_id: saleId,
        object_id: lotForm.object_id,
        lot_number: lotForm.lot_number.trim() || null,
        title_override: lotForm.title_override.trim() || null,
        order_index: lotForm.order_index ? Number(lotForm.order_index) : null,
        estimate_low: lotForm.estimate_low ? Number(lotForm.estimate_low) : null,
        estimate_high: lotForm.estimate_high ? Number(lotForm.estimate_high) : null,
        reserve_amount: lotForm.reserve_amount ? Number(lotForm.reserve_amount) : null,
        guarantee_amount: lotForm.guarantee_amount ? Number(lotForm.guarantee_amount) : null,
        financing_notes: lotForm.financing_notes.trim() || null,
        withdrawal_reason: lotForm.withdrawal_reason.trim() || null,
        status: lotForm.status,
      });

    if (lotErr) {
      toast.error("Unable to create lot", { description: lotErr.message });
      return;
    }

    toast.success("Lot created");
    setLotForm(defaultLotForm);
    await loadData();
  }

  async function updateLot() {
    if (!activeLot) return;
    const { error: updateErr } = await supabase
      .from("auction_lots")
      .update({
        status: lotForm.status,
        title_override: lotForm.title_override.trim() || activeLot.title_override,
        order_index: lotForm.order_index ? Number(lotForm.order_index) : activeLot.order_index,
        hammer_price: lotForm.hammer_price ? Number(lotForm.hammer_price) : activeLot.hammer_price,
        reserve_amount: lotForm.reserve_amount ? Number(lotForm.reserve_amount) : activeLot.reserve_amount,
        estimate_low: lotForm.estimate_low ? Number(lotForm.estimate_low) : activeLot.estimate_low,
        estimate_high: lotForm.estimate_high ? Number(lotForm.estimate_high) : activeLot.estimate_high,
        guarantee_amount: lotForm.guarantee_amount ? Number(lotForm.guarantee_amount) : activeLot.guarantee_amount,
        withdrawal_reason: lotForm.withdrawal_reason.trim() || activeLot.withdrawal_reason,
        financing_notes: lotForm.financing_notes.trim() || activeLot.financing_notes,
      })
      .eq("id", activeLot.id);

    if (updateErr) {
      toast.error("Unable to update lot", { description: updateErr.message });
      return;
    }

    toast.success("Lot updated");
    setLotEditOpen(false);
    setActiveLot(null);
    setLotForm(defaultLotForm);
    await loadData();
  }

  async function recordBid() {
    if (!user || !org) return;
    if (!canEdit) {
      toast.error("Insufficient permission to record bids.");
      return;
    }
    if (!bidForm.lot_id || !bidForm.amount) {
      toast.error("Lot and bid amount are required.");
      return;
    }

    const { error: bidErr } = await supabase
      .from("auction_bids")
      .insert({
        org_id: org.id,
        lot_id: bidForm.lot_id,
        bidder_id: bidForm.bidder_id || null,
        amount: Number(bidForm.amount),
        bid_type: bidForm.bid_type,
        status: "accepted",
      });

    if (bidErr) {
      toast.error("Unable to record bid", { description: bidErr.message });
      return;
    }

    toast.success("Bid recorded");
    setBidForm(defaultBidForm);
    setBidOpen(false);
    await loadData();
  }

  async function applyBulkUpdate() {
    if (!selectedLots.length) {
      toast.error("Select lots to update.");
      return;
    }
    if (!canEdit) {
      toast.error("Insufficient permission to update lots.");
      return;
    }

    const payload: Partial<AuctionLot> = {};
    if (bulkUpdate.status) payload.status = bulkUpdate.status as AuctionLot["status"];
    if (bulkUpdate.estimate_low) payload.estimate_low = Number(bulkUpdate.estimate_low);
    if (bulkUpdate.estimate_high) payload.estimate_high = Number(bulkUpdate.estimate_high);
    if (bulkUpdate.reserve_amount) payload.reserve_amount = Number(bulkUpdate.reserve_amount);
    if (bulkUpdate.order_index) payload.order_index = Number(bulkUpdate.order_index);

    if (Object.keys(payload).length === 0) {
      toast.error("Set at least one field for bulk update.");
      return;
    }

    const { error: updateErr } = await supabase
      .from("auction_lots")
      .update(payload)
      .in("id", selectedLots);

    if (updateErr) {
      toast.error("Unable to update lots", { description: updateErr.message });
      return;
    }

    toast.success("Lots updated");
    setSelectedLots([]);
    setBulkUpdate(defaultBulkUpdate);
    await loadData();
  }

  async function openConditionReport(lot: AuctionLot) {
    setConditionLot(lot);
    setConditionSummary("");
    setConditionText("");
    setConditionOpen(true);

    const { data } = await supabase
      .from("condition_reports")
      .select("*")
      .eq("lot_id", lot.id)
      .single();

    if (data) {
      setConditionSummary(data.summary || "");
      setConditionText(data.report_text || "");
    }
  }

  async function saveConditionReport() {
    if (!conditionLot || !org || !user) return;
    if (!canEdit) {
      toast.error("Insufficient permission to update condition reports.");
      return;
    }

    const { error } = await supabase
      .from("condition_reports")
      .upsert(
        {
          org_id: org.id,
          lot_id: conditionLot.id,
          created_by: user.id,
          summary: conditionSummary.trim() || null,
          report_text: conditionText.trim() || null,
        },
        { onConflict: "lot_id" }
      );

    if (error) {
      toast.error("Unable to save condition report", { description: error.message });
      return;
    }

    toast.success("Condition report saved");
    setConditionOpen(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const objectMap = useMemo(() => {
    return objects.reduce<Record<string, ProvenanceObject>>((acc, obj) => {
      acc[obj.id] = obj;
      return acc;
    }, {});
  }, [objects]);

  const bidSummary = useMemo(() => {
    const summary: Record<string, AuctionBid | undefined> = {};
    bids.forEach((bid) => {
      if (!summary[bid.lot_id] || bid.amount > (summary[bid.lot_id]?.amount ?? 0)) {
        summary[bid.lot_id] = bid;
      }
    });
    return summary;
  }, [bids]);

  if (loading) {
    return (
      <AppShell user={user} org={org}>
        <TableSkeleton rows={6} />
      </AppShell>
    );
  }

  if (!sale) {
    return (
      <AppShell user={user} org={org}>
        <EmptyState title="Sale not found" description="Return to the auctions list to select another sale." />
      </AppShell>
    );
  }

  return (
    <AppShell
      user={user}
      org={org}
      primaryAction={canEdit ? { label: "Record bid", onClick: () => setBidOpen(true) } : undefined}
    >
      <div className="space-y-6">
        <PageHeader
          title={sale.name}
          subtitle={`Status: ${sale.status}`}
          breadcrumbs={[{ label: "Auctions", href: "/auctions" }, { label: sale.name }]}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Sale details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div>Date: {sale.sale_date ? new Date(sale.sale_date).toLocaleString() : "TBD"}</div>
              <div>Location: {sale.location || "—"}</div>
              <div>Currency: {sale.currency}</div>
              <div>Buyer premium: {sale.buyer_premium_rate ?? "—"}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add a lot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Object</label>
                <Select
                  value={lotForm.object_id}
                  onValueChange={(value) => setLotForm({ ...lotForm, object_id: value })}
                  disabled={!isAdmin}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select object" />
                  </SelectTrigger>
                  <SelectContent>
                    {objects.map((obj) => (
                      <SelectItem key={obj.id} value={obj.id}>
                        {obj.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Lot number</label>
                  <Input
                    value={lotForm.lot_number}
                    onChange={(event) => setLotForm({ ...lotForm, lot_number: event.target.value })}
                    disabled={!isAdmin}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Title override</label>
                  <Input
                    value={lotForm.title_override}
                    onChange={(event) => setLotForm({ ...lotForm, title_override: event.target.value })}
                    disabled={!isAdmin}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Lot order</label>
                  <Input
                    type="number"
                    value={lotForm.order_index}
                    onChange={(event) => setLotForm({ ...lotForm, order_index: event.target.value })}
                    disabled={!isAdmin}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select
                    value={lotForm.status}
                    onValueChange={(value) => setLotForm({ ...lotForm, status: value as AuctionLot["status"] })}
                    disabled={!isAdmin}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="sold">Sold</SelectItem>
                      <SelectItem value="passed">Passed</SelectItem>
                      <SelectItem value="withdrawn">Withdrawn</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Estimate low</label>
                  <Input
                    type="number"
                    value={lotForm.estimate_low}
                    onChange={(event) => setLotForm({ ...lotForm, estimate_low: event.target.value })}
                    disabled={!isAdmin}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Estimate high</label>
                  <Input
                    type="number"
                    value={lotForm.estimate_high}
                    onChange={(event) => setLotForm({ ...lotForm, estimate_high: event.target.value })}
                    disabled={!isAdmin}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Reserve</label>
                  <Input
                    type="number"
                    value={lotForm.reserve_amount}
                    onChange={(event) => setLotForm({ ...lotForm, reserve_amount: event.target.value })}
                    disabled={!isAdmin}
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Guarantee</label>
                  <Input
                    type="number"
                    value={lotForm.guarantee_amount}
                    onChange={(event) => setLotForm({ ...lotForm, guarantee_amount: event.target.value })}
                    disabled={!isAdmin}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Withdrawal reason</label>
                  <Input
                    value={lotForm.withdrawal_reason}
                    onChange={(event) => setLotForm({ ...lotForm, withdrawal_reason: event.target.value })}
                    disabled={!isAdmin}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Financing notes</label>
                <Input
                  value={lotForm.financing_notes}
                  onChange={(event) => setLotForm({ ...lotForm, financing_notes: event.target.value })}
                  disabled={!isAdmin}
                />
              </div>
              <Button onClick={createLot} disabled={!canEdit}>
                Add lot
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lots</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-border bg-muted/40 p-4">
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>{selectedLots.length} selected</span>
                <Select
                  value={bulkUpdate.status}
                  onValueChange={(value) => setBulkUpdate({ ...bulkUpdate, status: value as AuctionLot["status"] })}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="sold">Sold</SelectItem>
                    <SelectItem value="passed">Passed</SelectItem>
                    <SelectItem value="withdrawn">Withdrawn</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="Estimate low"
                  className="w-32"
                  value={bulkUpdate.estimate_low}
                  onChange={(event) => setBulkUpdate({ ...bulkUpdate, estimate_low: event.target.value })}
                />
                <Input
                  type="number"
                  placeholder="Estimate high"
                  className="w-32"
                  value={bulkUpdate.estimate_high}
                  onChange={(event) => setBulkUpdate({ ...bulkUpdate, estimate_high: event.target.value })}
                />
                <Input
                  type="number"
                  placeholder="Reserve"
                  className="w-28"
                  value={bulkUpdate.reserve_amount}
                  onChange={(event) => setBulkUpdate({ ...bulkUpdate, reserve_amount: event.target.value })}
                />
                <Input
                  type="number"
                  placeholder="Order"
                  className="w-24"
                  value={bulkUpdate.order_index}
                  onChange={(event) => setBulkUpdate({ ...bulkUpdate, order_index: event.target.value })}
                />
                <Button variant="outline" onClick={applyBulkUpdate} disabled={!canEdit}>
                  Apply
                </Button>
              </div>
            </div>
            {lots.length === 0 ? (
              <EmptyState title="No lots yet" description="Add the first lot to this sale." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead></TableHead>
                    <TableHead>Lot</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Object</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Top bid</TableHead>
                    <TableHead>Guarantee</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lots.map((lot) => {
                    const obj = lot.object_id ? objectMap[lot.object_id] : undefined;
                    const topBid = bidSummary[lot.id];
                    return (
                      <TableRow key={lot.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedLots.includes(lot.id)}
                            onCheckedChange={(val) => {
                              setSelectedLots((prev) =>
                                Boolean(val) ? [...prev, lot.id] : prev.filter((id) => id !== lot.id)
                              );
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-semibold">{lot.lot_number || "—"}</TableCell>
                        <TableCell>{lot.order_index ?? "—"}</TableCell>
                        <TableCell>{obj?.title || lot.title_override || "Unlinked"}</TableCell>
                        <TableCell className="capitalize text-sm text-muted-foreground">{lot.status}</TableCell>
                        <TableCell>{topBid ? `${topBid.amount}` : "—"}</TableCell>
                        <TableCell>{lot.guarantee_amount ?? "—"}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setBidForm({ ...defaultBidForm, lot_id: lot.id });
                              setBidOpen(true);
                            }}
                            disabled={!canEdit}
                          >
                            Record bid
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openConditionReport(lot)} disabled={!canEdit}>
                            Condition
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setActiveLot(lot);
                              setLotForm({
                                object_id: lot.object_id || "",
                                lot_number: lot.lot_number || "",
                                title_override: lot.title_override || "",
                                order_index: lot.order_index?.toString() || "",
                                estimate_low: lot.estimate_low?.toString() || "",
                                estimate_high: lot.estimate_high?.toString() || "",
                                reserve_amount: lot.reserve_amount?.toString() || "",
                                guarantee_amount: lot.guarantee_amount?.toString() || "",
                                hammer_price: lot.hammer_price?.toString() || "",
                                withdrawal_reason: lot.withdrawal_reason || "",
                                financing_notes: lot.financing_notes || "",
                                status: lot.status,
                              });
                              setLotEditOpen(true);
                            }}
                            disabled={!isAdmin}
                          >
                            Update
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={bidOpen} onOpenChange={setBidOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record bid</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Lot</label>
              <Select
                value={bidForm.lot_id}
                onValueChange={(value) => setBidForm({ ...bidForm, lot_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select lot" />
                </SelectTrigger>
                <SelectContent>
                  {lots.map((lot) => (
                    <SelectItem key={lot.id} value={lot.id}>
                      {lot.lot_number || "Lot"} - {lot.object_id ? objectMap[lot.object_id]?.title : "Unlinked"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Bidder</label>
              <Select
                value={bidForm.bidder_id}
                onValueChange={(value) => setBidForm({ ...bidForm, bidder_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select bidder" />
                </SelectTrigger>
                <SelectContent>
                  {bidders.map((bidder) => (
                    <SelectItem key={bidder.id} value={bidder.id}>
                      {bidder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Amount</label>
                <Input
                  type="number"
                  value={bidForm.amount}
                  onChange={(event) => setBidForm({ ...bidForm, amount: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Bid type</label>
                <Select
                  value={bidForm.bid_type}
                  onValueChange={(value) => setBidForm({ ...bidForm, bid_type: value as AuctionBid["bid_type"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="floor">Floor</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="absentee">Absentee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBidOpen(false)}>
              Cancel
            </Button>
            <Button onClick={recordBid}>Record bid</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={lotEditOpen} onOpenChange={setLotEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update lot</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={lotForm.status}
                onValueChange={(value) => setLotForm({ ...lotForm, status: value as AuctionLot["status"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                  <SelectItem value="passed">Passed</SelectItem>
                  <SelectItem value="withdrawn">Withdrawn</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Title override</label>
              <Input
                value={lotForm.title_override}
                onChange={(event) => setLotForm({ ...lotForm, title_override: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Lot order</label>
              <Input
                type="number"
                value={lotForm.order_index}
                onChange={(event) => setLotForm({ ...lotForm, order_index: event.target.value })}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Estimate low</label>
                <Input
                  type="number"
                  value={lotForm.estimate_low}
                  onChange={(event) => setLotForm({ ...lotForm, estimate_low: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Estimate high</label>
                <Input
                  type="number"
                  value={lotForm.estimate_high}
                  onChange={(event) => setLotForm({ ...lotForm, estimate_high: event.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Reserve</label>
                <Input
                  type="number"
                  value={lotForm.reserve_amount}
                  onChange={(event) => setLotForm({ ...lotForm, reserve_amount: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Hammer price</label>
                <Input
                  type="number"
                  value={lotForm.hammer_price}
                  onChange={(event) => setLotForm({ ...lotForm, hammer_price: event.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Guarantee</label>
                <Input
                  type="number"
                  value={lotForm.guarantee_amount}
                  onChange={(event) => setLotForm({ ...lotForm, guarantee_amount: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Withdrawal reason</label>
                <Input
                  value={lotForm.withdrawal_reason}
                  onChange={(event) => setLotForm({ ...lotForm, withdrawal_reason: event.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Financing notes</label>
              <Input
                value={lotForm.financing_notes}
                onChange={(event) => setLotForm({ ...lotForm, financing_notes: event.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLotEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={updateLot} disabled={!isAdmin}>
              Save lot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={conditionOpen} onOpenChange={setConditionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Condition report</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Summary</label>
              <Input
                value={conditionSummary}
                onChange={(event) => setConditionSummary(event.target.value)}
                placeholder="Surface wear, minor chips, frame damage..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Report</label>
              <Textarea
                value={conditionText}
                onChange={(event) => setConditionText(event.target.value)}
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConditionOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveConditionReport} disabled={!canEdit}>
              Save report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
