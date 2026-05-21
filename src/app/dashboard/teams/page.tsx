'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { createClient } from '@/lib/supabase/client';
import { getInitials } from '@/lib/utils';
import {
  Users, Plus, X, Settings, Crown, UserPlus,
  Hash, Pencil, Trash2, ChevronRight,
} from 'lucide-react';

const TEAM_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
];

const TEAM_ICONS = ['👥', '💻', '🎨', '📊', '📣', '🔬', '⚙️', '🎯', '🚀', '💡'];

export default function TeamsPage() {
  const { user } = useAuth();
  const { currentOrg, members, hasPermission } = useOrg();
  const supabase = createClient();

  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<any | null>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);

  // Create form
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formColor, setFormColor] = useState(TEAM_COLORS[0]);
  const [formIcon, setFormIcon] = useState(TEAM_ICONS[0]);
  const [creating, setCreating] = useState(false);

  // Add member form
  const [addMemberUserId, setAddMemberUserId] = useState('');
  const [addMemberRole, setAddMemberRole] = useState<'member' | 'lead'>('member');

  const canManage = hasPermission('settings.edit');
  const activeOrgMembers = members.filter(m => m.status === 'active' && m.user_id);
  // Also fetch org members via RPC as fallback if OrgContext hasn't loaded yet
  const [orgMembersLocal, setOrgMembersLocal] = useState<any[]>([]);
  const resolvedOrgMembers = activeOrgMembers.length > 0 ? activeOrgMembers : orgMembersLocal;

  useEffect(() => {
    if (currentOrg) {
      fetchTeams();
      fetchOrgMembersLocal();
    }
  }, [currentOrg]); // eslint-disable-line

  useEffect(() => {
    if (selectedTeam) fetchTeamMembers(selectedTeam.id);
  }, [selectedTeam]); // eslint-disable-line

  const fetchOrgMembersLocal = async () => {
    if (!currentOrg) return;
    const { data } = await supabase.rpc('get_org_members', { p_org_id: currentOrg.id });
    setOrgMembersLocal((data || []).map((m: any) => ({
      user_id: m.user_id,
      status: m.status,
      profile: { full_name: m.profile_name, avatar_url: m.profile_avatar },
    })));
  };

  const fetchTeams = async () => {
    if (!currentOrg) return;
    setLoading(true);
    const { data, error } = await supabase.rpc('get_org_teams', { p_org_id: currentOrg.id });
    if (error) console.error('[Teams] get_org_teams error:', error.message);
    setTeams(data || []);
    setLoading(false);
  };

  const fetchTeamMembers = async (teamId: string) => {
    const { data } = await supabase.rpc('get_team_members', { p_team_id: teamId });
    setTeamMembers(data || []);
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg || !user || !formName.trim()) return;
    setCreating(true);

    const { data: newTeam, error } = await supabase
      .from('teams')
      .insert({
        org_id: currentOrg.id,
        name: formName.trim(),
        description: formDesc || null,
        color: formColor,
        icon: formIcon,
        created_by: user.id,
      })
      .select()
      .single();

    if (!error && newTeam) {
      // Auto-add creator as lead
      await supabase.from('team_members').insert({
        team_id: newTeam.id,
        user_id: user.id,
        role: 'lead',
      });
    }

    setFormName(''); setFormDesc(''); setFormColor(TEAM_COLORS[0]);
    setFormIcon(TEAM_ICONS[0]); setCreating(false); setShowCreateModal(false);
    fetchTeams();
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam || !addMemberUserId) return;

    await supabase.from('team_members').upsert({
      team_id: selectedTeam.id,
      user_id: addMemberUserId,
      role: addMemberRole,
    }, { onConflict: 'team_id,user_id' });

    setAddMemberUserId(''); setShowAddMember(false);
    fetchTeamMembers(selectedTeam.id);
    fetchTeams();
  };

  const handleRemoveMember = async (memberId: string) => {
    await supabase.from('team_members').delete().eq('id', memberId);
    fetchTeamMembers(selectedTeam.id);
    fetchTeams();
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm('Delete this team? Tasks will not be deleted.')) return;
    await supabase.from('teams').delete().eq('id', teamId);
    if (selectedTeam?.id === teamId) setSelectedTeam(null);
    fetchTeams();
  };

  // Members not yet in this team
  const nonTeamMembers = resolvedOrgMembers.filter(
    om => om.status === 'active' && !teamMembers.some(tm => tm.user_id === om.user_id)
  );

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Teams</h1>
          <p className="page-subtitle">
            {teams.length} team{teams.length !== 1 ? 's' : ''} in {currentOrg?.name}
          </p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} /> New Team
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
          <span className="spinner" />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 'var(--space-4)', alignItems: 'start' }}>

          {/* Team List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {teams.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                <Users size={32} style={{ color: 'var(--text-muted)', margin: '0 auto var(--space-3)' }} />
                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                  No teams yet
                </p>
                {canManage && (
                  <button className="btn btn-primary btn-sm" style={{ marginTop: 'var(--space-3)' }}
                    onClick={() => setShowCreateModal(true)}>
                    <Plus size={14} /> Create first team
                  </button>
                )}
              </div>
            ) : teams.map((team: any) => (
              <div
                key={team.id}
                className={`card card-hover`}
                onClick={() => setSelectedTeam(team)}
                style={{
                  cursor: 'pointer', padding: 'var(--space-3)',
                  border: selectedTeam?.id === team.id
                    ? `1px solid ${team.color}`
                    : '1px solid var(--border-default)',
                  background: selectedTeam?.id === team.id ? `${team.color}15` : undefined,
                  transition: 'all var(--transition-fast)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 'var(--radius-md)',
                      background: `${team.color}25`, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: '18px', flexShrink: 0,
                    }}>
                      {team.icon}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                        {team.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {team.member_count} member{team.member_count !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                </div>
                {team.description && (
                  <p style={{
                    fontSize: '11px', color: 'var(--text-secondary)', marginTop: 'var(--space-2)',
                    marginLeft: '44px',
                  }}>{team.description}</p>
                )}
              </div>
            ))}
          </div>

          {/* Team Detail */}
          {selectedTeam ? (
            <div className="card" style={{ padding: 'var(--space-5)' }}>
              {/* Team Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 'var(--radius-lg)',
                    background: `${selectedTeam.color}25`, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: '26px',
                    border: `2px solid ${selectedTeam.color}40`,
                  }}>
                    {selectedTeam.icon}
                  </div>
                  <div>
                    <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {selectedTeam.name}
                    </h2>
                    {selectedTeam.description && (
                      <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginTop: '2px' }}>
                        {selectedTeam.description}
                      </p>
                    )}
                  </div>
                </div>
                {canManage && (
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button className="btn btn-ghost btn-sm btn-icon"
                      onClick={() => handleDeleteTeam(selectedTeam.id)}
                      title="Delete team">
                      <Trash2 size={14} style={{ color: 'var(--error-400)' }} />
                    </button>
                  </div>
                )}
              </div>

              {/* Stats bar */}
              <div style={{
                display: 'flex', gap: 'var(--space-4)',
                padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
                background: 'var(--bg-glass)', marginBottom: 'var(--space-5)',
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: selectedTeam.color }}>
                    {teamMembers.length}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Members</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--brand-400)' }}>
                    {teamMembers.filter((m: any) => m.role === 'lead').length}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Leads</div>
                </div>
              </div>

              {/* Members */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Members
                </h3>
                {canManage && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowAddMember(v => !v)}>
                    <UserPlus size={14} /> Add Member
                  </button>
                )}
              </div>

              {/* Add member inline form */}
              {showAddMember && (
                <form onSubmit={handleAddMember} style={{
                  display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end',
                  padding: 'var(--space-3)', background: 'var(--bg-glass)',
                  borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-3)',
                }}>
                  <div className="input-group" style={{ marginBottom: 0, flex: 1 }}>
                    <label className="input-label">Member</label>
                    <select className="input select" value={addMemberUserId}
                      onChange={e => setAddMemberUserId(e.target.value)} required>
                      <option value="">Select member...</option>
                      {nonTeamMembers.length === 0 ? (
                        <option disabled>All org members are already in this team</option>
                      ) : nonTeamMembers.map((m: any) => (
                        <option key={m.user_id} value={m.user_id}>
                          {m.profile?.full_name || 'Unknown'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="input-group" style={{ marginBottom: 0, width: 120 }}>
                    <label className="input-label">Role</label>
                    <select className="input select" value={addMemberRole}
                      onChange={e => setAddMemberRole(e.target.value as any)}>
                      <option value="member">Member</option>
                      <option value="lead">Lead</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-1)', paddingBottom: '1px' }}>
                    <button type="submit" className="btn btn-primary btn-sm">Add</button>
                    <button type="button" className="btn btn-ghost btn-sm btn-icon"
                      onClick={() => setShowAddMember(false)}>
                      <X size={14} />
                    </button>
                  </div>
                </form>
              )}

              {teamMembers.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center', padding: 'var(--space-6)' }}>
                  No members yet. Add members to get started.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {teamMembers.map((m: any) => (
                    <div key={m.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: 'var(--space-2) var(--space-3)',
                      background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <div className="avatar avatar-sm">
                          {getInitials(m.member_name || '?')}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                            {m.member_name || 'Unknown'}
                          </div>
                          {m.member_job_title && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {m.member_job_title}
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span style={{
                          display: 'flex', alignItems: 'center', gap: '4px',
                          fontSize: '11px', fontWeight: 600, padding: '2px 8px',
                          borderRadius: '999px',
                          background: m.role === 'lead' ? `${selectedTeam.color}20` : 'var(--bg-elevated)',
                          color: m.role === 'lead' ? selectedTeam.color : 'var(--text-secondary)',
                        }}>
                          {m.role === 'lead' && <Crown size={10} />}
                          {m.role === 'lead' ? 'Lead' : 'Member'}
                        </span>
                        {canManage && m.user_id !== user?.id && (
                          <button className="btn btn-ghost btn-icon" style={{ width: 24, height: 24 }}
                            onClick={() => handleRemoveMember(m.id)}>
                            <X size={12} style={{ color: 'var(--text-muted)' }} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="card" style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: 'var(--space-12)',
              color: 'var(--text-muted)', textAlign: 'center',
            }}>
              <Users size={48} style={{ marginBottom: 'var(--space-3)', opacity: 0.4 }} />
              <p style={{ fontSize: 'var(--text-sm)' }}>Select a team to view members</p>
            </div>
          )}
        </div>
      )}

      {/* Create Team Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2 className="modal-title">New Team</h2>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowCreateModal(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateTeam} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Preview */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                padding: 'var(--space-3)', background: 'var(--bg-glass)',
                borderRadius: 'var(--radius-md)', border: `1px solid ${formColor}40`,
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 'var(--radius-md)',
                  background: `${formColor}25`, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '24px',
                }}>
                  {formIcon}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {formName || 'Team Name'}
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                    {formDesc || 'Description...'}
                  </div>
                </div>
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Team Name *</label>
                <input type="text" className="input" value={formName}
                  onChange={e => setFormName(e.target.value)} required autoFocus
                  placeholder="e.g. Developer Team, Sales Team..." />
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Description</label>
                <input type="text" className="input" value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                  placeholder="What does this team do?" />
              </div>

              {/* Icon picker */}
              <div>
                <label className="input-label">Icon</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', marginTop: 'var(--space-1)' }}>
                  {TEAM_ICONS.map(icon => (
                    <button key={icon} type="button" onClick={() => setFormIcon(icon)}
                      style={{
                        width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                        fontSize: '18px', cursor: 'pointer', border: 'none',
                        background: formIcon === icon ? `${formColor}30` : 'var(--bg-glass)',
                        outline: formIcon === icon ? `2px solid ${formColor}` : 'none',
                        transition: 'all 0.15s',
                      }}>
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color picker */}
              <div>
                <label className="input-label">Color</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
                  {TEAM_COLORS.map(color => (
                    <button key={color} type="button" onClick={() => setFormColor(color)}
                      style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: color, cursor: 'pointer', border: 'none',
                        outline: formColor === color ? `3px solid ${color}` : '3px solid transparent',
                        outlineOffset: '2px', transition: 'all 0.15s',
                      }} />
                  ))}
                </div>
              </div>

              <button className="btn btn-primary w-full" type="submit" disabled={creating || !formName.trim()}>
                {creating ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <Plus size={16} />}
                Create Team
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
