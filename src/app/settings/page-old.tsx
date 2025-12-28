// @ts-nocheck
'use client';
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps, react/no-unescaped-entities */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { AppShell, Card, Button, Input, Notice } from '@/components';

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [org, setOrg] = useState<any>(null);

  // Form state
  const [orgName, setOrgName] = useState('');
  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);

  async function requireSession() {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) {
      router.push('/auth');
      return null;
    }
    return data.session.user;
  }

  async function loadData() {
    setLoading(true);
    setError('');

    const u = await requireSession();
    if (!u) return;

    setUser(u);

    // Get profile and org
    const { data: prof } = await supabase
      .from('profiles')
      .select('*, orgs(*)')
      .eq('user_id', u.id)
      .single();

    if (!prof?.org_id) {
      router.push('/setup');
      return;
    }

    setProfile(prof);
    setOrg(prof.orgs);
    setOrgName(prof.orgs?.name || '');
    setFullName(prof.full_name || '');

    setLoading(false);
  }

  async function saveOrgSettings() {
    if (!org) return;

    setSaving(true);
    setError('');

    const { error: updateErr } = await supabase
      .from('orgs')
      .update({ name: orgName })
      .eq('id', org.id);

    if (updateErr) {
      setError(updateErr.message);
    } else {
      setSuccess('Organization updated successfully');
      await loadData();
    }

    setSaving(false);
  }

  async function saveProfileSettings() {
    if (!profile) return;

    setSaving(true);
    setError('');

    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ full_name: fullName })
      .eq('user_id', user.id);

    if (updateErr) {
      setError(updateErr.message);
    } else {
      setSuccess('Profile updated successfully');
      await loadData();
    }

    setSaving(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/auth');
  }

  useEffect(() => {
    loadData();
  }, []);

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      href: '/dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      id: 'objects',
      label: 'Objects',
      href: '/objects',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      id: 'settings',
      label: 'Settings',
      href: '/settings',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  if (loading) {
    return (
      <AppShell navItems={navItems} user={user} org={org}>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading settings...</div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell navItems={navItems} user={user} org={org}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="mt-1 text-gray-600">
            Manage your organization and personal preferences.
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <Notice kind="error" onDismiss={() => setError('')}>
            {error}
          </Notice>
        )}
        {success && (
          <Notice kind="success" onDismiss={() => setSuccess('')}>
            {success}
          </Notice>
        )}

        {/* Organization Settings */}
        <Card title="Organization">
          <div className="space-y-4">
            <Input
              label="Organization Name"
              value={orgName}
              onChange={setOrgName}
              required
            />
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1">Organization ID</div>
              <div className="text-sm text-gray-500 font-mono">{org?.id}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1">Created</div>
              <div className="text-sm text-gray-500">
                {new Date(org?.created_at).toLocaleDateString()}
              </div>
            </div>
            <Button onClick={saveOrgSettings} loading={saving}>
              Save Organization Settings
            </Button>
          </div>
        </Card>

        {/* Profile Settings */}
        <Card title="Your Profile">
          <div className="space-y-4">
            <Input
              label="Full Name"
              value={fullName}
              onChange={setFullName}
            />
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1">Email</div>
              <div className="text-sm text-gray-500">{user?.email}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1">Role</div>
              <div className="text-sm text-gray-500 capitalize">{profile?.role}</div>
            </div>
            <Button onClick={saveProfileSettings} loading={saving}>
              Save Profile Settings
            </Button>
          </div>
        </Card>

        {/* Team Members (Phase 4) */}
        <Card title="Team Members">
          <div className="py-8 text-center text-gray-500">
            <svg
              className="mx-auto h-12 w-12 text-gray-400 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            <p className="mb-4">Team member management coming in Phase 4</p>
            <p className="text-sm">
              You'll be able to invite team members, manage roles, and collaborate on provenance research.
            </p>
          </div>
        </Card>

        {/* Danger Zone */}
        <Card title="Danger Zone">
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="text-sm font-semibold text-red-900 mb-2">Sign Out</h3>
              <p className="text-sm text-red-700 mb-4">
                You will be signed out of your account.
              </p>
              <Button variant="danger" onClick={signOut}>
                Sign Out
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
