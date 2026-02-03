'use client';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/lib/supabaseClient";
import { AppShell } from "@/components/AppShell";
import { Notice } from "@/components/Notice";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/registrata/GlassCard";
import { SectionHeader } from "@/components/registrata/SectionHeader";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfirmDialog, EmptyState, TableSkeleton } from "@/components/ui-ext";
import { toast } from "sonner";
import type { Org, Profile, UserRole } from "@/types/database";
import type { User } from "@supabase/supabase-js";

const orgSchema = z.object({
  name: z.string().min(2, "Organization name is required"),
});

const profileSchema = z.object({
  full_name: z.string().min(2, "Full name is required"),
});

const inviteSchema = z.object({
  email: z.string().email("Enter a valid email"),
  role: z.enum(["viewer", "member", "admin"]),
});

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [members, setMembers] = useState<Array<{ user_id: string; email: string; role: UserRole }>>([]);
  const [openInvite, setOpenInvite] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<Array<{
    id: string;
    user_id: string | null;
    action: string;
    resource_type: string;
    resource_id: string | null;
    changes: { before?: unknown; after?: unknown } | null;
    metadata: Record<string, unknown> | null;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
  }>>([]);
  const [auditLimit, setAuditLimit] = useState("25");
  const [auditLoading, setAuditLoading] = useState(false);

  const orgForm = useForm<z.infer<typeof orgSchema>>({
    resolver: zodResolver(orgSchema),
    defaultValues: { name: "" },
  });

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: "" },
  });

  const inviteForm = useForm<z.infer<typeof inviteSchema>>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", role: "member" },
  });
  const inviteRole = useWatch({ control: inviteForm.control, name: "role" });

  const isAdmin = profile?.role === "admin" || profile?.role === "owner";
  const memberEmailById = useMemo(
    () => new Map(members.map((member) => [member.user_id, member.email])),
    [members]
  );

  async function requireSession() {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) {
      router.push("/auth");
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
      .select("*, orgs(*)")
      .eq("user_id", u.id)
      .single();

    if (!prof?.org_id) {
      router.push("/setup");
      return;
    }

    setProfile(prof);
    const orgRow = Array.isArray(prof.orgs) ? prof.orgs[0] : prof.orgs;
    setOrg(orgRow ?? null);
    orgForm.reset({ name: orgRow?.name || "" });
    profileForm.reset({ full_name: prof.full_name || "" });

    await loadMembers(u.id);
    if (prof.role === "admin" || prof.role === "owner") {
      await loadAuditLogs(Number(auditLimit));
    }
    setLoading(false);
  }

  async function loadMembers(userId: string) {
    const membersRes = await fetch(`/api/members?userId=${userId}`);
    if (membersRes.ok) {
      const data = await membersRes.json();
      setMembers(data.members || []);
    }
  }

  async function loadAuditLogs(limit = Number(auditLimit)) {
    setAuditLoading(true);
    const { data, error: auditErr } = await supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (auditErr) {
      toast.error("Unable to load audit log", { description: auditErr.message });
      setAuditLogs([]);
      setAuditLoading(false);
      return;
    }

    setAuditLogs(data || []);
    setAuditLoading(false);
  }

  async function saveOrg(values: z.infer<typeof orgSchema>) {
    if (!org) return;
    const { error: updateErr } = await supabase
      .from("orgs")
      .update({ name: values.name })
      .eq("id", org.id);

    if (updateErr) {
      toast.error("Unable to update organization", { description: updateErr.message });
      return;
    }

    toast.success("Organization updated");
    await loadData();
  }

  async function saveProfile(values: z.infer<typeof profileSchema>) {
    if (!user) {
      toast.error("Session expired", { description: "Sign in again to update your profile." });
      return;
    }
    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ full_name: values.full_name })
      .eq("user_id", user.id);

    if (updateErr) {
      toast.error("Unable to update profile", { description: updateErr.message });
      return;
    }

    toast.success("Profile updated");
    await loadData();
  }

  async function sendInvite(values: z.infer<typeof inviteSchema>) {
    if (!user) {
      toast.error("Session expired", { description: "Sign in again to send invites." });
      return;
    }
    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: values.email, role: values.role, userId: user.id }),
    });

    const data = await res.json();

    if (!res.ok) {
      toast.error("Invite failed", { description: data.error || "Try again." });
      return;
    }

    toast.success("Invite sent");
    setOpenInvite(false);
    inviteForm.reset({ email: "", role: "member" });
    await loadMembers(user.id);
  }

  async function removeMember(memberId: string) {
    if (!user) {
      toast.error("Session expired", { description: "Sign in again to remove members." });
      return;
    }
    const res = await fetch(`/api/members?memberId=${memberId}&userId=${user.id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const data = await res.json();
      toast.error("Unable to remove member", { description: data.error || "Try again." });
      return;
    }

    toast.success("Member removed");
    await loadMembers(user.id);
  }

  async function changeRole(memberId: string, role: string) {
    if (!user) {
      toast.error("Session expired", { description: "Sign in again to update roles." });
      return;
    }
    const res = await fetch("/api/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, role, userId: user.id }),
    });

    if (!res.ok) {
      const data = await res.json();
      toast.error("Role update failed", { description: data.error || "Try again." });
      return;
    }

    toast.success("Role updated");
    await loadMembers(user.id);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    loadAuditLogs(Number(auditLimit));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditLimit, isAdmin]);

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
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionHeader
            kicker="Administration"
            title="Settings"
            subtitle="Manage organization, team access, billing, and security settings."
          />
          {isAdmin ? (
            <Button variant="outline" onClick={() => setOpenInvite(true)}>
              Invite member
            </Button>
          ) : null}
        </div>

        {error && (
          <Notice kind="error" onDismiss={() => setError("")}>
            {error}
          </Notice>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <GlassCard>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-text-muted">Organization</p>
              <h3 className="text-lg font-semibold text-white">Workspace profile</h3>
            </div>
            <div className="mt-4 space-y-4">
              <form className="space-y-3" onSubmit={orgForm.handleSubmit(saveOrg)}>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary">Organization name</label>
                  <Input {...orgForm.register("name")} disabled={!isAdmin} />
                  {orgForm.formState.errors.name && (
                    <p className="text-xs text-destructive">{orgForm.formState.errors.name.message as string}</p>
                  )}
                </div>
                <div className="text-xs text-text-muted">
                  Org ID: <span className="font-mono">{org?.id}</span>
                </div>
                <div className="text-xs text-text-muted">
                  Created {org?.created_at ? new Date(org.created_at).toLocaleDateString() : "Unknown"}
                </div>
                {isAdmin ? (
                  <Button type="submit" disabled={orgForm.formState.isSubmitting}>
                    Save organization
                  </Button>
                ) : (
                  <p className="text-xs text-text-muted">Only admins can update org settings.</p>
                )}
              </form>
            </div>
          </GlassCard>

          <GlassCard>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-text-muted">Your profile</p>
              <h3 className="text-lg font-semibold text-white">Personal settings</h3>
            </div>
            <div className="mt-4 space-y-4">
              <form className="space-y-3" onSubmit={profileForm.handleSubmit(saveProfile)}>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-primary">Full name</label>
                  <Input {...profileForm.register("full_name")} />
                  {profileForm.formState.errors.full_name && (
                    <p className="text-xs text-destructive">{profileForm.formState.errors.full_name.message as string}</p>
                  )}
                </div>
                <div className="text-xs text-text-muted">Email: {user?.email}</div>
                <div className="text-xs text-text-muted">Role: {profile?.role}</div>
                <Button type="submit" disabled={profileForm.formState.isSubmitting}>
                  Save profile
                </Button>
              </form>
            </div>
          </GlassCard>
        </div>

        <GlassCard>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-text-muted">Team members</p>
            <h3 className="text-lg font-semibold text-white">Access control</h3>
          </div>
          <div className="mt-4">
            {members.length === 0 ? (
              <EmptyState
                title="No team members yet"
                description="Invite teammates to collaborate on provenance review."
                actionLabel={isAdmin ? "Invite member" : undefined}
                onAction={() => setOpenInvite(true)}
              />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border-muted">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
                      <TableRow key={member.user_id}>
                        <TableCell className="font-semibold text-white">{member.email}</TableCell>
                        <TableCell>
                          {isAdmin && member.user_id !== user?.id ? (
                            <Select value={member.role} onValueChange={(value) => changeRole(member.user_id, value as UserRole)}>
                              <SelectTrigger className="w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="owner">Owner</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="member">Member</SelectItem>
                                <SelectItem value="viewer">Viewer</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-sm text-text-secondary">{member.role}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isAdmin && member.user_id !== user?.id ? (
                            <Button variant="outline" size="sm" onClick={() => setConfirmRemove(member.user_id)}>
                              Remove
                            </Button>
                          ) : (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger className="text-xs text-text-muted">Protected</TooltipTrigger>
                                <TooltipContent>Only admins can remove members.</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </GlassCard>

        <div className="grid gap-6 lg:grid-cols-2">
          <GlassCard>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-text-muted">Billing</p>
              <h3 className="text-lg font-semibold text-white">Plan management</h3>
            </div>
            <p className="mt-4 text-sm text-text-secondary">
              Billing management is coming soon. Contact support to upgrade your plan or add seats.
            </p>
          </GlassCard>
          <GlassCard>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-text-muted">Security status</p>
              <h3 className="text-lg font-semibold text-white">Workspace compliance</h3>
            </div>
            <div className="mt-4 space-y-2 text-sm text-text-secondary">
              <div>RLS enabled: <span className="font-semibold text-text-primary">Yes</span></div>
              <div>Storage policies configured: <span className="font-semibold text-text-primary">Yes</span></div>
              <div>Audit logging: <span className="font-semibold text-text-primary">Enabled</span></div>
            </div>
          </GlassCard>
        </div>

        {isAdmin ? (
          <GlassCard>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-text-muted">Audit log</p>
                <h3 className="text-lg font-semibold text-white">Recent activity</h3>
                <p className="text-sm text-text-secondary">
                  Review recent activity across your organization.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={auditLimit} onValueChange={setAuditLimit}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => loadAuditLogs(Number(auditLimit))}>
                  Refresh
                </Button>
              </div>
            </div>
            <div className="mt-4">
              {auditLoading ? (
                <TableSkeleton rows={5} />
              ) : auditLogs.length === 0 ? (
                <EmptyState
                  title="No audit events yet"
                  description="Important actions will appear here once activity starts."
                />
              ) : (
                <div className="overflow-hidden rounded-2xl border border-border-muted">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Action</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((log) => {
                        const description = typeof log.metadata?.description === "string"
                          ? log.metadata.description
                          : "";
                        const userLabel = log.user_id
                          ? memberEmailById.get(log.user_id) || log.user_id
                          : "System";
                        return (
                          <TableRow key={log.id}>
                            <TableCell>
                              <Badge variant="primary">{log.action}</Badge>
                            </TableCell>
                            <TableCell className="space-y-2">
                              <div className="text-sm font-medium text-text-primary">
                                {description || "No description provided"}
                              </div>
                              <div className="text-xs text-text-muted">
                                {log.resource_type} {log.resource_id ? `• ${log.resource_id}` : ""}
                              </div>
                              {(log.ip_address || log.user_agent) && (
                                <div className="text-xs text-text-muted">
                                  {log.ip_address ? `IP ${log.ip_address}` : null}
                                  {log.ip_address && log.user_agent ? " • " : null}
                                  {log.user_agent ? log.user_agent : null}
                                </div>
                              )}
                              {log.changes ? (
                                <details className="rounded-lg border border-border-muted p-2 text-xs text-text-muted">
                                  <summary className="cursor-pointer text-xs font-medium text-text-primary">
                                    View changes
                                  </summary>
                                  <pre className="mt-2 whitespace-pre-wrap">
                                    {JSON.stringify(log.changes, null, 2)}
                                  </pre>
                                </details>
                              ) : null}
                            </TableCell>
                            <TableCell className="text-xs text-text-muted">{userLabel}</TableCell>
                            <TableCell className="text-xs text-text-muted">
                              {new Date(log.created_at).toLocaleString()}
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
        ) : null}
      </div>

      <Dialog open={openInvite} onOpenChange={setOpenInvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite team member</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={inviteForm.handleSubmit(sendInvite)}>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email address</label>
              <Input {...inviteForm.register("email")} placeholder="colleague@example.com" />
              {inviteForm.formState.errors.email && (
                <p className="text-xs text-destructive">{inviteForm.formState.errors.email.message as string}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Role</label>
              <Select
                value={inviteRole}
                onValueChange={(value) => inviteForm.setValue("role", value as z.infer<typeof inviteSchema>["role"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer - Read only</SelectItem>
                  <SelectItem value="member">Member - Create and edit</SelectItem>
                  <SelectItem value="admin">Admin - Full access</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenInvite(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={inviteForm.formState.isSubmitting}>
                Send invite
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(confirmRemove)}
        title="Remove member"
        description="This will revoke access to the workspace for this user."
        confirmLabel="Remove"
        onConfirm={() => {
          if (confirmRemove) {
            removeMember(confirmRemove);
          }
          setConfirmRemove(null);
        }}
        onCancel={() => setConfirmRemove(null)}
      />
    </AppShell>
  );
}
