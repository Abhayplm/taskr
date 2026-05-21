'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { Check, LogIn, UserPlus, AlertTriangle } from 'lucide-react';

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();
  const [status, setStatus] = useState<'loading' | 'accepting' | 'accepted' | 'error' | 'needs_auth'>('loading');
  const [error, setError] = useState('');
  const [orgName, setOrgName] = useState('');

  const token = searchParams.get('token');
  const email = searchParams.get('email');

  useEffect(() => {
    if (authLoading) return;

    if (!token || !email) {
      setStatus('error');
      setError('Invalid invite link. Missing token or email.');
      return;
    }

    if (!user) {
      setStatus('needs_auth');
      return;
    }

    acceptInvite();
  }, [user, authLoading, token, email]); // eslint-disable-line react-hooks/exhaustive-deps

  const acceptInvite = async () => {
    if (!user || !token || !email) return;
    setStatus('accepting');

    try {
      // Find the invite
      const { data: invite, error: findError } = await supabase
        .from('org_members')
        .select('*, organizations(name)')
        .eq('invite_token', token)
        .eq('status', 'pending')
        .single();

      if (findError || !invite) {
        setStatus('error');
        setError('Invite not found or already accepted.');
        return;
      }

      // Verify email matches
      if (invite.invited_email?.toLowerCase() !== user.email?.toLowerCase()) {
        setStatus('error');
        setError(`This invite is for ${invite.invited_email}. You're logged in as ${user.email}.`);
        return;
      }

      setOrgName((invite.organizations as any)?.name || 'workspace');

      // Accept the invite
      const { error: updateError } = await supabase
        .from('org_members')
        .update({
          user_id: user.id,
          status: 'active',
          joined_at: new Date().toISOString(),
        })
        .eq('id', invite.id);

      if (updateError) {
        setStatus('error');
        setError('Failed to accept invite: ' + updateError.message);
        return;
      }

      setStatus('accepted');

      // Redirect to dashboard after 2s
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch {
      setStatus('error');
      setError('Something went wrong. Please try again.');
    }
  };

  const redirectUrl = `/invite/accept?token=${token}&email=${encodeURIComponent(email || '')}`;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', padding: 'var(--space-8)', background: 'var(--bg-primary)',
    }}>
      <div style={{ maxWidth: '420px', width: '100%', textAlign: 'center' }}>
        <div style={{
          width: '56px', height: '56px', borderRadius: 'var(--radius-xl)',
          background: 'var(--gradient-brand)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-6)',
          fontSize: 'var(--text-xl)', fontWeight: 800, color: 'white',
        }}>
          T
        </div>

        {status === 'loading' && (
          <div>
            <div className="spinner spinner-lg" style={{ margin: '0 auto var(--space-4)' }} />
            <p className="text-secondary">Checking invite...</p>
          </div>
        )}

        {status === 'accepting' && (
          <div>
            <div className="spinner spinner-lg" style={{ margin: '0 auto var(--space-4)' }} />
            <p className="text-secondary">Accepting invite...</p>
          </div>
        )}

        {status === 'accepted' && (
          <div className="animate-fade-in">
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: 'rgba(34,197,94,0.15)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              margin: '0 auto var(--space-4)',
            }}>
              <Check size={28} style={{ color: '#22c55e' }} />
            </div>
            <h2 style={{ marginBottom: 'var(--space-2)' }}>Welcome aboard!</h2>
            <p className="text-secondary" style={{ marginBottom: 'var(--space-4)' }}>
              You&apos;ve joined <strong>{orgName}</strong>. Redirecting to dashboard...
            </p>
            <Link href="/dashboard" className="btn btn-primary">Go to Dashboard</Link>
          </div>
        )}

        {status === 'error' && (
          <div className="animate-fade-in">
            <AlertTriangle size={40} style={{ color: 'var(--error-400)', marginBottom: 'var(--space-4)' }} />
            <h2 style={{ marginBottom: 'var(--space-2)' }}>Invite Error</h2>
            <p className="text-secondary" style={{ marginBottom: 'var(--space-4)' }}>{error}</p>
            <Link href="/dashboard" className="btn btn-primary">Go to Dashboard</Link>
          </div>
        )}

        {status === 'needs_auth' && (
          <div className="animate-fade-in">
            <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
              You&apos;re invited!
            </h2>
            <p className="text-secondary" style={{ marginBottom: 'var(--space-6)', lineHeight: 1.6 }}>
              Sign in or create an account to join the workspace.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <Link href={`/signup?redirect=${encodeURIComponent(redirectUrl)}`}
                className="btn btn-primary" style={{ width: '100%', padding: 'var(--space-3)' }}>
                <UserPlus size={18} /> Create Account & Join
              </Link>
              <Link href={`/login?redirect=${encodeURIComponent(redirectUrl)}`}
                className="btn btn-secondary" style={{ width: '100%', padding: 'var(--space-3)' }}>
                <LogIn size={18} /> I Already Have an Account
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: 'var(--bg-primary)',
      }}>
        <div className="spinner spinner-lg" />
      </div>
    }>
      <AcceptInviteContent />
    </Suspense>
  );
}
