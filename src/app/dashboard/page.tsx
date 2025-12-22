"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Obj = {
  id: string;
  title: string;
  artist: string | null;
  status: string | null;
  created_at: string;
};

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [objects, setObjects] = useState<Obj[]>([]);

  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");

  async function requireSession() {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) window.location.href = "/auth";
    return data.session?.user ?? null;
  }

  async function load() {
    setLoading(true);
    setErr("");

    const u = await requireSession();
    if (!u) return;

    // Ensure user has org setup
    const { data: prof, error: pErr } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("user_id", u.id)
      .single();

    if (pErr || !prof?.org_id) {
      window.location.href = "/setup";
      return;
    }

    const { data: rows, error } = await supabase
      .from("objects")
      .select("id,title,artist,status,created_at")
      .order("created_at", { ascending: false });

    if (error) setErr(error.message);
    setObjects((rows as Obj[]) ?? []);
    setLoading(false);
  }

  async function createObject() {
    setErr("");

    const u = await requireSession();
    if (!u) return;

    const { data: prof, error: pErr } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("user_id", u.id)
      .single();

    if (pErr || !prof?.org_id) return (window.location.href = "/setup");

    const payload = {
      org_id: prof.org_id,
      created_by: u.id,
      title: title.trim() || "Untitled object",
      artist: artist.trim() || null,
      status: "intake",
    };

    const { error } = await supabase.from("objects").insert(payload);
    if (error) return setErr(error.message);

    setTitle("");
    setArtist("");
    await load();
  }

  useEffect(() => { load(); }, []);

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900 }}>Dashboard</h1>
          <div style={{ opacity: 0.7 }}>Create objects and manage provenance research.</div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <a href="/setup">Setup</a>
          <a href="/auth">Auth</a>
        </div>
      </div>

      <div style={{ marginTop: 14, padding: 16, borderRadius: 16, border: "1px solid #e5e7eb", background: "white" }}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>Create object</div>
        <div style={{ display: "grid", gap: 10 }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (e.g., Untitled, 1954)"
            style={{ padding: 12, borderRadius: 12, border: "1px solid #e5e7eb" }}
          />
          <input
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="Artist (optional)"
            style={{ padding: 12, borderRadius: 12, border: "1px solid #e5e7eb" }}
          />
          <button
            onClick={createObject}
            style={{
              padding: 12,
              borderRadius: 12,
              background: "#0f172a",
              color: "white",
              fontWeight: 900,
              cursor: "pointer",
              width: 200,
            }}
          >
            Create
          </button>
        </div>
      </div>

      {err && <div style={{ marginTop: 12, color: "crimson" }}>{err}</div>}
      {loading && <div style={{ marginTop: 12 }}>Loading…</div>}

      <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
        {objects.map((o) => (
          <a
            key={o.id}
            href={`/objects/${o.id}`}
            style={{
              padding: 14,
              borderRadius: 16,
              border: "1px solid #e5e7eb",
              textDecoration: "none",
              color: "#0f172a",
              background: "white",
            }}
          >
            <div style={{ fontWeight: 900 }}>{o.title}</div>
            <div style={{ opacity: 0.7, fontSize: 13 }}>
              {o.artist ?? "Unknown artist"} • {o.status ?? "—"}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
