'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import { Plus, Users, ArrowRight } from 'lucide-react';

function OnboardingScreen() {
  const { user } = useAuth();
  const supabase = createClient();
  const [creating, setCreating] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !orgName.trim()) return;
    setCreating(true);
    setError('');

    const slug =
      orgName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') +
      '-' +
      Math.random().toString(36).substring(2, 6);

    // Insert the org — the database trigger (on_org_created) automatically:
    //   1. Seeds 5 default roles (Owner, Admin, Manager, Member, Viewer)
    //   2. Adds the creator as an active Owner member
    // All via SECURITY DEFINER — no RLS issues.
    const { error: orgError } = await supabase
      .from('organizations')
      .insert({ name: orgName.trim(), slug, created_by: user.id });

    if (orgError) {
      setError(orgError.message || 'Failed to create workspace. Please try again.');
      setCreating(false);
      return;
    }

    // Hard reload so OrgContext re-initializes and picks up the new org
    window.location.href = '/dashboard';
  };
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', padding: 'var(--space-8)',
      background: 'var(--bg-primary)',
    }}>
      <div style={{ maxWidth: '480px', width: '100%', textAlign: 'center' }}>
        <div style={{
          width: '64px', height: '64px', borderRadius: 'var(--radius-xl)',
          background: 'var(--gradient-brand)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-6)',
          fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'white',
        }}>
          T
        </div>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
          Welcome to TaskFlow
        </h1>
        <p className="text-secondary" style={{ marginBottom: 'var(--space-8)', lineHeight: 1.6 }}>
          Create a workspace to start managing tasks, or ask your team admin for an invite link to join an existing workspace.
        </p>

        {!showForm ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <button className="btn btn-primary" onClick={() => setShowForm(true)}
              style={{ width: '100%', padding: 'var(--space-3) var(--space-6)', fontSize: 'var(--text-md)' }}>
              <Plus size={18} /> Create Workspace
            </button>
            <div style={{
              padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
            }}>
              <Users size={20} style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-2)' }} />
              <p className="text-secondary text-sm">
                If your team already has a workspace, ask the admin to send you an invite link.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div className="input-group" style={{ textAlign: 'left', marginBottom: 0 }}>
              <label className="input-label">Workspace Name</label>
              <input
                type="text" className="input" placeholder="e.g. My Team, Acme Inc."
                value={orgName} onChange={(e) => setOrgName(e.target.value)}
                autoFocus required
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={creating || !orgName.trim()}
              style={{ width: '100%' }}>
              {creating ? (
                <span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
              ) : (
                <ArrowRight size={16} />
              )}
              {creating ? 'Creating...' : 'Create Workspace'}
            </button>
            {error && (
              <p style={{ color: 'var(--error-400)', fontSize: 'var(--text-sm)', textAlign: 'left' }}>
                {error}
              </p>
            )}
            <button className="btn btn-ghost" type="button" onClick={() => { setShowForm(false); setError(''); }}>
              Cancel
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();
  const { currentOrg, loading: orgLoading } = useOrg();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Show a single loading screen while auth OR org data is being fetched.
  // This prevents the double-flash (auth loads → org loads) on refresh / tab switch.
  if (authLoading || orgLoading) {
    return (
      <div className="loading-screen">
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 'var(--space-4)',
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: 'var(--radius-lg)',
            background: 'var(--gradient-brand)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 'var(--text-xl)', fontWeight: 800, color: 'white',
            animation: 'pulse 2s ease-in-out infinite',
          }}>T</div>
          <div className="spinner" style={{ width: '24px', height: '24px', borderWidth: '2px' }} />
          <p className="text-secondary text-sm">Loading TaskFlow...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // No org — show onboarding (not an error)
  if (!currentOrg) {
    return <OnboardingScreen />;
  }

  return (
    <div>
      <Sidebar />
      <Topbar />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
