'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';
import { Notice } from '@/components/Notice';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function OnboardingPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Step 2: Organization
  const [orgName, setOrgName] = useState('');
  const [fullName, setFullName] = useState('');
  const [orgId, setOrgId] = useState('');

  // Step 3: First Object
  const [objectTitle, setObjectTitle] = useState('');
  const [objectArtist, setObjectArtist] = useState('');
  const [objectId, setObjectId] = useState('');

  // Step 4: Document Upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function requireSession() {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) {
      router.push('/auth');
      return null;
    }
    return data.session.user;
  }

  async function createOrganization() {
    if (!orgName.trim()) {
      setError('Organization name is required');
      return;
    }
    if (!user) {
      setError('Session expired. Please sign in again.');
      return;
    }

    setLoading(true);
    setError('');

    const res = await fetch('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgName,
        fullName: fullName || null,
        userId: user.id,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      setOrgId(data.orgId);
      setStep(3);
    } else {
      const data = await res.json();
      setError(data.error || 'Failed to create organization');
    }

    setLoading(false);
  }

  async function createFirstObject() {
    if (!objectTitle.trim()) {
      setError('Object title is required');
      return;
    }
    if (!user) {
      setError('Session expired. Please sign in again.');
      return;
    }

    setLoading(true);
    setError('');

    const { data, error: createErr } = await supabase
      .from('objects')
      .insert({
        org_id: orgId,
        created_by: user.id,
        title: objectTitle,
        artist: objectArtist || null,
        status: 'intake',
      })
      .select()
      .single();

    if (createErr) {
      setError(createErr.message);
    } else {
      setObjectId(data.id);
      setStep(4);
    }

    setLoading(false);
  }

  async function uploadDocument() {
    if (!selectedFile) {
      setError('Please select a file');
      return;
    }
    if (!user) {
      setError('Session expired. Please sign in again.');
      return;
    }

    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('objectId', objectId);
    formData.append('docType', selectedFile.name.split('.').pop() || 'other');
    formData.append('userId', user.id);

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      setStep(5);
    } else {
      const data = await res.json();
      setError(data.error || 'Upload failed');
    }

    setUploading(false);
  }

  async function queueAIJob() {
    if (!user) {
      setError('Session expired. Please sign in again.');
      return;
    }
    setLoading(true);
    setError('');

    const res = await fetch('/api/ai/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        objectId,
        userId: user.id,
        source: 'document',
      }),
    });

    if (res.ok) {
      setStep(6);
    } else {
      const data = await res.json();
      setError(data.error || 'Failed to queue AI job');
    }

    setLoading(false);
  }

  function completeOnboarding() {
    router.push('/dashboard');
  }

  useEffect(() => {
    async function init() {
      const u = await requireSession();
      if (!u) return;
      setUser(u);

      // Check if user already has org
      const { data: prof } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('user_id', u.id)
        .single();

      if (prof?.org_id) {
        // Already has org, skip to dashboard
        router.push('/dashboard');
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const steps = [
    { number: 1, title: 'Welcome', status: step > 1 ? 'complete' : step === 1 ? 'current' : 'upcoming' },
    { number: 2, title: 'Create Organization', status: step > 2 ? 'complete' : step === 2 ? 'current' : 'upcoming' },
    { number: 3, title: 'First Object', status: step > 3 ? 'complete' : step === 3 ? 'current' : 'upcoming' },
    { number: 4, title: 'Upload Document', status: step > 4 ? 'complete' : step === 4 ? 'current' : 'upcoming' },
    { number: 5, title: 'AI Processing', status: step > 5 ? 'complete' : step === 5 ? 'current' : 'upcoming' },
    { number: 6, title: 'Complete', status: step >= 6 ? 'complete' : 'upcoming' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Progress Steps */}
        <nav className="mb-8">
          <ol className="flex items-center justify-between">
            {steps.map((s, idx) => (
              <li key={s.number} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                      s.status === 'complete'
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : s.status === 'current'
                        ? 'bg-white border-blue-600 text-blue-600'
                        : 'bg-white border-gray-300 text-gray-500'
                    }`}
                  >
                    {s.status === 'complete' ? (
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <span className="text-sm font-semibold">{s.number}</span>
                    )}
                  </div>
                  <span className="mt-2 text-xs font-medium text-gray-700">{s.title}</span>
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={`hidden sm:block w-full h-0.5 mx-2 ${
                      s.status === 'complete' ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  />
                )}
              </li>
            ))}
          </ol>
        </nav>

        {error && (
          <div className="mb-6">
            <Notice kind="error" onDismiss={() => setError('')}>
              {error}
            </Notice>
          </div>
        )}

        {/* Step Content */}
        <Card>
          <CardContent className="p-8">
          {/* Step 1: Welcome */}
          {step === 1 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Welcome to Registrata
              </h2>
              <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
                Let&apos;s get you set up with your organization and create your first provenance object.
                This wizard will guide you through the essential steps.
              </p>
              <Button onClick={() => setStep(2)} size="lg">
                Get Started
              </Button>
            </div>
          )}

          {/* Step 2: Create Organization */}
          {step === 2 && (
            <div className="py-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Create Your Organization</h2>
              <p className="text-gray-600 mb-6">
                An organization is your workspace where you&apos;ll manage provenance research.
              </p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Organization Name</label>
                  <Input
                    placeholder="e.g., Acme Art Gallery"
                    value={orgName}
                    onChange={(event) => setOrgName(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Your Full Name</label>
                  <Input
                    placeholder="e.g., Jane Smith (optional)"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <Button variant="secondary" onClick={() => router.push('/auth')}>
                    Cancel
                  </Button>
                  <Button onClick={createOrganization} disabled={loading}>
                    {loading ? "Creating..." : "Create Organization"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: First Object */}
          {step === 3 && (
            <div className="py-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Create Your First Object</h2>
              <p className="text-gray-600 mb-6">
                Objects represent artworks, artifacts, or items whose provenance you&apos;re researching.
              </p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Object Title</label>
                  <Input
                    placeholder="e.g., Untitled, 1954"
                    value={objectTitle}
                    onChange={(event) => setObjectTitle(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Artist</label>
                  <Input
                    placeholder="e.g., Mark Rothko (optional)"
                    value={objectArtist}
                    onChange={(event) => setObjectArtist(event.target.value)}
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <Button variant="secondary" onClick={() => setStep(2)}>
                    Back
                  </Button>
                  <Button onClick={createFirstObject} disabled={loading}>
                    {loading ? "Creating..." : "Create Object"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Upload Document */}
          {step === 4 && (
            <div className="py-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload a Document</h2>
              <p className="text-gray-600 mb-6">
                Upload a document related to your object (invoice, exhibition catalog, authentication letter, etc.).
                Our AI will extract provenance information automatically.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select File
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.json"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Supported: PDF, PNG, JPG, WEBP, TXT, CSV, JSON
                  </p>
                </div>
                <div className="flex gap-3 pt-4">
                  <Button variant="secondary" onClick={() => setStep(3)}>
                    Back
                  </Button>
                  <Button onClick={uploadDocument} disabled={!selectedFile || uploading}>
                    {uploading ? "Uploading..." : "Upload Document"}
                  </Button>
                  <Button variant="ghost" onClick={() => setStep(6)}>
                    Skip
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Queue AI Job */}
          {step === 5 && (
            <div className="py-6 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Document Uploaded!</h2>
              <p className="text-gray-600 mb-8">
                Now let&apos;s queue an AI extraction job to automatically extract provenance information
                from your document.
              </p>
              <div className="flex justify-center gap-3">
                <Button variant="secondary" onClick={() => setStep(4)}>
                  Back
                </Button>
                <Button onClick={queueAIJob} disabled={loading}>
                  {loading ? "Queueing..." : "Queue AI Extraction"}
                </Button>
              </div>
            </div>
          )}

          {/* Step 6: Complete */}
          {step === 6 && (
            <div className="py-6 text-center">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">You&apos;re All Set!</h2>
              <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
                Your organization is ready. Your AI extraction job will be processed automatically
                by our background worker (runs every 5 minutes).
              </p>
              <div className="bg-blue-50 rounded-lg p-6 mb-8">
                <h3 className="font-semibold text-blue-900 mb-3">Next Steps:</h3>
                <ul className="text-left text-sm text-blue-800 space-y-2 max-w-md mx-auto">
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Check your dashboard for the object you created</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Visit the object detail page to see extracted provenance events</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Approve or reject AI-suggested events</span>
                  </li>
                </ul>
              </div>
              <Button onClick={completeOnboarding} size="lg">
                Go to Dashboard
              </Button>
            </div>
          )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
