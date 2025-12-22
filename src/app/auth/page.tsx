"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function signUp() {
    setErr(""); setMsg("");
    const { error } = await supabase.auth.signUp({ email, password: pw });
    if (error) setErr(error.message);
    else setMsg("Signed up ✅. If email confirmations are enabled, confirm then sign in.");
  }

  async function signIn() {
    setErr(""); setMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    if (error) setErr(error.message);
    else window.location.href = "/setup";
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 900 }}>Auth</h1>
      <p style={{ opacity: 0.75 }}>Create account → Setup org → Use dashboard.</p>

      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email"
          style={{ padding: 12, borderRadius: 12, border: "1px solid #e5e7eb" }}
        />
        <input
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="password"
          type="password"
          style={{ padding: 12, borderRadius: 12, border: "1px solid #e5e7eb" }}
        />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={signIn} style={{ padding: 12, borderRadius: 12 }}>Sign in</button>
          <button onClick={signUp} style={{ padding: 12, borderRadius: 12 }}>Sign up</button>
          <button onClick={signOut} style={{ padding: 12, borderRadius: 12 }}>Sign out</button>
        </div>

        {err && <div style={{ color: "crimson" }}>{err}</div>}
        {msg && <div style={{ color: "green" }}>{msg}</div>}
      </div>
    </div>
  );
}
