'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { getInitials } from '@/lib/utils';
import { Bell, Search } from 'lucide-react';
import { useState } from 'react';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/calendar': 'Calendar',
  '/dashboard/tasks': 'Tasks',
  '/dashboard/projects': 'Projects',
  '/dashboard/team': 'Team',
  '/dashboard/analytics': 'Analytics',
  '/dashboard/settings': 'Settings',
  '/dashboard/settings/api-keys': 'API Keys',
  '/dashboard/settings/profile': 'Profile',
};

export default function Topbar() {
  const pathname = usePathname();
  const { profile } = useAuth();
  const { currentOrg } = useOrg();

  const pageTitle = PAGE_TITLES[pathname] || 'TaskFlow';

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="topbar-title">{pageTitle}</h1>
        {currentOrg && (
          <span style={{
            fontSize: 'var(--text-xs)', color: 'var(--text-muted)',
            marginLeft: 'var(--space-2)', background: 'var(--bg-glass)',
            padding: '2px 8px', borderRadius: 'var(--radius-full)',
          }}>
            {currentOrg.name}
          </span>
        )}
      </div>

      <div className="topbar-right">
        {/* Notifications */}
        <button className="btn btn-ghost btn-icon" title="Notifications" style={{ position: 'relative' }}>
          <Bell size={18} />
        </button>

        {/* User avatar */}
        <div className="avatar avatar-sm" style={{ cursor: 'pointer' }}>
          {getInitials(profile?.full_name)}
        </div>
      </div>
    </header>
  );
}
