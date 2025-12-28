// @ts-nocheck
"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

/** ---------- Small UI helpers (inline, no deps) ---------- */
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: 16,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      {children}
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 12,
        padding: "5px 10px",
        borderRadius: 999,
        border: "1px solid #e5e7eb",
        background: "#f8fafc",
        color: "#0f172a",
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function Button({
  children,
  onClick,
  variant = "primary",
  type = "button",
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const isPrimary = variant === "primary";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        border: isPrimary ? "1px solid #0f172a" : "1px solid #e5e7eb",
        background: isPrimary ? "#0f172a" : "white",
        color: isPrimary ? "white" : "#0f172a",
        fontWeight: 900,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}

function Label({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontWeight: 900, color: "#0f172a" }}>{title}</div>
      {subtitle ? (
        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>{subtitle}</div>
      ) : null}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (e: any) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        width: "100%",
        padding: 11,
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        outline: "none",
        background: "white",
      }}
    />
  );
}

function Notice({
  kind = "info",
  title,
  children,
}: {
  kind?: "info" | "success" | "error";
  title?: string;
  children: React.ReactNode;
}) {
  const styles =
    kind === "error"
      ? { border: "1px solid #fecaca", background: "#fff5f5" }
      : kind === "success"
      ? { border: "1px solid #bbf7d0", background: "#f0fdf4" }
      : { border: "1px solid #e5e7eb", background: "#f8fafc" };

  return (
    <div style={{ borderRadius: 16, padding: 14, ...styles }}>
      {title ? <div style={{ fontWeight: 900, marginBottom: 6 }}>{title}</div> : null}
      <div style={{ opacity: 0.92 }}>{children}</div>
    </div>
  );
}

/** ---------- helpers ---------- */
function formatPct(n?: number | null) {
  if (typeof n !== "number") return "";
  return `${(n * 100).toFixed(0)}%`;
}

export default function ObjectPage() {
  const params = useParams();
  const router = useRouter();
  const objectId = (params?.id as string) || "";

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [obj, setObj] = useState<any>(null);

  const [doc, setDoc] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);

  const [events, setEvents] = useState<any[]>([]);
  const [latestJob, setLatestJob] = useState<any>(null);

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const hasDoc = !!doc?.id;
  const canAI = !!latestJob?.id;

  const titleLine = useMemo(() => {
    if (!obj) return "Object";
    const t = obj.title || "Untitled";
    const a = obj.artist ? ` — ${obj.artist}` : "";
    return `${t}${a}`;
  }, [obj]);

  async function loadAll() {
    setLoading(true);
    setErr("");
    setMsg("");

    const { data: sess, error: sErr } = await supabase.auth.getSession();
    if (sErr) {
      setErr(sErr.message);
      setLoading(false);
      return;
    }
    const u = sess.session?.user;
    if (!u) {
      setErr("Not logged in. Go to /auth.");
      setLoading(false);
      return;
    }
    setUserEmail(u.email ?? null);

    // Load object
    const { data: o, error: oErr } = await supabase
      .from("objects")
      .select("*")
      .eq("id", objectId)
      .single();

    if (oErr) {
      setErr(oErr.message);
      setLoading(false);
      return;
    }
    setObj(o);

    // Load latest doc
    const { data: d, error: dErr } = await supabase
      .from("object_docs")
      .select("*")
      .eq("object_id", objectId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!dErr && d?.length) setDoc(d[0]);
    else setDoc(null);

    // Load latest AI job
    const { data: j, error: jErr } = await supabase
      .from("ai_extractions")
      .select("id,status,created_at,error")
      .eq("object_id", objectId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!jErr && j?.length) setLatestJob(j[0]);
    else setLatestJob(null);

    // Load events
    await loadEvents();

    setLoading(false);
  }

  async function loadEvents() {
    const { data, error } = await supabase
      .from("provenance_events")
      .select(
        "id,event_date,event_type,description,parties,location,status,confidence,evidence,created_at"
      )
      .eq("object_id", objectId)
      .order("event_date", { ascending: true, nullsFirst: true });

    if (!error) setEvents(data || []);
  }

  async function uploadDoc() {
    setErr("");
    setMsg("");

    if (!file) return setErr("Choose a file first.");
    if (!obj?.org_id) return setErr("Object org_id missing.");

    setBusy(true);

    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const path = `${obj.org_id}/${objectId}/${crypto.randomUUID()}.${ext}`;

    const { error: upErr } = await supabase.storage.from("object-docs").upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
    });

    if (upErr) {
      setErr(upErr.message);
      setBusy(false);
      return;
    }

    const { data: inserted, error: insErr } = await supabase
      .from("object_docs")
      .insert({
        org_id: obj.org_id,
        object_id: objectId,
        storage_path: path,
        doc_type: ext,
      })
      .select("*")
      .single();

    if (insErr) {
      setErr(insErr.message);
      setBusy(false);
      return;
    }

    setDoc(inserted);
    setFile(null);
    setMsg("Document uploaded ✅");
    setBusy(false);
  }

  async function queueAI() {
    setErr("");
    setMsg("");
    if (!obj?.org_id) return setErr("Object org_id missing.");

    setBusy(true);

    const { data: sess } = await supabase.auth.getSession();
    const u = sess.session?.user;
    if (!u) {
      setErr("Not logged in.");
      setBusy(false);
      return;
    }

    const { data: job, error: qErr } = await supabase
      .from("ai_extractions")
      .insert({
        org_id: obj.org_id,
        object_id: objectId,
        doc_id: doc?.id || null,
        status: "queued",
        created_by: u.id,
      })
      .select("id,status,created_at,error")
      .single();

    if (qErr) {
      setErr(qErr.message);
      setBusy(false);
      return;
    }

    setLatestJob(job);
    setMsg(`Queued AI Extraction ✅ (jobId=${job.id})`);
    setBusy(false);
  }

  async function processLatestAI() {
    setErr("");
    setMsg("");
    if (!latestJob?.id) return setErr("No AI job found yet. Queue one first.");

    setBusy(true);

    const res = await fetch("/api/ai/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: latestJob.id }),
    });

    const json = await res.json();

    if (!res.ok) {
      setErr(json?.error || "AI processing failed");
      setBusy(false);
      return;
    }

    setMsg("AI processed successfully ✅");
    await refreshJob();
    await loadEvents();
    setBusy(false);
  }

  async function refreshJob() {
    const { data: j, error: jErr } = await supabase
      .from("ai_extractions")
      .select("id,status,created_at,error")
      .eq("object_id", objectId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!jErr && j?.length) setLatestJob(j[0]);
  }

  async function updateEventStatus(id: string, status: "approved" | "rejected") {
    await supabase.from("provenance_events").update({ status }).eq("id", id);
    await loadEvents();
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectId]);

  if (loading) {
    return (
      <div style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
        <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 6, color: "#0f172a" }}>
          Loading object…
        </div>
        <div
          style={{
            height: 160,
            borderRadius: 16,
            background: "#f1f5f9",
            border: "1px solid #e5e7eb",
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#0f172a" }}>{titleLine}</div>
          <div style={{ opacity: 0.75, marginTop: 6 }}>
            Object ID: <code>{objectId}</code>
          </div>
          {userEmail ? (
            <div style={{ opacity: 0.75, marginTop: 6 }}>
              Session: <b>{userEmail}</b>
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Pill>Doc: {hasDoc ? "attached" : "none"}</Pill>
          <Pill>
            AI: {latestJob?.status ? latestJob.status : "none"}
          </Pill>
          <Button variant="secondary" onClick={loadAll}>
            Refresh
          </Button>
          <Button variant="secondary" onClick={() => router.push("/dashboard")}>
            Back
          </Button>
        </div>
      </div>

      {/* Status */}
      <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
        {err && (
          <Notice kind="error" title="Error">
            {err}
          </Notice>
        )}
        {msg && (
          <Notice kind="success" title="Success">
            {msg}
          </Notice>
        )}
        {latestJob?.error ? (
          <Notice kind="error" title="Last AI job error">
            {latestJob.error}
          </Notice>
        ) : null}
      </div>

      {/* Document */}
      <Card>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Document</div>
        <div style={{ opacity: 0.75, marginBottom: 12 }}>
          Upload a PDF/image/text file to improve extraction accuracy.
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <Label title="Attach a document" subtitle="PDF / PNG / JPG / WEBP / TXT / CSV / JSON" />
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button onClick={uploadDoc} disabled={busy || !file}>
                {busy ? "Working…" : "Upload Doc"}
              </Button>
              {doc?.storage_path ? (
                <Pill>Latest: {doc.storage_path}</Pill>
              ) : (
                <Pill>No doc uploaded yet</Pill>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* AI Extraction */}
      <div style={{ marginTop: 14 }}>
        <Card>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>AI Extraction</div>
          <div style={{ opacity: 0.75, marginBottom: 12 }}>
            Queue a job, then process it to generate extraction + timeline events.
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Button onClick={queueAI} disabled={busy}>
              {busy ? "Working…" : "Queue AI Extraction"}
            </Button>

            <Button variant="secondary" onClick={processLatestAI} disabled={busy || !canAI}>
              {busy ? "Working…" : "Process AI (latest job)"}
            </Button>

            <Button variant="secondary" onClick={refreshJob} disabled={busy}>
              Refresh Job Status
            </Button>

            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Latest job:{" "}
              {latestJob?.id ? (
                <>
                  <code>{latestJob.id}</code> · <b>{latestJob.status}</b>
                </>
              ) : (
                "none"
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Timeline */}
      <div style={{ marginTop: 14 }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900 }}>Provenance Timeline</div>
              <div style={{ opacity: 0.75, marginTop: 4 }}>
                AI suggestions are inserted as <b>pending</b>. Approve/reject to finalize.
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Button variant="secondary" onClick={loadEvents}>
                Refresh Timeline
              </Button>
              <Pill>Total: {events.length}</Pill>
            </div>
          </div>

          {events.length === 0 ? (
            <Notice title="No events yet">
              Run AI extraction to generate suggested timeline events.
            </Notice>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {events.map((e) => (
                <div
                  key={e.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 16,
                    padding: 14,
                    background: "white",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ fontWeight: 900 }}>
                      {(e.event_date || "Unknown date")} — {e.event_type}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 900 }}>
                      {String(e.status || "pending").toUpperCase()}
                      {typeof e.confidence === "number" ? ` · ${formatPct(e.confidence)}` : ""}
                    </div>
                  </div>

                  <div style={{ marginTop: 6 }}>{e.description}</div>

                  {(e.parties || e.location) && (
                    <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
                      {e.parties ? (
                        <div>
                          <b>Parties:</b> {e.parties}
                        </div>
                      ) : null}
                      {e.location ? (
                        <div>
                          <b>Location:</b> {e.location}
                        </div>
                      ) : null}
                    </div>
                  )}

                  {e.evidence ? (
                    <div style={{ marginTop: 8, fontSize: 12, opacity: 0.9 }}>
                      <b>Evidence:</b> {e.evidence}
                    </div>
                  ) : null}

                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    <Button onClick={() => updateEventStatus(e.id, "approved")}>
                      Approve
                    </Button>
                    <Button variant="secondary" onClick={() => updateEventStatus(e.id, "rejected")}>
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div style={{ marginTop: 16, opacity: 0.65, fontSize: 12 }}>
        Tip: Upload the strongest supporting docs first (auction invoice, appraisal, shipping, gallery receipt).
      </div>
    </div>
  );
}
