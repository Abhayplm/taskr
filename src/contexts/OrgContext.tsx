'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from './AuthContext';
import type { Organization, OrgMember, OrgRole, PermissionKey, Permissions } from '@/types';

// Shape returned by get_my_orgs() RPC
interface MyOrgRow {
  membership_id: string;
  org_id: string;
  role_id: string | null;
  status: string;
  joined_at: string;
  org_name: string;
  org_slug: string;
  org_logo_url: string | null;
  org_industry: string | null;
  org_website: string | null;
  org_created_at: string;
  role_name: string | null;
  role_permissions: Permissions | null;
  role_is_system: boolean | null;
  role_position: number | null;
}

interface OrgContextType {
  organizations: Organization[];
  currentOrg: Organization | null;
  currentMembership: OrgMember | null;
  currentPermissions: Permissions | null;
  members: OrgMember[];
  roles: OrgRole[];
  loading: boolean;
  switchOrg: (orgId: string) => void;
  refreshOrgs: () => Promise<void>;
  refreshMembers: () => Promise<void>;
  refreshRoles: () => Promise<void>;
  hasPermission: (perm: PermissionKey) => boolean;
}

const DEFAULT_PERMISSIONS: Permissions = {
  'tasks.create': false, 'tasks.edit_own': false, 'tasks.edit_all': false,
  'tasks.delete': false, 'tasks.assign': false,
  'projects.create': false, 'projects.edit': false, 'projects.delete': false,
  'team.view': true, 'team.invite': false, 'team.manage_roles': false,
  'settings.edit': false, 'api_keys.manage': false, 'labels.manage': false,
};

// Full permissions for org Owner / creator
const OWNER_PERMISSIONS: Permissions = {
  'tasks.create': true, 'tasks.edit_own': true, 'tasks.edit_all': true,
  'tasks.delete': true, 'tasks.assign': true,
  'projects.create': true, 'projects.edit': true, 'projects.delete': true,
  'team.view': true, 'team.invite': true, 'team.manage_roles': true,
  'settings.edit': true, 'api_keys.manage': true, 'labels.manage': true,
};

const OrgContext = createContext<OrgContextType>({
  organizations: [],
  currentOrg: null,
  currentMembership: null,
  currentPermissions: null,
  members: [],
  roles: [],
  loading: false,
  switchOrg: () => {},
  refreshOrgs: async () => {},
  refreshMembers: async () => {},
  refreshRoles: async () => {},
  hasPermission: () => false,
});

export function OrgProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [currentMembership, setCurrentMembership] = useState<OrgMember | null>(null);
  const [currentPermissions, setCurrentPermissions] = useState<Permissions | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [roles, setRoles] = useState<OrgRole[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const fetchOrgs = useCallback(async () => {
    if (!user) {
      setOrganizations([]);
      setCurrentOrg(null);
      setCurrentMembership(null);
      setCurrentPermissions(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Use the SECURITY DEFINER RPC — bypasses all RLS circular dependencies
    const { data, error } = await supabase.rpc('get_my_orgs');

    if (error) {
      console.error('[OrgContext] get_my_orgs error:', error.message);
      setLoading(false);
      return;
    }

    const rows = (data || []) as MyOrgRow[];

    if (rows.length > 0) {
      // Build Organization objects
      const orgs: Organization[] = rows.map((r) => ({
        id: r.org_id,
        name: r.org_name,
        slug: r.org_slug,
        logo_url: r.org_logo_url,
        industry: r.org_industry,
        website: r.org_website,
        created_at: r.org_created_at,
        created_by: null,
        updated_at: r.org_created_at,
      }));

      setOrganizations(orgs);

      // Restore last selected org from localStorage
      const savedOrgId = typeof window !== 'undefined'
        ? localStorage.getItem('tf_current_org')
        : null;
      const savedRow = savedOrgId ? rows.find((r) => r.org_id === savedOrgId) : null;
      const selectedRow = savedRow || rows[0];
      const selectedOrg = orgs.find((o) => o.id === selectedRow.org_id) || orgs[0];

      setCurrentOrg(selectedOrg);

      // Build OrgMember + permissions from the selected row
      const role: OrgRole | undefined = selectedRow.role_name ? {
        id: selectedRow.role_id!,
        org_id: selectedRow.org_id,
        name: selectedRow.role_name,
        permissions: selectedRow.role_permissions || DEFAULT_PERMISSIONS,
        is_system: selectedRow.role_is_system ?? false,
        position: selectedRow.role_position ?? 99,
        created_at: selectedRow.joined_at,
      } : undefined;

      setCurrentMembership({
        id: selectedRow.membership_id,
        org_id: selectedRow.org_id,
        user_id: user.id,
        role_id: selectedRow.role_id,
        status: selectedRow.status as 'active',
        joined_at: selectedRow.joined_at,
        role,
      } as OrgMember);

      // Determine effective permissions.
      // Fallback: if the member has no role assigned (old data), check if they
      // created the org and grant full Owner permissions so the UI isn't broken.
      let effectivePermissions = selectedRow.role_permissions;
      if (!effectivePermissions) {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('created_by')
          .eq('id', selectedRow.org_id)
          .single();
        effectivePermissions = (orgData?.created_by === user.id)
          ? OWNER_PERMISSIONS
          : DEFAULT_PERMISSIONS;
      }
      setCurrentPermissions(effectivePermissions);

    } else {
      // No orgs — show onboarding
      setOrganizations([]);
      setCurrentOrg(null);
      setCurrentMembership(null);
      setCurrentPermissions(null);
    }

    setLoading(false);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchMembers = useCallback(async () => {
    if (!currentOrg) return;
    // Use SECURITY DEFINER RPC — bypasses org_members RLS (403 issue)
    const { data } = await supabase.rpc('get_org_members', { p_org_id: currentOrg.id });

    if (data) {
      setMembers(data.map((m: any) => ({
        id: m.id,
        org_id: m.org_id,
        user_id: m.user_id,
        role_id: m.role_id,
        status: m.status,
        joined_at: m.joined_at,
        invited_email: m.invited_email,
        profile: m.user_id ? {
          id: m.user_id,
          full_name: m.profile_name,
          avatar_url: m.profile_avatar,
          job_title: m.profile_job_title,
        } : null,
        role: m.role_name ? {
          id: m.role_id,
          org_id: m.org_id,
          name: m.role_name,
          permissions: m.role_permissions,
          position: m.role_position,
        } : null,
      })) as OrgMember[]);
    }
  }, [currentOrg]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRoles = useCallback(async () => {
    if (!currentOrg) return;
    const { data } = await supabase
      .from('org_roles')
      .select('*')
      .eq('org_id', currentOrg.id)
      .order('position', { ascending: true });
    if (data) setRoles(data as OrgRole[]);
  }, [currentOrg]); // eslint-disable-line react-hooks/exhaustive-deps

  const switchOrg = (orgId: string) => {
    const org = organizations.find((o) => o.id === orgId);
    if (org) {
      setCurrentOrg(org);
      if (typeof window !== 'undefined') {
        localStorage.setItem('tf_current_org', orgId);
      }
    }
  };

  const hasPermission = (perm: PermissionKey): boolean => {
    if (!currentPermissions) return false;
    return currentPermissions[perm] === true;
  };

  useEffect(() => {
    // Wait for auth to resolve before fetching orgs
    if (authLoading) return;
    fetchOrgs();
  }, [user, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (currentOrg) {
      fetchMembers();
      fetchRoles();
    }
  }, [currentOrg]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <OrgContext.Provider
      value={{
        organizations,
        currentOrg,
        currentMembership,
        currentPermissions,
        members,
        roles,
        loading,
        switchOrg,
        refreshOrgs: fetchOrgs,
        refreshMembers: fetchMembers,
        refreshRoles: fetchRoles,
        hasPermission,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
}

export const useOrg = () => useContext(OrgContext);
