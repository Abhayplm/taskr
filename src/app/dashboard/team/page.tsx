'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { createClient } from '@/lib/supabase/client';
import { getInitials, formatDate } from '@/lib/utils';
import {
  Plus, X, Users, Shield, Mail, Trash2,
  Settings, ChevronDown, Check, RefreshCw,
} from 'lucide-react';
import type { OrgMember, OrgRole, PermissionKey } from '@/types';
import { ALL_PERMISSIONS, DEFAULT_PERMISSIONS } from '@/types';

export default function TeamPage() {
  const { user } = useAuth();
  const { currentOrg, members, roles, hasPermission, refreshMembers, refreshRoles } = useOrg();
  const supabase = createClient();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<OrgRole | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [resendingEmail, setResendingEmail] = useState<string | null>(null);

  // Role form
  const [roleName, setRoleName] = useState('');
  const [rolePermissions, setRolePermissions] = useState(DEFAULT_PERMISSIONS);
  const [savingRole, setSavingRole] = useState(false);

  const canInvite = hasPermission('team.invite');
  const canManageRoles = hasPermission('team.manage_roles');

  useEffect(() => {
    if (roles.length > 0 && !inviteRoleId) {
      const memberRole = roles.find(r => r.name === 'Member');
      setInviteRoleId(memberRole?.id || roles[0]?.id || '');
    }
  }, [roles]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg || !inviteEmail.trim() || !inviteRoleId) return;
    setInviting(true);
    setInviteLink('');

    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          orgId: currentOrg.id,
          roleId: inviteRoleId,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setInviteLink(data.inviteUrl);
        refreshMembers();
        setInviteEmail('');
      } else {
        alert(data.error || 'Failed to invite');
      }
    } catch {
      alert('Network error');
    }
    setInviting(false);
  };

  const handleResendInvite = async (email: string, roleId: string | null) => {
    if (!currentOrg || !email) return;
    setResendingEmail(email);

    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          orgId: currentOrg.id,
          roleId: roleId || '',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Invite email resent successfully!');
      } else {
        alert(data.error || 'Failed to resend invite');
      }
    } catch {
      alert('Network error');
    } finally {
      setResendingEmail(null);
    }
  };

  const removeMember = async (memberId: string) => {
    if (!confirm('Remove this member?')) return;
    await supabase.from('org_members').delete().eq('id', memberId);
    refreshMembers();
  };

  const changeRole = async (memberId: string, newRoleId: string) => {
    await supabase.from('org_members').update({ role_id: newRoleId }).eq('id', memberId);
    refreshMembers();
  };

  const openRoleEditor = (role?: OrgRole) => {
    if (role) {
      setEditingRole(role);
      setRoleName(role.name);
      setRolePermissions(role.permissions);
    } else {
      setEditingRole(null);
      setRoleName('');
      setRolePermissions({ ...DEFAULT_PERMISSIONS });
    }
    setShowRoleModal(true);
  };

  const saveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg || !roleName.trim()) return;
    setSavingRole(true);

    if (editingRole) {
      await supabase.from('org_roles')
        .update({ name: roleName.trim(), permissions: rolePermissions })
        .eq('id', editingRole.id);
    } else {
      const maxPos = Math.max(...roles.map(r => r.position), -1);
      await supabase.from('org_roles').insert({
        org_id: currentOrg.id,
        name: roleName.trim(),
        permissions: rolePermissions,
        position: maxPos + 1,
      });
    }

    setSavingRole(false);
    setShowRoleModal(false);
    refreshRoles();
    refreshMembers();
  };

  const deleteRole = async (roleId: string) => {
    if (!confirm('Delete this role? Members with this role will lose their permissions.')) return;
    await supabase.from('org_roles').delete().eq('id', roleId);
    refreshRoles();
  };

  const togglePermission = (key: PermissionKey) => {
    setRolePermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const activeMembers = members.filter(m => m.status === 'active');
  const pendingMembers = members.filter(m => m.status === 'pending');

  // Group permissions by category
  const permissionGroups = ALL_PERMISSIONS.reduce((acc, perm) => {
    if (!acc[perm.group]) acc[perm.group] = [];
    acc[perm.group].push(perm);
    return acc;
  }, {} as Record<string, typeof ALL_PERMISSIONS>);

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Team</h1>
          <p className="page-subtitle">{activeMembers.length} active members</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          {canManageRoles && (
            <button className="btn btn-secondary" onClick={() => openRoleEditor()}>
              <Shield size={16} /> Manage Roles
            </button>
          )}
          {canInvite && (
            <button className="btn btn-primary" onClick={() => { setShowInviteModal(true); setInviteLink(''); }}>
              <Plus size={16} /> Invite Member
            </button>
          )}
        </div>
      </div>

      {/* Roles Summary */}
      {canManageRoles && (
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <h3 className="card-title" style={{ marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Shield size={16} /> Organization Roles ({roles.length})
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {roles.map(role => (
              <button key={role.id} onClick={() => openRoleEditor(role)}
                className="btn btn-ghost btn-sm" style={{
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                }}>
                <Shield size={12} /> {role.name}
                {role.is_system && <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginLeft: '4px' }}>(system)</span>}
              </button>
            ))}
            <button className="btn btn-ghost btn-sm" onClick={() => openRoleEditor()}
              style={{ border: '1px dashed var(--border-subtle)', color: 'var(--text-tertiary)' }}>
              <Plus size={12} /> New Role
            </button>
          </div>
        </div>
      )}

      {/* Active Members */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <h3 className="card-title" style={{ marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Users size={16} /> Active Members
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {activeMembers.map(member => (
            <div key={member.id} style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
              padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)', background: 'var(--bg-glass)',
            }}>
              <div className="avatar avatar-sm">{getInitials(member.profile?.full_name)}</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 500 }}>{member.profile?.full_name || 'Unknown'}</p>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                  {member.invited_email || ''} · Joined {formatDate(member.joined_at)}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                {canManageRoles && member.user_id !== user?.id ? (
                  <select className="input select" value={member.role_id || ''}
                    onChange={(e) => changeRole(member.id, e.target.value)}
                    style={{ width: 'auto', fontSize: 'var(--text-sm)' }}>
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                ) : (
                  <span style={{
                    fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--brand-400)',
                    padding: '4px 10px', background: 'rgba(99,102,241,0.1)',
                    borderRadius: 'var(--radius-full)',
                  }}>
                    {member.role?.name || 'Member'}
                  </span>
                )}
                {canInvite && member.user_id !== user?.id && (
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => removeMember(member.id)} title="Remove member">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pending Invites */}
      {pendingMembers.length > 0 && (
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Mail size={16} /> Pending Invites ({pendingMembers.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {pendingMembers.map(member => (
              <div key={member.id} style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--border-subtle)', background: 'var(--bg-glass)',
                opacity: 0.7,
              }}>
                <div className="avatar avatar-sm" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                  <Mail size={14} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 500 }}>{member.invited_email}</p>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Invited · {member.role?.name || 'Member'}</p>
                </div>
                {canInvite && (
                  <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      onClick={() => handleResendInvite(member.invited_email || '', member.role_id)}
                      title="Resend Invite"
                      disabled={resendingEmail === member.invited_email}
                      style={{ color: 'var(--brand-400)' }}
                    >
                      {resendingEmail === member.invited_email ? (
                        <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
                      ) : (
                        <RefreshCw size={14} />
                      )}
                    </button>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => removeMember(member.id)} title="Cancel invite">
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="modal-overlay" onClick={() => setShowInviteModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Invite Team Member</h2>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowInviteModal(false)}><X size={16} /></button>
            </div>
            {inviteLink ? (
              <div className="modal-body" style={{ textAlign: 'center' }}>
                <Check size={40} style={{ color: 'var(--success-400)', marginBottom: 'var(--space-3)' }} />
                <h3 style={{ marginBottom: 'var(--space-2)' }}>Invite Created!</h3>
                <p className="text-secondary text-sm" style={{ marginBottom: 'var(--space-3)' }}>
                  Share this link with the team member:
                </p>
                <div style={{
                  padding: 'var(--space-3)', background: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-md)', fontSize: 'var(--text-xs)',
                  wordBreak: 'break-all', fontFamily: 'monospace', marginBottom: 'var(--space-3)',
                }}>
                  {inviteLink}
                </div>
                <button className="btn btn-primary w-full" onClick={() => { navigator.clipboard.writeText(inviteLink); }}>
                  Copy Link
                </button>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Email Address</label>
                  <input type="email" className="input" value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)} required autoFocus placeholder="colleague@company.com" />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Role</label>
                  <select className="input select" value={inviteRoleId}
                    onChange={e => setInviteRoleId(e.target.value)}>
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <button className="btn btn-primary w-full" type="submit" disabled={inviting || !inviteEmail.trim()}>
                  {inviting ? <span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} /> : <Mail size={16} />}
                  Send Invite
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Role Editor Modal */}
      {showRoleModal && (
        <div className="modal-overlay" onClick={() => setShowRoleModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h2 className="modal-title">{editingRole ? `Edit: ${editingRole.name}` : 'Create New Role'}</h2>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowRoleModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={saveRole} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Role Name</label>
                <input type="text" className="input" value={roleName}
                  onChange={e => setRoleName(e.target.value)} required
                  placeholder="e.g. Designer, QA Lead" />
              </div>
              <div>
                <label className="input-label" style={{ marginBottom: 'var(--space-2)' }}>Permissions</label>
                {Object.entries(permissionGroups).map(([group, perms]) => (
                  <div key={group} style={{ marginBottom: 'var(--space-3)' }}>
                    <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 'var(--space-1)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {group}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
                      {perms.map(perm => {
                        const checked = rolePermissions[perm.key];
                        return (
                          <button key={perm.key} type="button" onClick={() => togglePermission(perm.key)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '6px',
                              padding: '6px 10px', borderRadius: 'var(--radius-md)',
                              fontSize: 'var(--text-xs)', fontWeight: 500, cursor: 'pointer',
                              border: `1px solid ${checked ? 'var(--brand-400)' : 'var(--border-subtle)'}`,
                              background: checked ? 'rgba(99,102,241,0.1)' : 'transparent',
                              color: checked ? 'var(--brand-400)' : 'var(--text-secondary)',
                              transition: 'all 0.15s',
                            }}>
                            {checked && <Check size={12} />}
                            {perm.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button className="btn btn-primary" type="submit" disabled={savingRole || !roleName.trim()} style={{ flex: 1 }}>
                  {savingRole ? <span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} /> : <Check size={16} />}
                  {editingRole ? 'Save Changes' : 'Create Role'}
                </button>
                {editingRole && !editingRole.is_system && (
                  <button type="button" className="btn btn-danger" onClick={() => { deleteRole(editingRole.id); setShowRoleModal(false); }}>
                    <Trash2 size={16} /> Delete
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
