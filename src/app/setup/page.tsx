"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function SetupPage() {
  const [orgName, setOrgName] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function loadProfile() {
    setLoading(true);
    setErr(""); setMsg("");

    const { data: sessionData } = await supabase.auth.getSession();
    const u = sessionData?.session?.user;
    if (!u) {
      window.location.href = "/auth";
      return;
    }

    const { data: prof, error: pErr } = await supabase
      .from("profiles")
      .select("full_name, org_id, role")
      .eq("user_id", u.id)
      .single();

    // If no profile yet, user must run setup
    if (pErr) {
      setLoading(false);
      return;
    }

    if (prof?.org_id) {
      // Already setup: send to dashboard
      window.location.href = "/dashboard";
      return;
    }

    setFullName(prof?.full_name || "");
    setLoading(false);
  }

  async function createOrgAndProfile() {
    setErr(""); setMsg("");

    const { data: sessionData } = await supabase.auth.getSession();
    const u = sessionData?.session?.user;
    if (!u) return (window.location.href = "/auth");

    const cleanOrg = orgName.trim();
    if (!cleanOrg) return setErr("Please enter an organization name.");

    // 1) Create org
    const { data: org, error: oErr } = await supabase
      .from("orgs")
      .insert({ name: cleanOrg })
      .select("id,name")
      .single();

    if (oErr) return setErr(oErr.message);

    // 2) Upsert profile with org_id + admin role
    const { error: pErr } = await supabase
      .from("profiles")
      .upsert({
        user_id: u.id,
        full_name: fullName.trim() || null,
        org_id: org.id,
        role: "admin",
      });

    if (pErr) return setErr(pErr.message);

    setMsg("Setup complete ✅ Redirecting…");
    setTimeout(() => (window.location.href = "/dashboard"), 600);
  }

  useEffect(() => {
    loadProfile();
  }, []);

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 900 }}>Setup</h1>
      <p style={{ opacity: 0.75 }}>
        Create your organization and admin profile. (One-time.)
      </p>

      <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
        <input
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          placeholder="Organization name (e.g., Acme Auctions)"
          style={{ padding: 12, borderRadius: 12, border: "1px solid #e5e7eb" }}
        />
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Your name (optional)"
          style={{ padding: 12, borderRadius: 12, border: "1px solid #e5e7eb" }}
        />

        <button
          onClick={createOrgAndProfile}
          style={{
            padding: 12,
            borderRadius: 12,
            background: "#0f172a",
            color: "white",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Create Org + Profile
        </button>

        {err && <div style={{ color: "crimson" }}>{err}</div>}
        {msg && <div style={{ color: "green" }}>{msg}</div>}
      </div>
    </div>
  );
}
