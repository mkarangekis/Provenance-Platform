'use client';

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/lib/supabaseClient";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ConfidenceBar,
  EmptyState,
  EvidenceBlock,
  PageHeader,
  StatusPill,
  ConfirmDialog,
} from "@/components/ui-ext";
import type { AIExtraction, ObjectDoc, ProvenanceEvent, ProvenanceObject, Org, Profile } from "@/types/database";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";

const objectSchema = z.object({
  title: z.string().min(2, "Title is required"),
  artist: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["intake", "processing", "review", "complete", "archived"]),
});

const eventSchema = z.object({
  event_date: z.string().optional(),
  event_type: z.string().min(2, "Event type is required"),
  description: z.string().min(3, "Description is required"),
  parties: z.string().optional(),
  location: z.string().optional(),
  evidence: z.string().optional(),
});

type ObjectForm = z.infer<typeof objectSchema>;
type EventForm = z.infer<typeof eventSchema>;
type ProfileSummary = Pick<Profile, "org_id" | "role">;

export default function ObjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const objectId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [obj, setObj] = useState<ProvenanceObject | null>(null);
  const [docs, setDocs] = useState<ObjectDoc[]>([]);
  const [events, setEvents] = useState<ProvenanceEvent[]>([]);
  const [extractions, setExtractions] = useState<AIExtraction[]>([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ProvenanceEvent | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [bulkThreshold, setBulkThreshold] = useState(70);
  const [confirmBulkOpen, setConfirmBulkOpen] = useState(false);
  const [confirmBulkRejectOpen, setConfirmBulkRejectOpen] = useState(false);
  const [confirmRejectId, setConfirmRejectId] = useState<string | null>(null);
  const [confirmRerunOpen, setConfirmRerunOpen] = useState(false);
  const [processingAI, setProcessingAI] = useState(false);
  const [cataloging, setCataloging] = useState(false);
  const userId = user?.id;

  const objectForm = useForm<ObjectForm>({
    resolver: zodResolver(objectSchema),
    defaultValues: {
      title: "",
      artist: "",
      description: "",
      status: "intake",
    },
  });

  const eventForm = useForm<EventForm>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      event_date: "",
      event_type: "",
      description: "",
      parties: "",
      location: "",
      evidence: "",
    },
  });

  const pendingEvents = useMemo(
    () => events.filter((event) => event.status === "pending"),
    [events]
  );

  const approvedEvents = useMemo(
    () => events.filter((event) => event.status === "approved"),
    [events]
  );

  const lastAIStatus = extractions[0]?.status || "queued";
  const catalog = (obj?.metadata as {
    catalog?: {
      generatedAt?: string;
      result?: Record<string, unknown>;
      externalSources?: Array<{ source: string; url?: string }>;
    };
  } | null)?.catalog;
  const catalogStatus = obj?.catalog_status || "draft";

  useEffect(() => {
    setSelectedEvents([]);
  }, [events]);

  function friendlyError(message?: string) {
    if (!message) return "Something went wrong.";
    if (message.toLowerCase().includes("permission") || message.toLowerCase().includes("not authorized")) {
      return "Insufficient permission to perform this action.";
    }
    return message;
  }

  async function requireSession() {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) {
      router.push("/auth");
      return null;
    }
    return data.session.user;
  }

  async function loadAIJobs() {
    const { data } = await supabase
      .from("ai_extractions")
      .select("*")
      .eq("object_id", objectId)
      .order("created_at", { ascending: false });
    setExtractions(data || []);
  }

  async function loadData() {
    setLoading(true);
    setError("");

    const u = await requireSession();
    if (!u) return;
    setUser(u);

    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("org_id, role, orgs(*)")
      .eq("user_id", u.id)
      .single();

    if (profErr || !prof?.org_id) {
      router.push("/setup");
      return;
    }

    setProfile({ org_id: prof.org_id, role: prof.role });
    const orgRow = Array.isArray(prof.orgs) ? prof.orgs[0] : prof.orgs;
    setOrg(orgRow ?? null);

    const { data: objData, error: objErr } = await supabase
      .from("objects")
      .select("*")
      .eq("id", objectId)
      .single();

    if (objErr || !objData) {
      setError("Object not found");
      setLoading(false);
      return;
    }

    setObj(objData);
    objectForm.reset({
      title: objData.title,
      artist: objData.artist || "",
      description: objData.description || "",
      status: objData.status,
    });

    const [docsRes, eventsRes, aiRes] = await Promise.all([
      supabase
        .from("object_docs")
        .select("*")
        .eq("object_id", objectId)
        .order("created_at", { ascending: false }),
      supabase
        .from("provenance_events")
        .select("*")
        .eq("object_id", objectId)
        .order("event_date", { ascending: false }),
      supabase
        .from("ai_extractions")
        .select("*")
        .eq("object_id", objectId)
        .order("created_at", { ascending: false }),
    ]);

    setDocs(docsRes.data || []);
    setEvents(eventsRes.data || []);
    setExtractions(aiRes.data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab !== "ai") return;
    const interval = setInterval(() => {
      loadAIJobs();
    }, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  async function saveObject(values: ObjectForm) {
    if (!obj) return;
    const { error: updateErr } = await supabase
      .from("objects")
      .update({
        title: values.title,
        artist: values.artist || null,
        description: values.description || null,
        status: values.status,
      })
      .eq("id", objectId);

    if (updateErr) {
      toast.error("Unable to update object", { description: updateErr.message });
      return;
    }

    toast.success("Object updated");
    setEditOpen(false);
    await loadData();
  }

  async function uploadDocument() {
    if (!selectedFile || !user) return;
    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("objectId", objectId);
    formData.append("docType", selectedFile.name.split(".").pop() || "other");
    formData.append("userId", user.id);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload", true);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setUploadProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        toast.success("Document uploaded");
        setSelectedFile(null);
        await loadData();
      } else {
        const resp = JSON.parse(xhr.responseText || "{}");
        toast.error("Upload failed", { description: resp.error || "Please try again." });
      }
      setUploading(false);
    };
    xhr.onerror = () => {
      toast.error("Upload failed", { description: "Network error. Try again." });
      setUploading(false);
    };
    xhr.send(formData);
  }

  async function getDocUrl(docId: string) {
    if (!userId) {
      toast.error("Session expired", { description: "Sign in again to download documents." });
      return;
    }
    const res = await fetch(`/api/doc-url?docId=${docId}&userId=${userId}`);
    if (res.ok) {
      const data = await res.json();
      window.open(data.url, "_blank");
    } else {
      toast.error("Unable to download document");
    }
  }

  async function queueAI(docId?: string) {
    if (!user) return;
    const res = await fetch("/api/ai/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objectId, docId, userId: user.id }),
    });

    const data = await res.json();
    if (!res.ok) {
      toast.error("Unable to queue AI job", { description: data.error });
      return;
    }

    toast.success("AI extraction queued");
    await loadAIJobs();
    return data.job?.id as string | undefined;
  }

  async function runNow(docId?: string) {
    const jobId = await queueAI(docId);
    if (!jobId) return;
    setProcessingAI(true);
    const res = await fetch("/api/ai/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    });
    if (!res.ok) {
      const data = await res.json();
      toast.error("AI processing failed", { description: data.error });
    } else {
      toast.success("AI extraction completed");
      await loadData();
    }
    setProcessingAI(false);
  }

  async function generateCatalog() {
    if (!userId) {
      toast.error("Session expired", { description: "Sign in again to generate catalog data." });
      return;
    }
    setCataloging(true);
    const res = await fetch("/api/catalog/auto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objectId, userId }),
    });

    if (!res.ok) {
      const data = await res.json();
      toast.error("Catalog generation failed", { description: data.error || "Try again." });
      setCataloging(false);
      return;
    }

    toast.success("Catalog generated");
    await loadData();
    setCataloging(false);
  }

  async function queueCatalog(scope: "object" | "org") {
    if (!userId) {
      toast.error("Session expired", { description: "Sign in again to queue cataloging." });
      return;
    }
    const payload =
      scope === "org"
        ? { userId, scope: "org" }
        : { userId, scope: "object", objectId };
    const res = await fetch("/api/catalog/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      toast.error("Unable to queue catalog", { description: data.error || "Try again." });
      return;
    }

    toast.success(`Queued ${data.queued || 0} catalog job(s)`);
  }

  async function approveCatalog() {
    if (!userId) {
      toast.error("Session expired", { description: "Sign in again to approve catalog." });
      return;
    }
    const res = await fetch("/api/catalog/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objectId, userId }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error("Unable to approve catalog", { description: data.error || "Try again." });
      return;
    }
    toast.success("Catalog approved");
    await loadData();
  }

  async function updateEventStatus(action: "approve" | "reject", eventIds: string[]) {
    if (!userId) {
      toast.error("Session expired", { description: "Sign in again to update events." });
      return;
    }

    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, eventIds, userId }),
    });

    if (!res.ok) {
      const data = await res.json();
      toast.error("Unable to update events", { description: friendlyError(data.error) });
      return;
    }

    toast.success(action === "approve" ? "Event approved" : "Event rejected");
    await loadData();
  }

  async function approveEvent(eventId: string) {
    await updateEventStatus("approve", [eventId]);
  }

  async function rejectEvent(eventId: string) {
    await updateEventStatus("reject", [eventId]);
  }

  async function saveEvent(values: EventForm) {
    if (editingEvent) {
      const { error: updateErr } = await supabase
        .from("provenance_events")
        .update(values)
        .eq("id", editingEvent.id);

      if (updateErr) {
        toast.error("Unable to update event", { description: friendlyError(updateErr.message) });
        return;
      }
    } else {
      const { error: insertErr } = await supabase.from("provenance_events").insert({
        ...values,
        org_id: org?.id,
        object_id: objectId,
        status: "pending",
      });

      if (insertErr) {
        toast.error("Unable to create event", { description: friendlyError(insertErr.message) });
        return;
      }
    }

    toast.success(editingEvent ? "Event updated" : "Event created");
    setEventModalOpen(false);
    setEditingEvent(null);
    await loadData();
  }

  async function bulkApprove() {
    if (!userId) {
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

    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve", eventIds: approvedIds, userId }),
    });

    if (!res.ok) {
      const data = await res.json();
      toast.error("Unable to approve events", { description: friendlyError(data.error) });
      return;
    }

    toast.success(`${approvedIds.length} events approved`);
    setSelectedEvents([]);
    await loadData();
  }

  async function bulkReject() {
    if (!selectedEvents.length) return;
    if (!userId) {
      toast.error("Session expired", { description: "Sign in again to reject events." });
      return;
    }

    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", eventIds: selectedEvents, userId }),
    });

    if (!res.ok) {
      const data = await res.json();
      toast.error("Unable to reject events", { description: friendlyError(data.error) });
      return;
    }

    toast.success(`${selectedEvents.length} events rejected`);
    setSelectedEvents([]);
    await loadData();
  }

  const canEdit = profile?.role !== "viewer";

  if (loading) {
    return (
      <AppShell user={user} org={org} primaryAction={{ label: "Back to Objects", href: "/objects" }}>
        <div className="space-y-6">
          <div className="h-10 w-48 rounded-xl bg-muted animate-pulse-soft" />
          <div className="h-72 rounded-2xl bg-muted animate-pulse-soft" />
        </div>
      </AppShell>
    );
  }

  if (!obj) {
    return (
      <AppShell user={user} org={org}>
        <Notice kind="error">Object not found.</Notice>
      </AppShell>
    );
  }

  return (
    <AppShell user={user} org={org} primaryAction={{ label: "Back to Objects", href: "/objects" }}>
      <div className="space-y-6">
        <PageHeader
          title={obj.title}
          subtitle={obj.artist || "Unknown artist"}
          breadcrumbs={[
            { label: "Objects", href: "/objects" },
            { label: "Object Workspace" },
          ]}
          actions={
            <Button variant="outline" onClick={() => setEditOpen(true)} disabled={!canEdit}>
              {canEdit ? "Edit object" : "View only"}
            </Button>
          }
        />

        {error && (
          <Notice kind="error" onDismiss={() => setError("")}>
            {error}
          </Notice>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardContent className="space-y-1">
              <p className="text-xs uppercase text-muted-foreground">Documents</p>
              <p className="text-2xl font-semibold">{docs.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-1">
              <p className="text-xs uppercase text-muted-foreground">Events</p>
              <p className="text-2xl font-semibold">{events.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-1">
              <p className="text-xs uppercase text-muted-foreground">Pending</p>
              <p className="text-2xl font-semibold">{pendingEvents.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-1">
              <p className="text-xs uppercase text-muted-foreground">Last AI Status</p>
              <div className="mt-1">
                <StatusPill status={lastAIStatus} />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="ai">AI Extraction</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
            <TabsTrigger value="catalog">Catalog</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Card>
              <CardHeader>
                <CardTitle>Object details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Title</p>
                  <p className="mt-1 font-semibold">{obj.title}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Artist</p>
                  <p className="mt-1">{obj.artist || "Unknown"}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-xs uppercase text-muted-foreground">Description</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {obj.description || "No description provided yet."}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Status</p>
                  <div className="mt-1">
                    <StatusPill status={obj.status} />
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Created</p>
                  <p className="mt-1 text-sm">{new Date(obj.created_at).toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Upload document</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div
                    className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/40 px-6 py-8 text-center"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      const file = event.dataTransfer.files?.[0];
                      if (file) setSelectedFile(file);
                    }}
                  >
                    <p className="text-sm font-medium text-foreground">Drag & drop files here</p>
                    <p className="text-xs text-muted-foreground">PDF, PNG, JPG, TXT, CSV, JSON up to 25MB</p>
                    <label className="cursor-pointer text-sm font-semibold text-primary-300 underline">
                      Browse files
                      <input
                        type="file"
                        className="hidden"
                        onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                        accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.json"
                      />
                    </label>
                    {selectedFile && (
                      <p className="text-xs text-muted-foreground">Selected: {selectedFile.name}</p>
                    )}
                    {uploading && (
                      <div className="w-full max-w-sm">
                        <div className="h-2 w-full rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full bg-primary transition-all"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{uploadProgress}% uploaded</p>
                      </div>
                    )}
                  </div>
                  <Button disabled={!selectedFile || uploading} onClick={uploadDocument}>
                    {uploading ? "Uploading..." : "Upload document"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Documents</CardTitle>
                </CardHeader>
                <CardContent>
                  {docs.length === 0 ? (
                    <EmptyState
                      title="Upload a document to enable AI extraction"
                      description="Documents power the provenance timeline by extracting key events."
                    />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>File</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Uploaded</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {docs.map((doc) => (
                          <TableRow key={doc.id}>
                            <TableCell className="font-semibold">
                              {doc.original_filename || doc.storage_path.split("/").pop()}
                            </TableCell>
                            <TableCell className="uppercase text-xs">{doc.doc_type}</TableCell>
                            <TableCell>{new Date(doc.created_at).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => getDocUrl(doc.id)}>
                                Download
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
          </TabsContent>

          <TabsContent value="timeline">
            <div className="space-y-4">
              {pendingEvents.length === 0 && events.length === 0 ? (
                <EmptyState
                  title="No events yet"
                  description="Upload a document and run AI extraction to populate the timeline."
                  actionLabel="Queue AI extraction"
                  onAction={() => setActiveTab("ai")}
                />
              ) : (
                <>
                  <div className="flex flex-col gap-4 rounded-2xl border border-border bg-muted/40 px-4 py-3 md:flex-row md:items-center md:justify-between">
                    <div className="text-sm text-muted-foreground">
                      {selectedEvents.length} selected
                    </div>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center">
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
                      <div className="flex gap-2">
                        <Button variant="outline" disabled={!selectedEvents.length} onClick={() => setConfirmBulkOpen(true)}>
                          Bulk approve
                        </Button>
                        <Button variant="destructive" disabled={!selectedEvents.length} onClick={() => setConfirmBulkRejectOpen(true)}>
                          Bulk reject
                        </Button>
                        {canEdit && (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setEditingEvent(null);
                              eventForm.reset({
                                event_date: "",
                                event_type: "",
                                description: "",
                                parties: "",
                                location: "",
                                evidence: "",
                              });
                              setEventModalOpen(true);
                            }}
                          >
                            Add manual event
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {events.map((event) => (
                      <Card key={event.id}>
                        <CardContent className="space-y-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex items-start gap-3">
                              {event.status === "pending" && (
                                <Checkbox
                                  checked={selectedEvents.includes(event.id)}
                                  onCheckedChange={(val) => {
                                    setSelectedEvents((prev) =>
                                      Boolean(val) ? [...prev, event.id] : prev.filter((id) => id !== event.id)
                                    );
                                  }}
                                />
                              )}
                              <div>
                                <h3 className="text-lg font-semibold">{event.event_type}</h3>
                                <p className="text-sm text-muted-foreground">
                                  {event.event_date || "Unknown date"}
                                </p>
                              </div>
                            </div>
                            <StatusPill status={event.status} />
                          </div>
                          <p className="text-sm text-foreground">{event.description}</p>
                          <div className="grid gap-3 md:grid-cols-2 text-sm text-muted-foreground">
                            {event.parties && <div><strong className="text-foreground">Parties:</strong> {event.parties}</div>}
                            {event.location && <div><strong className="text-foreground">Location:</strong> {event.location}</div>}
                          </div>
                          {typeof event.confidence === "number" && (
                            <ConfidenceBar value={event.confidence} />
                          )}
                          {event.evidence && (
                            <EvidenceBlock snippet={event.evidence} />
                          )}
                          {event.status === "pending" && (
                            <div className="flex flex-wrap gap-2">
                              <Button variant="outline" onClick={() => {
                                setEditingEvent(event);
                                setEventModalOpen(true);
                                eventForm.reset({
                                  event_date: event.event_date || "",
                                  event_type: event.event_type,
                                  description: event.description,
                                  parties: event.parties || "",
                                  location: event.location || "",
                                  evidence: event.evidence || "",
                                });
                              }}>
                                Edit
                              </Button>
                              <Button onClick={() => approveEvent(event.id)}>Approve</Button>
                              <Button variant="destructive" onClick={() => setConfirmRejectId(event.id)}>
                                Reject
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="ai">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>AI extraction controls</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button onClick={() => queueAI()} disabled={processingAI}>
                    Queue job
                  </Button>
                  <Button variant="outline" onClick={() => runNow()} disabled={processingAI}>
                    Run now
                  </Button>
                  <Button variant="outline" onClick={() => setConfirmRerunOpen(true)} disabled={processingAI}>
                    Re-run extraction
                  </Button>
                </CardContent>
              </Card>

              {extractions.length === 0 ? (
                <EmptyState
                  title="No AI jobs yet"
                  description="Queue a manual extraction or upload a document to begin."
                />
              ) : (
                <div className="space-y-4">
                  {extractions.map((job) => (
                    <Card key={job.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">
                            {job.source === "document" ? "Document Extraction" : "Manual Extraction"}
                          </CardTitle>
                          <StatusPill status={job.status} />
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="text-xs text-muted-foreground">
                          Created {new Date(job.created_at).toLocaleString()}
                        </div>
                        {job.error && (
                          <Notice kind="error">{job.error}</Notice>
                        )}
                        {job.extracted_text && (
                          <details className="rounded-xl border border-border p-3">
                            <summary className="cursor-pointer text-sm font-medium">
                              View extracted text
                            </summary>
                            <pre className="mt-2 max-h-60 overflow-auto text-xs text-muted-foreground">
                              {job.extracted_text.slice(0, 2000)}
                              {job.extracted_text.length > 2000 && "..."}
                            </pre>
                          </details>
                        )}
                        {Boolean(job.extracted_json) && (
                          <details className="rounded-xl border border-border p-3">
                            <summary className="cursor-pointer text-sm font-medium">
                              View extracted JSON
                            </summary>
                            <pre className="mt-2 max-h-60 overflow-auto text-xs text-muted-foreground">
                              {JSON.stringify(job.extracted_json, null, 2)}
                            </pre>
                          </details>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="export">
            <Card>
              <CardHeader>
                <CardTitle>Export object data</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <Button
                    variant="outline"
                    disabled={approvedEvents.length === 0}
                    onClick={() => {
                      if (!userId) {
                        toast.error("Session expired", { description: "Sign in again to export." });
                        return;
                      }
                      window.open(`/api/export/${objectId}?format=json&userId=${userId}`, "_blank");
                    }}
                  >
                    Export JSON
                  </Button>
                  <Button
                    variant="outline"
                    disabled={approvedEvents.length === 0}
                    onClick={() => {
                      if (!userId) {
                        toast.error("Session expired", { description: "Sign in again to export." });
                        return;
                      }
                      window.open(`/api/export/${objectId}?format=csv&userId=${userId}`, "_blank");
                    }}
                  >
                    Export CSV
                  </Button>
                  <Button
                    variant="outline"
                    disabled={approvedEvents.length === 0}
                    onClick={() => {
                      if (!userId) {
                        toast.error("Session expired", { description: "Sign in again to export." });
                        return;
                      }
                      window.open(`/api/export/${objectId}?format=pdf&userId=${userId}`, "_blank");
                    }}
                  >
                    Export PDF/HTML
                  </Button>
                </div>
                <Card className="border border-dashed border-border bg-muted/40">
                  <CardContent className="space-y-2">
                    <p className="text-sm font-medium">Preview</p>
                    <p className="text-xs text-muted-foreground">
                      {approvedEvents.length} approved events will be included in exports.
                    </p>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="catalog">
            <Card>
              <CardHeader>
                <CardTitle>AI cataloging</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Generate catalog data using internal records plus Wikidata, The Met, and Art Institute of Chicago.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={generateCatalog} disabled={cataloging}>
                    {cataloging ? "Generating..." : "Generate catalog now"}
                  </Button>
                  <Button variant="outline" onClick={() => queueCatalog("object")}>
                    Queue for this object
                  </Button>
                  <Button variant="outline" onClick={() => queueCatalog("org")}>
                    Queue for org
                  </Button>
                  {profile?.role && (profile.role === "admin" || profile.role === "owner") && catalog && (
                    <Button variant="secondary" onClick={approveCatalog} disabled={catalogStatus === "approved"}>
                      {catalogStatus === "approved" ? "Approved" : "Approve catalog"}
                    </Button>
                  )}
                </div>
                {catalog?.generatedAt ? (
                  <div className="rounded-2xl border border-border bg-muted/40 p-4">
                    <div className="text-xs text-muted-foreground">
                      Generated {new Date(catalog.generatedAt).toLocaleString()} · Status: {catalogStatus}
                    </div>
                    <pre className="mt-2 max-h-80 overflow-auto text-xs text-muted-foreground">
                      {JSON.stringify(catalog.result || {}, null, 2)}
                    </pre>
                    {Array.isArray(catalog.externalSources) && catalog.externalSources.length > 0 ? (
                      <div className="mt-3 text-xs text-muted-foreground">
                        Sources:{" "}
                        {catalog.externalSources.map((source) => source.url || source.source).join(", ")}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <EmptyState
                    title="No catalog data yet"
                    description="Run catalog generation to produce a draft entry."
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit object</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={objectForm.handleSubmit(saveObject)}>
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input {...objectForm.register("title")} />
              {objectForm.formState.errors.title && (
                <p className="text-xs text-destructive">{objectForm.formState.errors.title.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Artist</label>
              <Input {...objectForm.register("artist")} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea {...objectForm.register("description")} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <select
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...objectForm.register("status")}
              >
                <option value="intake">Intake</option>
                <option value="processing">Processing</option>
                <option value="review">Review</option>
                <option value="complete">Complete</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={objectForm.formState.isSubmitting}>
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={eventModalOpen} onOpenChange={setEventModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEvent ? "Edit event" : "Add manual event"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={eventForm.handleSubmit(saveEvent)}>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Event date</label>
                <Input type="date" {...eventForm.register("event_date")} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Event type</label>
                <Input {...eventForm.register("event_type")} />
                {eventForm.formState.errors.event_type && (
                  <p className="text-xs text-destructive">{eventForm.formState.errors.event_type.message}</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea {...eventForm.register("description")} />
              {eventForm.formState.errors.description && (
                <p className="text-xs text-destructive">{eventForm.formState.errors.description.message}</p>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Parties</label>
                <Input {...eventForm.register("parties")} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Location</label>
                <Input {...eventForm.register("location")} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Evidence</label>
              <Textarea {...eventForm.register("evidence")} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEventModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={eventForm.formState.isSubmitting}>
                Save event
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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

      <ConfirmDialog
        open={confirmBulkRejectOpen}
        title="Bulk reject events"
        description="Reject selected events and remove them from the approval queue."
        confirmLabel="Reject"
        onConfirm={() => {
          setConfirmBulkRejectOpen(false);
          bulkReject();
        }}
        onCancel={() => setConfirmBulkRejectOpen(false)}
      />

      <ConfirmDialog
        open={Boolean(confirmRejectId)}
        title="Reject event"
        description="Rejecting an event removes it from the approval queue. This action can be reversed later."
        confirmLabel="Reject"
        onConfirm={() => {
          if (confirmRejectId) {
            rejectEvent(confirmRejectId);
          }
          setConfirmRejectId(null);
        }}
        onCancel={() => setConfirmRejectId(null)}
      />

      <ConfirmDialog
        open={confirmRerunOpen}
        title="Re-run AI extraction"
        description="Re-running will create a new AI job and may incur additional costs."
        confirmLabel="Re-run"
        onConfirm={() => {
          setConfirmRerunOpen(false);
          runNow();
        }}
        onCancel={() => setConfirmRerunOpen(false)}
      />
    </AppShell>
  );
}
