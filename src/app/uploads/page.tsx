'use client';

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/registrata/GlassCard";
import { SectionHeader } from "@/components/registrata/SectionHeader";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, TableSkeleton } from "@/components/ui-ext";
import { toast } from "sonner";
import type { ObjectDoc, ProvenanceObject, Org } from "@/types/database";
import type { User } from "@supabase/supabase-js";

const PAGE_SIZE = 20;

export default function UploadsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [docs, setDocs] = useState<ObjectDoc[]>([]);
  const [objects, setObjects] = useState<Record<string, ProvenanceObject>>({});
  const [user, setUser] = useState<User | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const userId = user?.id;

  async function requireSession() {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) {
      window.location.href = "/auth";
      return null;
    }
    return data.session.user;
  }

  async function loadData() {
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

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data: docsData, error: docsErr, count } = await supabase
      .from("object_docs")
      .select("*", { count: "exact" })
      .eq("org_id", prof.org_id)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (docsErr) {
      setError(docsErr.message);
      setLoading(false);
      return;
    }

    const objectIds = (docsData || []).map((doc) => doc.object_id);
    const { data: objectRows } = await supabase
      .from("objects")
      .select("id, title")
      .in("id", objectIds);

    const objectMap: Record<string, ProvenanceObject> = {};
    (objectRows || []).forEach((row) => {
      objectMap[row.id] = row as ProvenanceObject;
    });

    setDocs(docsData || []);
    setObjects(objectMap);
    setTotalCount(count || 0);
    setLoading(false);
  }

  async function downloadDoc(docId: string) {
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

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const filteredDocs = useMemo(() => {
    if (!searchQuery.trim()) return docs;
    return docs.filter((doc) => {
      const title = objects[doc.object_id]?.title || "";
      return title.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [docs, objects, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  if (loading) {
    return (
      <AppShell user={user} org={org}>
        <TableSkeleton rows={6} />
      </AppShell>
    );
  }

  return (
    <AppShell user={user} org={org}>
      <div className="space-y-8">
        <SectionHeader
          kicker="Evidence"
          title="Upload Audit"
          subtitle="Audit document uploads across your organization."
        />

        {error && (
          <Notice kind="error" onDismiss={() => setError("")}>
            {error}
          </Notice>
        )}

        <GlassCard>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-text-muted">Document uploads</p>
            <h3 className="text-lg font-semibold text-white">Evidence archive</h3>
          </div>
          <div className="mt-4 space-y-4">
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by object title"
            />

            {filteredDocs.length === 0 ? (
              <EmptyState
                title="No uploads yet"
                description="Upload documents from the Objects page to start an audit trail."
                actionLabel="Go to Objects"
                onAction={() => (window.location.href = "/objects")}
              />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border-muted">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Uploaded</TableHead>
                      <TableHead>Object</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Storage path</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDocs.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="text-text-secondary">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="font-semibold text-white">
                          <Link href={`/objects/${doc.object_id}`} className="hover:underline">
                            {objects[doc.object_id]?.title || "Object"}
                          </Link>
                        </TableCell>
                        <TableCell className="uppercase text-xs text-text-secondary">{doc.doc_type}</TableCell>
                        <TableCell className="text-xs text-text-muted">{doc.storage_path}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => downloadDoc(doc.id)}>
                            Download
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
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
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
