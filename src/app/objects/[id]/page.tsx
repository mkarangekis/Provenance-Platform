"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Obj = { id: string; org_id: string; title: string; artist: string | null; status: string | null; };
type Doc = { id: string; doc_type: string | null; storage_path: string; created_at: string; };
type Event = { id: string; event_type: string; event_date: string | null; party: string | null; location: string | null; confidence: number | null; };

export default function ObjectDetail({ params }: { params: { id: string } }) {
  const objectId = params.id;

  const [obj, setObj] = useState<Obj | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [latestScore, setLatestScore] = useState<number | null>(null);

  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  // new event fields
  const [eventType, setEventType] = useState("acquired");
  const [eventDate, setEventDate] = useState("");
  const [party, setParty] = useState("");
  const [location, setLocation] = useState("");
  const [confidence, setConfidence] = useState(60);

  // upload fields
  const [docType, setDocType] = useState("provenance");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function load() {
    setLoading(true);
    setErr("");

    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user) {
      window.location.href = "/auth";
      return;
    }

    const { data: o, error: oErr } = await supabase
      .from("objects")
      .select("id,org_id,title,artist,status")
      .eq("id", objectId)
      .single();

    if (oErr) { setErr(oErr.message); setLoading(false); return; }
    setObj(o);

    const { data: d, error: dErr } = await supabase
      .from("object_docs")
      .select("id,doc_type,storage_path,created_at")
      .eq("object_id", objectId)
      .order("created_at", { ascending: false });
    if (dErr) setErr(dErr.message);
    setDocs((d as Doc[]) ?? []);

    const { data: e, error: eErr } = await supabase
      .from("provenance_events")
      .select("id,event_type,event_date,party,location,confidence")
      .eq("object_id", objectId)
      .order("created_at", { ascending: false });
    if (eErr) setErr(eErr.message);
    setEvents((e as Event[]) ?? []);

    const { data: s } = await supabase
      .from("integrity_scores")
      .select("score,created_at")
      .eq("object_id", objectId)
      .order("created_at", { ascending: false })
      .limit(1);

    setLatestScore(s?.[0]?.score ?? null);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const suggestedScore = useMemo(() => {
    // Explainable v1 heuristic
    let s = 50;

    const docsCount = docs.length;
    const eventsCount = events.length;

    const avgConf = eventsCount
      ? Math.round(events.reduce((a, x) => a + (x.confidence ?? 50), 0) / eventsCount)
      : 0;

    s += Math.min(20, docsCount * 4);     // up to +20
    s += Math.min(25, eventsCount * 5);   // up to +25
    s += Math.round((avgConf - 50) * 0.3);

    if (eventsCount === 0) s -= 20;       // penalty if no timeline

    s = Math.max(0, Math.min(100, s));
    return s;
  }, [docs, events]);

  async function addEvent() {
    if (!obj) return;
    setErr("");

    const payload = {
      org_id: obj.org_id,
      object_id: obj.id,
      event_type: eventType,
      event_date: eventDate.trim() || null,
      party: party.trim() || null,
      location: location.trim() || null,
      confidence: Math.max(0, Math.min(100, confidence)),
    };

    const { error } = await supabase.from("provenance_events").insert(payload);
    if (error) return setErr(error.message);

    setEventDate(""); setParty(""); setLocation(""); setConfidence(60);
    await load();
  }

  async function saveScoreSnapshot() {
    if (!obj) return;
    setErr("");

    const rationale = {
      version: "v1-heuristic",
      docsCount: docs.length,
      eventsCount: events.length,
      note: "Explainable score. Upgrade to OCR/entity checks later.",
    };

    const { error } = await supabase.from("integrity_scores").insert({
      org_id: obj.org_id,
      object_id: obj.id,
      score: suggestedScore,
      rationale,
    });

    if (error) return setErr(error.message);
    await load();
  }

  async function uploadDoc() {
    if (!docFile) return setErr("Choose a file first.");
    setErr("");
    setUploading(true);

    const form = new FormData();
    form.append("file", docFile);
    form.append("objectId", objectId);
    form.append("docType", docType);

    const res = await fetch("/api/upload", { method: "POST", body: form });
    const json = await res.json();

    if (!res.ok) {
      setErr(json?.error || "Upload failed");
      setUploading(false);
      return;
    }

    setDocFile(null);
    setUploading(false);
    await load();
  }

  async function openSignedDoc(path: string) {
    const res = await fetch(`/api/doc-url?path=${encodeURIComponent(path)}`);
    const json = await res.json();
    if (!res.ok) return setErr(json?.error || "Failed to create link");
    window.open(json.url, "_blank", "noopener,noreferrer");
  }

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (!obj) return <div style={{ padding: 24 }}>Not found.</div>;

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
      <a href="/dashboard">← Back</a>

      <h1 style={{ fontSize: 28, fontWeight: 900, marginTop: 10 }}>
        {obj.title}
      </h1>
      <div style={{ opacity: 0.7 }}>
        {obj.artist ?? "Unknown artist"} • Status: {obj.status ?? "—"}
      </div>

      {err && <div style={{ marginTop: 12, color: "crimson" }}>{err}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 16 }}>
        {/* Score */}
        <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 16, padding: 16 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Integrity Score</div>
          <div style={{ fontSize: 38, fontWeight: 900 }}>{latestScore ?? "—"}</div>
          <div style={{ opacity: 0.75, marginTop: 6 }}>Suggested now: {suggestedScore}</div>
          <button
            onClick={saveScoreSnapshot}
            style={{ marginTop: 10, padding: 12, borderRadius: 12, background: "#0f172a", color: "white", fontWeight: 900 }}
          >
            Save Score Snapshot
          </button>
        </div>

        {/* Upload */}
        <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 16, padding: 16 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Upload Document</div>
          <select value={docType} onChange={(e) => setDocType(e.target.value)} style={{ padding: 10, borderRadius: 12 }}>
            <option value="provenance">provenance</option>
            <option value="condition">condition</option>
            <option value="catalog">catalog</option>
            <option value="invoice">invoice</option>
            <option value="other">other</option>
          </select>
          <input
            type="file"
            onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
            style={{ display: "block", marginTop: 10 }}
          />
          <button
            onClick={uploadDoc}
            disabled={uploading}
            style={{ marginTop: 10, padding: 12, borderRadius: 12, background: "#0f172a", color: "white", fontWeight: 900 }}
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
          <div style={{ opacity: 0.7, fontSize: 12, marginTop: 8 }}>
            Docs are private. Viewing uses signed URLs.
          </div>
        </div>
      </div>

      {/* Add event */}
      <div style={{ marginTop: 14, background: "white", border: "1px solid #e5e7eb", borderRadius: 16, padding: 16 }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Add Provenance Event</div>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
          <select value={eventType} onChange={(e) => setEventType(e.target.value)} style={{ padding: 10, borderRadius: 12 }}>
            <option value="acquired">acquired</option>
            <option value="sold">sold</option>
            <option value="exhibited">exhibited</option>
            <option value="published">published</option>
            <option value="inherited">inherited</option>
            <option value="other">other</option>
          </select>
          <input value={eventDate} onChange={(e) => setEventDate(e.target.value)} placeholder='Date (e.g., "c. 1952")' style={{ padding: 12, borderRadius: 12, border: "1px solid #e5e7eb" }} />
          <input value={party} onChange={(e) => setParty(e.target.value)} placeholder="Party (owner/dealer/estate)" style={{ padding: 12, borderRadius: 12, border: "1px solid #e5e7eb" }} />
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" style={{ padding: 12, borderRadius: 12, border: "1px solid #e5e7eb" }} />
          <input type="number" min={0} max={100} value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} placeholder="Confidence 0-100" style={{ padding: 12, borderRadius: 12, border: "1px solid #e5e7eb" }} />
        </div>

        <button
          onClick={addEvent}
          style={{ marginTop: 10, padding: 12, borderRadius: 12, background: "#0f172a", color: "white", fontWeight: 900 }}
        >
          Add Event
        </button>
      </div>

      {/* Docs list */}
      <div style={{ marginTop: 14, background: "white", border: "1px solid #e5e7eb", borderRadius: 16, padding: 16 }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Documents</div>
        {docs.length === 0 ? <div style={{ opacity: 0.7 }}>No documents yet.</div> : null}
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {docs.map((d) => (
            <li key={d.id} style={{ marginBottom: 10 }}>
              <b>{d.doc_type ?? "other"}</b>
              <div style={{ opacity: 0.75, fontSize: 12 }}>{d.storage_path}</div>
              <button onClick={() => openSignedDoc(d.storage_path)} style={{ marginTop: 6, padding: 8, borderRadius: 10 }}>
                View (signed link)
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Timeline */}
      <div style={{ marginTop: 14, background: "white", border: "1px solid #e5e7eb", borderRadius: 16, padding: 16 }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Provenance Timeline</div>
        {events.length === 0 ? <div style={{ opacity: 0.7 }}>No events yet.</div> : null}
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {events.map((e) => (
            <li key={e.id} style={{ marginBottom: 10 }}>
              <b>{e.event_type}</b> — {e.event_date ?? "date unknown"} — {e.party ?? "unknown party"} — {e.location ?? "unknown location"} — conf {e.confidence ?? 50}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
