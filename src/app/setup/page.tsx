"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function SetupPage() {
  const [orgName, setOrgName] = useState("");
  const [fullName, setFullName] = useState("");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  async function loadProfile() {
    setLoading(true);
    setErr("");

    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();

    if (sessionErr) {
      setErr(sessionErr.message);
      setLoading(false);
      return;
    }

    const user = sessionData?.session?.user;

    if (!user) {
      setSessionEmail(null);
      setLoading(false);
      return;
    }

    setSessionEmail(user.email ?? null);

    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("user_id", user.id)
      .single();

    if (profile?.org_id) {
      window.location.href = "/dashboard";
      return;
    }

    setLoading(false);
  }

  async function createOrgAndProfile() {
    setErr("");
    setMsg("");
    setSubmitting(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;

    if (!user) {
      setErr("You are not authenticated. Please sign in again.");
      setSubmitting(false);
      return;
    }

    if (!orgName.trim()) {
      setErr("Organization name is required.");
      setSubmitting(false);
      return;
    }

    const res = await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orgName: orgName.trim(),
        fullName: fullName.trim() || null,
        userId: user.id,
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      setErr(json.error || "Setup failed.");
      setSubmitting(false);
      return;
    }

    setMsg("Setup complete. Redirecting.");
    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 600);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadProfile();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading setup...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Organization setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Create your organization and admin profile to start using Provenance Pulse.
          </p>
          <div className="text-xs text-muted-foreground">
            Session: <span className="font-semibold text-foreground">{sessionEmail ?? "Not authenticated"}</span>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Organization name</label>
            <Input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Mitchell Auctions"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Your name (optional)</label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jordan Mitchell"
            />
          </div>
          <Button onClick={createOrgAndProfile} disabled={submitting || !sessionEmail}>
            {submitting ? "Creating..." : "Create organization"}
          </Button>
          {err && <div className="text-sm text-destructive">{err}</div>}
          {msg && <div className="text-sm text-emerald-600">{msg}</div>}
        </CardContent>
      </Card>
    </div>
  );
}
