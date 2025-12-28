'use client';

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfidenceBar, EmptyState, EvidenceBlock, PageHeader, StatusPill, ConfirmDialog } from "@/components/ui-ext";
import { toast } from "sonner";
import type { ProvenanceEvent, Org } from "@/types/database";
import type { User } from "@supabase/supabase-js";

interface PendingObject {
  id: string;
  title: string;
  pendingCount: number;
}

export default function ReviewPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [pendingObjects, setPendingObjects] = useState<PendingObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [events, setEvents] = useState<ProvenanceEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [bulkThreshold, setBulkThreshold] = useState(70);
  const [confirmBulkOpen, setConfirmBulkOpen] = useState(false);

  async function requireSession() {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) {
      window.location.href = "/auth";
      return null;
    }
    return data.session.user;
  }

  async function loadOverview() {
    setLoading(true);
    setError("");

    const u = await requireSession();
    if (!u) return;
    setUser(u);

    const { data: prof } = await supabase
      .from("profiles")
      .select("org_id, orgs(*)")
      .eq("user_id", u.id)
      .single();

    if (!prof?.org_id) {
      window.location.href = "/setup";
      return;
    }

    const orgRow = Array.isArray(prof.orgs) ? prof.orgs[0] : prof.orgs;
    setOrg(orgRow ?? null);

    const { data: pendingEvents } = await supabase
      .from("provenance_events")
      .select("object_id")
      .eq("org_id", prof.org_id)
      .eq("status", "pending");

    const counts: Record<string, number> = {};
    (pendingEvents || []).forEach((evt) => {
      counts[evt.object_id] = (counts[evt.object_id] || 0) + 1;
    });

    const objectIds = Object.keys(counts);
    if (!objectIds.length) {
      setPendingObjects([]);
      setSelectedObjectId(null);
      setEvents([]);
      setLoading(false);
      return;
    }

    const { data: objects } = await supabase
      .from("objects")
      .select("id, title")
      .in("id", objectIds);

    const pendingList = (objects || []).map((obj) => ({
      id: obj.id,
      title: obj.title,
      pendingCount: counts[obj.id] || 0,
    }));

    pendingList.sort((a, b) => b.pendingCount - a.pendingCount);
    setPendingObjects(pendingList);
    setSelectedObjectId(pendingList[0]?.id || null);
    setLoading(false);
  }

  async function loadEvents(objectId: string) {
    const { data, error: err } = await supabase
      .from("provenance_events")
      .select("*")
      .eq("object_id", objectId)
      .eq("status", "pending")
      .order("confidence", { ascending: false });

    if (err) {
      setError(err.message);
      return;
    }

    setEvents(data || []);
  }

  useEffect(() => {
    loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedObjectId) {
      loadEvents(selectedObjectId);
    }
    setSelectedEvents([]);
  }, [selectedObjectId]);

  async function approveEvent(eventId: string) {
    if (!user) {
      toast.error("Session expired", { description: "Sign in again to approve events." });
      return;
    }
    const { error: err } = await supabase
      .from("provenance_events")
      .update({ status: "approved", approved_by: user.id, approved_at: new Date().toISOString() })
      .eq("id", eventId);

    if (err) {
      toast.error("Unable to approve", { description: err.message });
      return;
    }

    toast.success("Event approved");
    await loadOverview();
    if (selectedObjectId) {
      await loadEvents(selectedObjectId);
    }
  }

  async function rejectEvent(eventId: string) {
    if (!user) {
      toast.error("Session expired", { description: "Sign in again to reject events." });
      return;
    }
    const { error: err } = await supabase
      .from("provenance_events")
      .update({ status: "rejected", approved_by: user.id, approved_at: new Date().toISOString() })
      .eq("id", eventId);

    if (err) {
      toast.error("Unable to reject", { description: err.message });
      return;
    }

    toast.success("Event rejected");
    await loadOverview();
    if (selectedObjectId) {
      await loadEvents(selectedObjectId);
    }
  }

  async function bulkApprove() {
    if (!user) {
      toast.error("Session expired", { description: "Sign in again to approve events." });
      return;
    }
    const threshold = bulkThreshold / 100;
    const approvedIds = events
      .filter((event) => selectedEvents.includes(event.id))
      .filter((event) => (event.confidence ?? 0) >= threshold)
      .map((event) => event.id);

    if (!approvedIds.length) {
      toast.error("No events meet the confidence threshold.");
      return;
    }

    const { error: err } = await supabase
      .from("provenance_events")
      .update({ status: "approved", approved_by: user.id, approved_at: new Date().toISOString() })
      .in("id", approvedIds);

    if (err) {
      toast.error("Unable to approve events", { description: err.message });
      return;
    }

    toast.success(`${approvedIds.length} events approved`);
    setSelectedEvents([]);
    await loadOverview();
    if (selectedObjectId) {
      await loadEvents(selectedObjectId);
    }
  }

  const filteredObjects = useMemo(() => {
    if (!searchQuery.trim()) return pendingObjects;
    return pendingObjects.filter((obj) =>
      obj.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [pendingObjects, searchQuery]);

  if (loading) {
    return (
      <AppShell user={user} org={org}>
        <div className="space-y-6">
          <div className="h-10 w-48 rounded-xl bg-muted animate-pulse-soft" />
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <div className="h-96 rounded-2xl bg-muted animate-pulse-soft" />
            <div className="h-96 rounded-2xl bg-muted animate-pulse-soft" />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell user={user} org={org}>
      <div className="space-y-6">
        <PageHeader
          title="Timeline Review"
          subtitle="Approve or reject pending provenance events across all objects."
          breadcrumbs={[{ label: "Timeline Review" }]}
        />

        {error && (
          <Notice kind="error" onDismiss={() => setError("")}>
            {error}
          </Notice>
        )}

        {pendingObjects.length === 0 ? (
          <EmptyState
            title="All caught up"
            description="There are no pending events to review right now."
            actionLabel="Go to objects"
            onAction={() => (window.location.href = "/objects")}
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Pending Objects</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search objects"
                />
                <div className="space-y-2">
                  {filteredObjects.map((obj) => (
                    <button
                      key={obj.id}
                      onClick={() => setSelectedObjectId(obj.id)}
                      className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                        selectedObjectId === obj.id
                          ? "border-brand-500 bg-brand-50 text-brand-700"
                          : "border-border bg-background hover:bg-muted"
                      }`}
                    >
                      <div className="font-semibold">{obj.title}</div>
                      <div className="text-xs text-muted-foreground">{obj.pendingCount} pending</div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Pending Events</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/40 px-4 py-3">
                    <div className="text-sm text-muted-foreground">{selectedEvents.length} selected</div>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      Confidence threshold: {bulkThreshold}%
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={bulkThreshold}
                        onChange={(event) => setBulkThreshold(Number(event.target.value))}
                        className="w-40"
                      />
                    </label>
                    <Button variant="outline" disabled={!selectedEvents.length} onClick={() => setConfirmBulkOpen(true)}>
                      Bulk approve
                    </Button>
                  </div>

                  {events.length === 0 ? (
                    <EmptyState
                      title="No pending events"
                      description="Select another object to continue reviewing."
                    />
                  ) : (
                    <div className="space-y-4">
                      {events.map((event) => (
                        <Card key={event.id}>
                          <CardContent className="space-y-3">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div className="flex items-start gap-3">
                                <Checkbox
                                  checked={selectedEvents.includes(event.id)}
                                  onCheckedChange={(val) => {
                                    setSelectedEvents((prev) =>
                                      Boolean(val) ? [...prev, event.id] : prev.filter((id) => id !== event.id)
                                    );
                                  }}
                                />
                                <div>
                                  <h3 className="text-base font-semibold">{event.event_type}</h3>
                                  <p className="text-xs text-muted-foreground">
                                    {event.event_date || "Unknown date"}
                                  </p>
                                </div>
                              </div>
                              <StatusPill status={event.status} />
                            </div>
                            <p className="text-sm text-foreground">{event.description}</p>
                            {typeof event.confidence === "number" && (
                              <ConfidenceBar value={event.confidence} />
                            )}
                            {event.evidence && <EvidenceBlock snippet={event.evidence} />}
                            <div className="flex flex-wrap gap-2">
                              <Button onClick={() => approveEvent(event.id)}>Approve</Button>
                              <Button variant="outline" onClick={() => rejectEvent(event.id)}>
                                Reject
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmBulkOpen}
        title="Bulk approve events"
        description="Approve selected events that meet the confidence threshold."
        confirmLabel="Approve"
        onConfirm={() => {
          setConfirmBulkOpen(false);
          bulkApprove();
        }}
        onCancel={() => setConfirmBulkOpen(false)}
      />
    </AppShell>
  );
}
