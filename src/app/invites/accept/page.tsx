'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';
import { Notice } from '@/components/Notice';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [inviteValid, setInviteValid] = useState(false);

  async function checkAuth() {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) {
      // Redirect to auth with return URL
      router.push(`/auth?redirect=/invites/accept?token=${token}`);
      return null;
    }
    return data.session.user;
  }

  async function validateInvite() {
    setLoading(true);
    setError('');

    if (!token) {
      setError('Invalid invite link');
      setLoading(false);
      return;
    }

    const u = await checkAuth();
    if (!u) return;

    setUser(u);

    // Check if user already has an org
    const { data: prof } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('user_id', u.id)
      .single();

    if (prof?.org_id) {
      setError('You are already a member of an organization');
      setLoading(false);
      return;
    }

    setInviteValid(true);
    setLoading(false);
  }

  async function acceptInvite() {
    setAccepting(true);
    setError('');
    if (!user) {
      setError('Session expired. Please sign in again.');
      setAccepting(false);
      return;
    }

    const res = await fetch('/api/invites/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, userId: user.id }),
    });

    const data = await res.json();

    if (res.ok) {
      // Redirect to dashboard
      router.push('/dashboard');
    } else {
      setError(data.error || 'Failed to accept invite');
    }

    setAccepting(false);
  }

  useEffect(() => {
    validateInvite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="text-center py-8">
          <div className="text-muted-foreground">Validating invite...</div>
        </CardContent>
      </Card>
    </div>
  );
}

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="text-center py-8">
          {error ? (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Invalid Invite</h2>
              <Notice kind="error">{error}</Notice>
              <div className="mt-6">
                <Button onClick={() => router.push('/dashboard')} variant="outline">
                  Go to Dashboard
                </Button>
              </div>
            </>
          ) : inviteValid ? (
            <>
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                You&apos;ve Been Invited!
              </h2>
              <p className="text-gray-600 mb-8">
                You&apos;ve been invited to join an organization on Registrata.
                Click below to accept the invitation and start collaborating.
              </p>
              <Button onClick={acceptInvite} disabled={accepting} size="lg">
                {accepting ? 'Accepting...' : 'Accept Invitation'}
              </Button>
              <div className="mt-4">
                <Button onClick={() => router.push('/dashboard')} variant="ghost" size="sm">
                  Decline
                </Button>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="text-center py-8">
              <div className="text-muted-foreground">Loading invite...</div>
            </CardContent>
          </Card>
        </div>
      }
    >
      <AcceptInviteContent />
    </Suspense>
  );
}
