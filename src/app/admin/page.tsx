'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatDate, getInitials } from '@/lib/utils';
import {
  Shield,
  Users,
  FolderKanban,
  CheckSquare,
  Search,
  Trash2,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  Building,
  LogOut,
  Lock,
  ArrowRight,
  User
} from 'lucide-react';
import type { Profile } from '@/types';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface SystemStats {
  total_users: number;
  total_organizations: number;
  total_tasks: number;
  total_projects: number;
}

interface SystemUser {
  user_id: string;
  email: string;
  full_name: string | null;
  job_title: string | null;
  is_system_admin: boolean;
  created_at: string;
}

interface SystemOrg {
  org_id: string;
  name: string;
  slug: string;
  industry: string | null;
  created_at: string;
  member_count: number;
  task_count: number;
}

type TabType = 'overview' | 'users' | 'organizations';

export default function AdminPortalPage() {
  const router = useRouter();
  const supabase = createClient();

  // Auth states
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Login form states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Dashboard states
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [organizations, setOrganizations] = useState<SystemOrg[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Action loading states
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<SystemUser | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Check auth session on load
  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        setCurrentProfile(profile);
      } else {
        setCurrentProfile(null);
      }
    } catch (err) {
      console.error('Error checking auth:', err);
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  // Fetch admin dashboard stats & list data
  const fetchDashboardData = async () => {
    if (!currentUser || !currentProfile?.is_system_admin) return;

    setDataLoading(true);
    try {
      // 1. Stats
      const { data: statsData, error: statsError } = await supabase.rpc('admin_get_stats');
      if (statsError) throw statsError;
      if (statsData && statsData.length > 0) {
        setStats(statsData[0]);
      }

      // 2. Users
      const { data: usersData, error: usersError } = await supabase.rpc('admin_get_users');
      if (usersError) throw usersError;
      setUsers(usersData || []);

      // 3. Orgs
      const { data: orgsData, error: orgsError } = await supabase.rpc('admin_get_organizations');
      if (orgsError) throw orgsError;
      setOrganizations(orgsData || []);

    } catch (err: any) {
      console.error('Error fetching admin data:', err);
      setToast({
        type: 'error',
        message: err.message || 'Failed to retrieve administrative data.'
      });
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser && currentProfile?.is_system_admin) {
      fetchDashboardData();
    }
  }, [currentUser, currentProfile]);

  // Handle Developer Admin Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail.toLowerCase().trim(),
        password: loginPassword,
      });

      if (authError) throw authError;

      // Use a SECURITY DEFINER RPC — bypasses profiles RLS entirely.
      // Returns the real is_system_admin value from the DB every time.
      const { data: isAdmin, error: rpcError } = await supabase.rpc('check_is_system_admin');

      if (rpcError || !isAdmin) {
        await supabase.auth.signOut();
        throw new Error('Access Denied: This account does not have platform administrator privileges.');
      }

      // Also fetch the profile for display purposes only
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      setCurrentUser(authData.user);
      setCurrentProfile(profile || { id: authData.user.id, is_system_admin: true } as any);
      setLoginEmail('');
      setLoginPassword('');
    } catch (err: any) {
      console.error('Admin login error:', err);
      setLoginError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoginLoading(false);
    }

  };

  // Sign out developer
  const handleSignOut = async () => {
    setAuthLoading(true);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error signing out developer:', err);
    }
    setCurrentUser(null);
    setCurrentProfile(null);
    setStats(null);
    setUsers([]);
    setOrganizations([]);
    setAuthLoading(false);
    
    // Hard redirect to clear contexts and display a clean developer login form
    if (typeof window !== 'undefined') {
      window.location.href = '/admin';
    }
  };

  // Toggle admin privilege for another user
  const handleToggleAdmin = async (targetUser: SystemUser) => {
    if (!currentUser || !currentProfile) return;
    if (targetUser.user_id === currentUser.id) {
      setToast({
        type: 'error',
        message: 'Security safeguard: You cannot revoke your own system administrator status.'
      });
      return;
    }

    const nextState = !targetUser.is_system_admin;
    setActionLoading(prev => ({ ...prev, [targetUser.user_id]: true }));

    try {
      const { data, error } = await supabase.rpc('admin_toggle_system_admin', {
        target_user_id: targetUser.user_id,
        make_admin: nextState
      });

      if (error) throw error;

      // Update local state
      setUsers(prev =>
        prev.map(u => (u.user_id === targetUser.user_id ? { ...u, is_system_admin: nextState } : u))
      );

      setToast({
        type: 'success',
        message: `Successfully ${nextState ? 'promoted' : 'demoted'} ${targetUser.full_name || targetUser.email}.`
      });

      // Refresh stats in background
      const { data: statsData } = await supabase.rpc('admin_get_stats');
      if (statsData && statsData.length > 0) setStats(statsData[0]);

    } catch (err: any) {
      console.error('Error toggling admin role:', err);
      setToast({
        type: 'error',
        message: err.message || 'Failed to update user privilege status.'
      });
    } finally {
      setActionLoading(prev => ({ ...prev, [targetUser.user_id]: false }));
    }
  };

  // Delete user account permanently
  const handleDeleteUser = async () => {
    if (!deleteConfirmUser || !currentUser) return;
    const targetUserId = deleteConfirmUser.user_id;

    if (targetUserId === currentUser.id) {
      setToast({
        type: 'error',
        message: 'Security safeguard: You cannot delete your own account.'
      });
      setDeleteConfirmUser(null);
      return;
    }

    setActionLoading(prev => ({ ...prev, [targetUserId]: true }));
    setDeleteConfirmUser(null);

    try {
      const { data, error } = await supabase.rpc('admin_delete_user', {
        target_user_id: targetUserId
      });

      if (error) throw error;

      // Update local list
      setUsers(prev => prev.filter(u => u.user_id !== targetUserId));
      setToast({
        type: 'success',
        message: `Successfully deleted user ${deleteConfirmUser.full_name || deleteConfirmUser.email} from the system.`
      });

      // Refresh stats
      const { data: statsData } = await supabase.rpc('admin_get_stats');
      if (statsData && statsData.length > 0) setStats(statsData[0]);

      // Refresh organizations
      const { data: orgsData } = await supabase.rpc('admin_get_organizations');
      if (orgsData) setOrganizations(orgsData);

    } catch (err: any) {
      console.error('Error deleting user:', err);
      setToast({
        type: 'error',
        message: err.message || 'Failed to delete user account.'
      });
    } finally {
      setActionLoading(prev => ({ ...prev, [targetUserId]: false }));
    }
  };

  // Filter queries
  const filteredUsers = users.filter(user => {
    const query = searchQuery.toLowerCase();
    return (
      (user.full_name || '').toLowerCase().includes(query) ||
      (user.email || '').toLowerCase().includes(query) ||
      (user.job_title || '').toLowerCase().includes(query)
    );
  });

  const filteredOrgs = organizations.filter(org => {
    const query = searchQuery.toLowerCase();
    return (
      org.name.toLowerCase().includes(query) ||
      org.slug.toLowerCase().includes(query) ||
      (org.industry || '').toLowerCase().includes(query)
    );
  });

  // State 1: Auth check is loading
  if (authLoading) {
    return (
      <div className="loading-screen" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', background: '#0a0a0c' }}>
        <Loader2 className="animate-spin text-brand" size={40} style={{ color: 'var(--brand-400)' }} />
        <p className="text-secondary text-sm">Verifying administration credentials...</p>
      </div>
    );
  }

  // State 2: Logged in but insufficient permissions (Not an Admin)
  if (currentUser && !currentProfile?.is_system_admin) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0c', padding: 'var(--space-4)' }}>
        <div className="glass-card card" style={{ maxWidth: '480px', padding: 'var(--space-6)', border: '1px solid var(--error-border)', background: 'rgba(10, 10, 12, 0.8)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)', textAlign: 'center' }}>
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: 'var(--space-3)', borderRadius: '50%' }}>
              <AlertTriangle size={32} color="var(--error-400)" />
            </div>
            
            <h2 className="card-title" style={{ fontSize: 'var(--text-xl)', color: 'var(--text-primary)' }}>Access Denied</h2>
            
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 'var(--leading-relaxed)' }}>
              You are logged in as <strong style={{ color: 'var(--text-primary)' }}>{currentUser.email}</strong>. 
              This account does not have platform administrator privileges.
            </p>

            <div 
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 'var(--space-3)', 
                width: '100%', 
                marginTop: 'var(--space-4)' 
              }}
            >
              <button 
                onClick={() => router.push('/dashboard')}
                className="btn btn-primary"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}
              >
                Go to Workspace Dashboard
                <ArrowRight size={16} />
              </button>
              
              <button 
                onClick={handleSignOut}
                className="btn btn-secondary"
                style={{ width: '100%' }}
              >
                Sign Out / Use Admin Account
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // State 3: Not authenticated — Render Developer Login Screen
  if (!currentUser) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#09090b', padding: 'var(--space-4)' }}>
        <div 
          className="glass-card card animate-fade-in" 
          style={{ 
            maxWidth: '420px', 
            width: '100%', 
            padding: 'var(--space-8)', 
            border: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(12, 12, 16, 0.75)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8)'
          }}
        >
          {/* Logo Section */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
            <div style={{ background: 'linear-gradient(135deg, var(--brand-500), var(--accent-500))', padding: 'var(--space-3)', borderRadius: 'var(--radius-xl)' }}>
              <Shield size={28} color="#fff" />
            </div>
            <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.025em', marginTop: 'var(--space-2)' }}>
              TaskFlow Admin Portal
            </h1>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
              System Developer Administrator Access Only
            </p>
          </div>

          {/* Form error */}
          {loginError && (
            <div 
              className="auth-error animate-fade-in" 
              style={{ 
                marginBottom: 'var(--space-4)', 
                fontSize: 'var(--text-xs)', 
                display: 'flex', 
                gap: 'var(--space-2)', 
                alignItems: 'start' 
              }}
            >
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{loginError}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="input-group">
              <label className="input-label" style={{ fontSize: 'var(--text-xs)' }}>Developer Email</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>
                  <User size={14} />
                </span>
                <input
                  type="email"
                  placeholder="admin@taskflow.com"
                  className="input"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  style={{ paddingLeft: 'var(--space-9)', fontSize: 'var(--text-sm)', background: 'rgba(0, 0, 0, 0.2)' }}
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label" style={{ fontSize: 'var(--text-xs)' }}>Security Credentials</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>
                  <Lock size={14} />
                </span>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="input"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  style={{ paddingLeft: 'var(--space-9)', fontSize: 'var(--text-sm)', background: 'rgba(0, 0, 0, 0.2)' }}
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={loginLoading}
              style={{ 
                marginTop: 'var(--space-2)', 
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-2)'
              }}
            >
              {loginLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <Lock size={14} />
                  Access Admin Terminal
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // State 4: Authenticated Developer Admin — Render Admin Dashboard
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0c', color: 'var(--text-primary)' }}>
      {/* Admin Panel Header Bar */}
      <header 
        style={{ 
          background: 'rgba(12, 12, 16, 0.8)', 
          borderBottom: '1px solid var(--border-subtle)', 
          padding: 'var(--space-4) var(--space-8)',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 10
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: 'var(--space-2)', borderRadius: 'var(--radius-md)' }}>
            <Shield size={20} color="var(--brand-400)" />
          </div>
          <div>
            <h1 style={{ fontSize: 'var(--text-base)', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              Developer Portal
              <span className="badge badge-brand" style={{ fontSize: '10px', padding: '1px 6px' }}>SYSTEM ADMIN</span>
            </h1>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: 0 }}>Logged in as: {currentUser.email}</p>
          </div>
        </div>

        <button 
          onClick={handleSignOut}
          className="btn btn-ghost btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--text-secondary)' }}
        >
          <LogOut size={14} />
          Sign Out Developer
        </button>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: 'var(--space-8)' }}>
        
        {/* Toast Alert */}
        {toast && (
          <div className="toast-container">
            <div className={`toast toast-${toast.type}`}>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                {toast.message}
              </span>
            </div>
          </div>
        )}

        {/* Dashboard Title Section */}
        <div className="page-header" style={{ marginBottom: 'var(--space-6)' }}>
          <div>
            <h2 className="page-title" style={{ fontSize: 'var(--text-2xl)' }}>Developer Admin Console</h2>
            <p className="page-subtitle">Inspect registered organizations, configure user roles, and monitor system metrics.</p>
          </div>
        </div>

        {/* Tabs Menu */}
        <div 
          style={{ 
            display: 'flex', 
            gap: 'var(--space-2)', 
            borderBottom: '1px solid var(--border-subtle)', 
            marginBottom: 'var(--space-6)',
            paddingBottom: 'var(--space-2)' 
          }}
        >
          <button 
            className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-ghost'}`} 
            onClick={() => { setActiveTab('overview'); setSearchQuery(''); }}
          >
            Overview
          </button>
          <button 
            className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-ghost'}`} 
            onClick={() => { setActiveTab('users'); setSearchQuery(''); }}
          >
            Users ({users.length})
          </button>
          <button 
            className={`btn ${activeTab === 'organizations' ? 'btn-primary' : 'btn-ghost'}`} 
            onClick={() => { setActiveTab('organizations'); setSearchQuery(''); }}
          >
            Organizations ({organizations.length})
          </button>
        </div>

        {/* Data Loading */}
        {dataLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: 'var(--space-3)' }}>
            <Loader2 className="animate-spin text-secondary" size={32} />
            <p className="text-secondary text-sm">Querying system records...</p>
          </div>
        ) : (
          <>
            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="animate-fade-in">
                <div 
                  style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
                    gap: 'var(--space-6)',
                    marginBottom: 'var(--space-8)'
                  }}
                >
                  {/* Stats Card 1 */}
                  <div className="glass-card card">
                    <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'start', width: '100%' }}>
                      <div style={{ flex: 1 }}>
                        <span className="card-description" style={{ textTransform: 'uppercase', fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: 'var(--tracking-wide)' }}>Total Users</span>
                        <h2 className="card-title" style={{ fontSize: 'var(--text-4xl)', marginTop: 'var(--space-2)', fontWeight: 800 }}>
                          {stats?.total_users ?? 0}
                        </h2>
                      </div>
                      <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: 'var(--space-2)', borderRadius: 'var(--radius-md)' }}>
                        <Users size={20} color="var(--brand-400)" />
                      </div>
                    </div>
                  </div>

                  {/* Stats Card 2 */}
                  <div className="glass-card card">
                    <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'start', width: '100%' }}>
                      <div style={{ flex: 1 }}>
                        <span className="card-description" style={{ textTransform: 'uppercase', fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: 'var(--tracking-wide)' }}>Organizations</span>
                        <h2 className="card-title" style={{ fontSize: 'var(--text-4xl)', marginTop: 'var(--space-2)', fontWeight: 800 }}>
                          {stats?.total_organizations ?? 0}
                        </h2>
                      </div>
                      <div style={{ background: 'rgba(34, 197, 94, 0.1)', padding: 'var(--space-2)', borderRadius: 'var(--radius-md)' }}>
                        <Building size={20} color="var(--success-400)" />
                      </div>
                    </div>
                  </div>

                  {/* Stats Card 3 */}
                  <div className="glass-card card">
                    <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'start', width: '100%' }}>
                      <div style={{ flex: 1 }}>
                        <span className="card-description" style={{ textTransform: 'uppercase', fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: 'var(--tracking-wide)' }}>Total Tasks</span>
                        <h2 className="card-title" style={{ fontSize: 'var(--text-4xl)', marginTop: 'var(--space-2)', fontWeight: 800 }}>
                          {stats?.total_tasks ?? 0}
                        </h2>
                      </div>
                      <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: 'var(--space-2)', borderRadius: 'var(--radius-md)' }}>
                        <CheckSquare size={20} color="var(--warning-400)" />
                      </div>
                    </div>
                  </div>

                  {/* Stats Card 4 */}
                  <div className="glass-card card">
                    <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'start', width: '100%' }}>
                      <div style={{ flex: 1 }}>
                        <span className="card-description" style={{ textTransform: 'uppercase', fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: 'var(--tracking-wide)' }}>Projects</span>
                        <h2 className="card-title" style={{ fontSize: 'var(--text-4xl)', marginTop: 'var(--space-2)', fontWeight: 800 }}>
                          {stats?.total_projects ?? 0}
                        </h2>
                      </div>
                      <div style={{ background: 'rgba(6, 182, 212, 0.1)', padding: 'var(--space-2)', borderRadius: 'var(--radius-md)' }}>
                        <FolderKanban size={20} color="var(--accent-400)" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Informational Panel */}
                <div className="glass card" style={{ padding: 'var(--space-5)', borderLeft: '3px solid var(--brand-500)', display: 'flex', gap: 'var(--space-4)', background: 'rgba(255, 255, 255, 0.02)' }}>
                  <ShieldCheck size={24} style={{ color: 'var(--brand-400)', flexShrink: 0 }} />
                  <div>
                    <h4 style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>Administrator Authorization Active</h4>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)', lineHeight: 'var(--leading-relaxed)' }}>
                      As a system administrator, you have complete cross-tenant visibility. You can toggle administrator status for users to delegate rights or permanently delete user registrations to maintain security compliance. Be cautious when triggering deletions, as all associated user records cascade delete from the database.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: USERS */}
            {activeTab === 'users' && (
              <div className="animate-fade-in">
                {/* Search input */}
                <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                  <div className="input-group" style={{ flex: 1, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>
                      <Search size={16} />
                    </span>
                    <input
                      type="text"
                      placeholder="Search users by name, email, or job title..."
                      className="input"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ paddingLeft: 'var(--space-10)' }}
                    />
                  </div>
                </div>

                {/* Table */}
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Job Title</th>
                        <th>Joined Date</th>
                        <th>System Admin</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)' }}>
                            No users found matching the query.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((user) => {
                          const isSelf = user.user_id === currentUser.id;
                          const toggling = actionLoading[user.user_id] || false;
                          return (
                            <tr key={user.user_id}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                  <div className="avatar avatar-sm">
                                    {getInitials(user.full_name || user.email)}
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                                      {user.full_name || 'Anonymous User'}
                                      {isSelf && <span className="badge badge-brand" style={{ marginLeft: 'var(--space-2)' }}>You</span>}
                                    </span>
                                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                                      {user.email}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td>{user.job_title || <span style={{ color: 'var(--text-muted)' }}>Not specified</span>}</td>
                              <td>{formatDate(user.created_at)}</td>
                              <td>
                                <button
                                  disabled={isSelf || toggling}
                                  onClick={() => handleToggleAdmin(user)}
                                  className="btn btn-sm"
                                  style={{
                                    background: user.is_system_admin ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-glass)',
                                    border: `1px solid ${user.is_system_admin ? 'rgba(99, 102, 241, 0.3)' : 'var(--border-default)'}`,
                                    color: user.is_system_admin ? 'var(--brand-300)' : 'var(--text-secondary)',
                                    padding: '4px var(--space-3)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--space-1.5)',
                                    opacity: isSelf ? 0.6 : 1,
                                    cursor: isSelf ? 'not-allowed' : 'pointer'
                                  }}
                                >
                                  {toggling ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : (
                                    <Shield size={12} />
                                  )}
                                  {user.is_system_admin ? 'System Admin' : 'Standard User'}
                                </button>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  disabled={isSelf || toggling}
                                  onClick={() => setDeleteConfirmUser(user)}
                                  className="btn btn-sm btn-ghost btn-icon"
                                  style={{
                                    color: 'var(--error-400)',
                                    opacity: isSelf ? 0.4 : 1,
                                    cursor: isSelf ? 'not-allowed' : 'pointer'
                                  }}
                                  title={isSelf ? 'Cannot delete your own account' : 'Delete user account'}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: ORGANIZATIONS */}
            {activeTab === 'organizations' && (
              <div className="animate-fade-in">
                {/* Search input */}
                <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                  <div className="input-group" style={{ flex: 1, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>
                      <Search size={16} />
                    </span>
                    <input
                      type="text"
                      placeholder="Search organizations by name, slug, or industry..."
                      className="input"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ paddingLeft: 'var(--space-10)' }}
                    />
                  </div>
                </div>

                {/* Table */}
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Organization Name</th>
                        <th>Slug</th>
                        <th>Industry</th>
                        <th>Created Date</th>
                        <th>Active Members</th>
                        <th style={{ textAlign: 'right' }}>Total Tasks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrgs.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)' }}>
                            No organizations found matching the query.
                          </td>
                        </tr>
                      ) : (
                        filteredOrgs.map((org) => (
                          <tr key={org.org_id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                <div style={{ background: 'var(--gradient-brand-subtle)', padding: 'var(--space-2)', borderRadius: 'var(--radius-md)' }}>
                                  <Building size={16} color="var(--brand-400)" />
                                </div>
                                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                                  {org.name}
                                </span>
                              </div>
                            </td>
                            <td>
                              <code style={{ fontSize: 'var(--text-xs)', background: 'var(--bg-glass)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                                {org.slug}
                              </code>
                            </td>
                            <td>
                              {org.industry ? (
                                <span className="badge badge-default" style={{ textTransform: 'capitalize' }}>
                                  {org.industry}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>Not specified</span>
                              )}
                            </td>
                            <td>{formatDate(org.created_at)}</td>
                            <td>
                              <span className="badge badge-info badge-dot">
                                {org.member_count} active
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 500, color: 'var(--text-primary)' }}>
                              {org.task_count}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Delete User Confirmation Modal */}
        {deleteConfirmUser && (
          <div className="modal-overlay">
            <div className="modal" style={{ maxWidth: '460px', background: 'rgba(15, 15, 20, 0.95)', border: '1px solid var(--border-subtle)' }}>
              <div className="modal-header">
                <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--error-400)' }}>
                  <AlertTriangle size={20} />
                  Delete User Account?
                </h3>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 'var(--leading-relaxed)' }}>
                  You are about to delete user <strong style={{ color: 'var(--text-primary)' }}>{deleteConfirmUser.full_name || 'Anonymous'}</strong> ({deleteConfirmUser.email}).
                </p>
                
                <div 
                  style={{ 
                    background: 'rgba(239, 68, 68, 0.05)', 
                    border: '1px solid rgba(239, 68, 68, 0.2)', 
                    borderRadius: 'var(--radius-md)', 
                    padding: 'var(--space-3) var(--space-4)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--error-400)',
                    lineHeight: 'var(--leading-normal)'
                  }}
                >
                  <strong>CRITICAL:</strong> This operation is permanent and cannot be undone. It deletes the user profile and their auth record. Any organizations they created and tasks they own will trigger cascade modifications in the database.
                </div>
              </div>

              <div className="modal-footer">
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setDeleteConfirmUser(null)}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-danger" 
                  onClick={handleDeleteUser}
                  style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
                >
                  <Trash2 size={14} />
                  Confirm Deletion
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
