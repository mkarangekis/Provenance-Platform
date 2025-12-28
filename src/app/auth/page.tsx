"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function signUp() {
    setErr("");
    setMsg("");
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password: pw });
    if (error) setErr(error.message);
    else setMsg("Signed up. Check your inbox if email confirmation is enabled.");
    setLoading(false);
  }

  async function signIn() {
    setErr("");
    setMsg("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    if (error) setErr(error.message);
    else window.location.href = "/setup";
    setLoading(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in to Provenance Pulse</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Password</label>
            <Input value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" type="password" />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={signIn} disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
            <Button variant="outline" onClick={signUp} disabled={loading}>
              Create account
            </Button>
            <Button variant="ghost" onClick={signOut}>
              Sign out
            </Button>
          </div>

          {err && <div className="text-sm text-destructive">{err}</div>}
          {msg && <div className="text-sm text-emerald-600">{msg}</div>}
        </CardContent>
      </Card>
    </div>
  );
}
