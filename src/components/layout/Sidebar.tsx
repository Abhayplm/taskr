'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { createClient } from '@/lib/supabase/client';
import { getInitials } from '@/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, CheckSquare, FolderKanban, Calendar,
  BarChart3, Users, Settings, LogOut, ChevronDown,
  Shield, Plus, Key, User, Building2, Check, Hash,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard',            label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/dashboard/tasks',      label: 'Tasks',      icon: CheckSquare },
  { href: '/dashboard/projects',   label: 'Projects',   icon: FolderKanban },
  { href: '/dashboard/teams',      label: 'Teams',      icon: Hash },
  { href: '/dashboard/calendar',   label: 'Calendar',   icon: Calendar },
  { href: '/dashboard/analytics',  label: 'Analytics',  icon: BarChart3 },
  { href: '/dashboard/team',       label: 'Members',    icon: Users },
];

const SETTINGS_ITEMS = [
  { href: '/dashboard/settings',           label: 'General',  icon: Settings },
  { href: '/dashboard/settings/api-keys',  label: 'API Keys', icon: Key },
  { href: '/dashboard/settings/profile',   label: 'Profile',  icon: User },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const { organizations, currentOrg, switchOrg } = useOrg();
  const supabase = createClient();

  const [showOrgMenu, setShowOrgMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const orgMenuRef = useRef<HTMLDivElement>(null);

  // Close org menu when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (orgMenuRef.current && !orgMenuRef.current.contains(e.target as Node)) {
        setShowOrgMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  const settingsActive = pathname.startsWith('/dashboard/settings');

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = (await supabase.auth.getUser()).data.user;
    if (!user || !newOrgName.trim()) return;
    setCreating(true);
    setCreateError('');

    const slug =
      newOrgName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') +
      '-' +
      Math.random().toString(36).substring(2, 6);

    const { error } = await supabase
      .from('organizations')
      .insert({ name: newOrgName.trim(), slug, created_by: user.id });

    if (error) {
      setCreateError(error.message);
      setCreating(false);
      return;
    }

    // Hard reload — OrgContext re-fetches via get_my_orgs() RPC
    window.location.href = '/dashboard';
  };

  return (
    <aside className="sidebar">
      {/* ── Logo ── */}
      <div className="sidebar-header">
        <Link href="/dashboard" className="sidebar-logo" style={{ textDecoration: 'none' }}>
          <div className="sidebar-logo-icon">T</div>
          <span className="sidebar-logo-text">TaskFlow</span>
        </Link>
      </div>

      {/* ── Org Switcher ── */}
      <div className="sidebar-org" ref={orgMenuRef}>
        <button
          className="sidebar-org-btn"
          onClick={() => { setShowOrgMenu(!showOrgMenu); setShowCreateOrg(false); }}
        >
          <div className="sidebar-org-avatar">
            {getInitials(currentOrg?.name || '?')}
          </div>
          <span className="sidebar-org-name">{currentOrg?.name || 'No workspace'}</span>
          <ChevronDown size={13} className={`sidebar-org-chevron ${showOrgMenu ? 'open' : ''}`} />
        </button>

        {showOrgMenu && (
          <div className="sidebar-org-dropdown">
            <p className="sidebar-org-dropdown-label">Your workspaces</p>

            {organizations.map((org) => (
              <button
                key={org.id}
                className={`sidebar-org-item ${org.id === currentOrg?.id ? 'active' : ''}`}
                onClick={() => { switchOrg(org.id); setShowOrgMenu(false); }}
              >
                <div className="sidebar-org-item-avatar">{getInitials(org.name)}</div>
                <span className="sidebar-org-item-name">{org.name}</span>
                {org.id === currentOrg?.id && <Check size={14} style={{ color: 'var(--brand-400)', marginLeft: 'auto' }} />}
              </button>
            ))}

            <div className="sidebar-org-divider" />

            {!showCreateOrg ? (
              <button
                className="sidebar-org-item"
                onClick={() => setShowCreateOrg(true)}
              >
                <div className="sidebar-org-item-avatar" style={{ background: 'var(--bg-glass)' }}>
                  <Plus size={12} />
                </div>
                <span className="sidebar-org-item-name">New workspace</span>
              </button>
            ) : (
              <form onSubmit={handleCreateOrg} style={{ padding: 'var(--space-2) var(--space-2) var(--space-1)' }}>
                <input
                  autoFocus
                  type="text"
                  className="input"
                  placeholder="Workspace name"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  style={{ fontSize: 'var(--text-xs)', padding: 'var(--space-2) var(--space-3)', marginBottom: 'var(--space-2)' }}
                />
                {createError && (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--error-400)', marginBottom: 'var(--space-2)' }}>
                    {createError}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button type="submit" disabled={creating || !newOrgName.trim()} className="btn btn-primary btn-sm" style={{ flex: 1, fontSize: 'var(--text-xs)' }}>
                    {creating ? 'Creating…' : 'Create'}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowCreateOrg(false); setNewOrgName(''); setCreateError(''); }} style={{ fontSize: 'var(--text-xs)' }}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="sidebar-nav">
        <div className="sidebar-nav-group">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-nav-item ${active ? 'active' : ''}`}
              >
                <Icon size={17} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="sidebar-nav-group" style={{ marginTop: 'var(--space-2)' }}>
          <p className="sidebar-nav-section-label">Settings</p>
          <button
            className={`sidebar-nav-item ${settingsActive ? 'active' : ''}`}
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings size={17} />
            <span style={{ flex: 1, textAlign: 'left' }}>Settings</span>
            <ChevronDown size={13} style={{
              transform: showSettings ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease',
              opacity: 0.6,
            }} />
          </button>
          {showSettings && SETTINGS_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-nav-item sidebar-nav-item-sub ${active ? 'active' : ''}`}
              >
                <Icon size={14} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── Footer ── */}
      <div className="sidebar-footer">
        {profile?.is_system_admin && (
          <Link href="/admin" className="sidebar-nav-item" style={{ color: 'var(--warning-400)', marginBottom: 'var(--space-2)' }}>
            <Shield size={17} />
            <span>Admin Panel</span>
          </Link>
        )}
        <div className="sidebar-user">
          <div className="avatar avatar-sm">{getInitials(profile?.full_name)}</div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{profile?.full_name || 'User'}</span>
            <span className="sidebar-user-role">{profile?.job_title || 'Member'}</span>
          </div>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={signOut} title="Sign out" style={{ flexShrink: 0 }}>
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
