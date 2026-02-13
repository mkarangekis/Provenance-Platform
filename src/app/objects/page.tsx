'use client';

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/lib/supabaseClient";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/registrata/GlassCard";
import { SectionHeader } from "@/components/registrata/SectionHeader";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState, TableSkeleton, StatusPill } from "@/components/ui-ext";
import { toast } from "sonner";
import type { ProvenanceObject, Org } from "@/types/database";
import type { User } from "@supabase/supabase-js";

const formSchema = z.object({
  title: z.string().min(2, "Title is required"),
  artist: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const PAGE_SIZE = 20;

type ObjectListItem = Pick<
  ProvenanceObject,
  "id" | "title" | "artist" | "status" | "updated_at" | "created_at"
>;

function ObjectsListContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("query") || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [objects, setObjects] = useState<ObjectListItem[]>([]);
  const [docCounts, setDocCounts] = useState<Record<string, number>>({});
  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>({});
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasDocsFilter, setHasDocsFilter] = useState(false);
  const [hasPendingFilter, setHasPendingFilter] = useState(false);
  const [sortOrder, setSortOrder] = useState("updated_at-desc");
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [user, setUser] = useState<User | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [openModal, setOpenModal] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", artist: "" },
  });

  async function requireSession() {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) {
      window.location.href = "/auth";
      return null;
    }
    return data.session.user;
  }

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  async function loadData() {
    setLoading(true);
    setError("");

    const u = await requireSession();
    if (!u) return;
    setUser(u);

    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("org_id, orgs(*)")
      .eq("user_id", u.id)
      .single();

    if (profErr || !prof?.org_id) {
      window.location.href = "/setup";
      return;
    }

    const orgRow = Array.isArray(prof.orgs) ? prof.orgs[0] : prof.orgs;
    setOrg(orgRow ?? null);

    let pendingObjectIds: string[] | null = null;
    let docObjectIds: string[] | null = null;

    if (hasPendingFilter) {
      const { data: pendingRows } = await supabase
        .from("provenance_events")
        .select("object_id")
        .eq("org_id", prof.org_id)
        .eq("status", "pending");
      pendingObjectIds = Array.from(new Set((pendingRows || []).map((row) => row.object_id)));
    }

    if (hasDocsFilter) {
      const { data: docRows } = await supabase
        .from("object_docs")
        .select("object_id")
        .eq("org_id", prof.org_id);
      docObjectIds = Array.from(new Set((docRows || []).map((row) => row.object_id)));
    }

    let query = supabase
      .from("objects")
      .select("id, title, artist, status, updated_at, created_at", { count: "exact" })
      .eq("org_id", prof.org_id);

    if (debouncedQuery) {
      query = query.or(
        `title.ilike.%${debouncedQuery}%,artist.ilike.%${debouncedQuery}%,description.ilike.%${debouncedQuery}%`
      );
    }

    if (pendingObjectIds) {
      query = query.in("id", pendingObjectIds.length ? pendingObjectIds : [""]);
    }

    if (docObjectIds) {
      query = query.in("id", docObjectIds.length ? docObjectIds : [""]);
    }

    const [rawField, rawDirection] = sortOrder.split("-");
    const sortField = rawField === "created_at" ? "created_at" : "updated_at";
    const sortDirection = rawDirection === "asc" ? "asc" : "desc";
    query = query.order(sortField, { ascending: sortDirection === "asc" });

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data: rows, error: rowsErr, count } = await query.range(from, to);

    if (rowsErr) {
      setError(rowsErr.message);
      setLoading(false);
      return;
    }

    const objectIds = (rows || []).map((obj) => obj.id);

    const [docsRes, eventsRes] = await Promise.all([
      supabase.from("object_docs").select("object_id").in("object_id", objectIds),
      supabase
        .from("provenance_events")
        .select("object_id, status")
        .in("object_id", objectIds),
    ]);

    const docsCount: Record<string, number> = {};
    (docsRes.data || []).forEach((doc) => {
      docsCount[doc.object_id] = (docsCount[doc.object_id] || 0) + 1;
    });

    const pendingCount: Record<string, number> = {};
    (eventsRes.data || []).forEach((evt) => {
      if (evt.status === "pending") {
        pendingCount[evt.object_id] = (pendingCount[evt.object_id] || 0) + 1;
      }
    });

    setObjects(rows || []);
    setDocCounts(docsCount);
    setPendingCounts(pendingCount);
    setTotalCount(count || 0);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, hasDocsFilter, hasPendingFilter, sortOrder, page]);

  async function onSubmit(values: FormValues) {
    if (!org || !user) return;
    const res = await fetch("/api/objects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        title: values.title.trim(),
        artist: values.artist?.trim() || null,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      toast.error("Unable to create object", { description: data.error || "Try again." });
      return;
    }

    toast.success("Object created", { description: "Redirecting to the workspace." });
    setOpenModal(false);
    form.reset();
    router.push(`/objects/${data.id}`);
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <AppShell user={user} org={org} primaryAction={{ label: "New Object", onClick: () => setOpenModal(true) }}>
      <div className="space-y-8">
        <SectionHeader
          kicker="Stage 1"
          title="Intake Workspace"
          subtitle="Manage, search, and prioritize artwork intake records across your organization."
        />

        {error && (
          <Notice kind="error" onDismiss={() => setError("")}>
            <div className="flex flex-col gap-2">
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={loadData}>
                Retry
              </Button>
            </div>
          </Notice>
        )}

        <GlassCard>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-text-muted">Search & Filters</p>
            <h3 className="text-lg font-semibold text-white">Refine intake records</h3>
          </div>
          <div className="mt-5 space-y-4">
            <div className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr]">
              <Input
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search by title, artist, or description"
              />
              <Select
                value={sortOrder}
                onValueChange={(value) => {
                  setSortOrder(value);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="updated_at-desc">Recently updated</SelectItem>
                  <SelectItem value="updated_at-asc">Oldest updated</SelectItem>
                  <SelectItem value="created_at-desc">Newest created</SelectItem>
                  <SelectItem value="created_at-asc">Oldest created</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex flex-col gap-3 text-sm text-text-secondary">
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={hasPendingFilter}
                    onCheckedChange={(val) => {
                      setHasPendingFilter(Boolean(val));
                      setPage(1);
                    }}
                  />
                  Has pending events
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={hasDocsFilter}
                    onCheckedChange={(val) => {
                      setHasDocsFilter(Boolean(val));
                      setPage(1);
                    }}
                  />
                  Has documents
                </label>
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-text-muted">Intake Records</p>
              <h3 className="text-lg font-semibold text-white">Showing {objects.length} of {totalCount}</h3>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/review">Review pending events</Link>
            </Button>
          </div>
          <div className="mt-5">
            {loading ? (
              <TableSkeleton rows={8} />
            ) : objects.length === 0 ? (
              <EmptyState
                title="No objects found"
                description="Create a new object to begin building its provenance record."
                actionLabel="New Object"
                onAction={() => setOpenModal(true)}
              />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border-muted">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Artist</TableHead>
                    <TableHead>Docs</TableHead>
                    <TableHead>Timeline Status</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {objects.map((obj) => {
                    const pending = pendingCounts[obj.id] || 0;
                    return (
                      <TableRow key={obj.id}>
                        <TableCell className="font-semibold text-white">{obj.title}</TableCell>
                        <TableCell className="text-text-secondary">{obj.artist || "Unknown"}</TableCell>
                        <TableCell className="text-text-secondary">{docCounts[obj.id] || 0}</TableCell>
                        <TableCell>
                          {pending > 0 ? (
                            <div className="flex items-center gap-2">
                              <StatusPill status="pending" />
                              <span className="text-xs text-text-muted">{pending} pending</span>
                            </div>
                          ) : (
                            <StatusPill status="approved" />
                          )}
                        </TableCell>
                        <TableCell className="text-text-secondary">
                          {new Date(obj.updated_at || obj.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/objects/${obj.id}`}>View</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                </Table>
              </div>
            )}
          </div>
        </GlassCard>

        <div className="flex items-center justify-between text-sm text-text-muted">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>

        <Dialog open={openModal} onOpenChange={setOpenModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Intake Record</DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">Title</label>
                <Input {...form.register("title")} placeholder="Untitled, 1954" />
                {form.formState.errors.title && (
                  <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">Artist</label>
                <Input {...form.register("artist")} placeholder="Optional" />
                <p className="text-xs text-text-muted">Add the primary attribution if known.</p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpenModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Creating..." : "Create object"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}

export default function ObjectsListPage() {
  return (
    <Suspense
      fallback={
        <AppShell user={null} org={null}>
          <TableSkeleton rows={8} />
        </AppShell>
      }
    >
      <ObjectsListContent />
    </Suspense>
  );
}
