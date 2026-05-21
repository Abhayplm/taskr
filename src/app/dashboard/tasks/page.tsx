'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { createClient } from '@/lib/supabase/client';
import { formatDate, getInitials } from '@/lib/utils';
import Link from 'next/link';
import {
  Plus, Search, X, CheckSquare, AlertTriangle,
  Clock, Palette, Eye, Filter, Star, Code, FlaskConical,
} from 'lucide-react';
import type { Task, TaskStatus, TaskType, Priority, Label } from '@/types';
import { TASK_STATUS_INFO, TASK_TYPE_INFO, PRIORITY_INFO } from '@/types';

const TASK_COLUMNS: { status: TaskStatus; color: string }[] = [
  { status: 'todo', color: '#64748b' },
  { status: 'in_progress', color: '#3b82f6' },
  { status: 'in_review', color: '#f59e0b' },
  { status: 'done', color: '#22c55e' },
  { status: 'blocked', color: '#ef4444' },
];

const TYPE_ICONS: Record<string, any> = {
  general: CheckSquare,
  design: Palette,
  development: Code,
  testing: FlaskConical,
  review: Eye,
};

export default function TasksPage() {
  const { user } = useAuth();
  const { currentOrg, members, hasPermission } = useOrg();
  const supabase = createClient();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [search, setSearch] = useState('');
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'all' | 'my' | 'starred'>('all');
  const [filterType, setFilterType] = useState<TaskType | ''>('');
  const [filterPriority, setFilterPriority] = useState<Priority | ''>('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterTeam, setFilterTeam] = useState('');
  const [filterProject, setFilterProject] = useState('');

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formType, setFormType] = useState<TaskType>('general');
  const [formPriority, setFormPriority] = useState<Priority>('medium');
  const [formAssignee, setFormAssignee] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formStatus, setFormStatus] = useState<TaskStatus>('todo');
  const [formProject, setFormProject] = useState('');
  const [formTeam, setFormTeam] = useState('');
  const [creating, setCreating] = useState(false);

  const canCreate = hasPermission('tasks.create');
  const canEditAll = hasPermission('tasks.edit_all');

  useEffect(() => {
    if (currentOrg) {
      fetchTasks();
      fetchLabels();
      fetchProjects();
      fetchTeams();
    }
  }, [currentOrg]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchTasks = async () => {
    if (!currentOrg) return;
    setLoading(true);

    // Use SECURITY DEFINER RPC — bypasses tasks RLS (was returning 403)
    const { data, error } = await supabase.rpc('get_org_tasks', { p_org_id: currentOrg.id });

    if (error) {
      console.error('[Tasks] get_org_tasks error:', error.message);
    }

    // Map flat RPC result → Task shape (with nested assignee + project)
    const tasks = (data || []).map((t: any) => ({
      ...t,
      status: t.status,
      priority: t.priority,
      task_type: t.task_type,
      assignee: t.assignee_id ? {
        id: t.assignee_id,
        full_name: t.assignee_name,
        avatar_url: t.assignee_avatar,
        job_title: t.assignee_job_title,
      } : null,
      project: t.project_name ? {
        id: t.project_id,
        name: t.project_name,
        color: t.project_color,
      } : null,
    }));

    setTasks(tasks as Task[]);
    setLoading(false);
  };


  const fetchLabels = async () => {
    if (!currentOrg) return;
    // Use SECURITY DEFINER RPC — bypasses labels RLS
    const { data } = await supabase.rpc('get_org_labels', { p_org_id: currentOrg.id });
    setLabels((data || []) as Label[]);
  };

  const fetchProjects = async () => {
    if (!currentOrg) return;
    const { data } = await supabase.rpc('get_org_projects', { p_org_id: currentOrg.id });
    setProjects(data || []);
  };

  const fetchTeams = async () => {
    if (!currentOrg) return;
    const { data } = await supabase.rpc('get_org_teams', { p_org_id: currentOrg.id });
    setTeams(data || []);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg || !user || !formTitle.trim()) return;
    setCreating(true);

    await supabase.from('tasks').insert({
      org_id: currentOrg.id,
      title: formTitle.trim(),
      description: formDescription || null,
      task_type: formType,
      priority: formPriority,
      assigned_to: formAssignee || null,
      due_date: formDueDate ? new Date(formDueDate).toISOString() : null,
      status: formStatus,
      created_by: user.id,
      project_id: formProject || null,
      team_id: formTeam || null,
    });

    // Log activity
    await supabase.from('activity_log').insert({
      org_id: currentOrg.id,
      user_id: user.id,
      action: 'task_created',
      entity_type: 'task',
      metadata: { task_title: formTitle.trim() },
    });

    setFormTitle(''); setFormDescription(''); setFormType('general');
    setFormPriority('medium'); setFormAssignee(''); setFormDueDate('');
    setFormStatus('todo'); setFormProject(''); setFormTeam(''); setShowCreateModal(false); setCreating(false);
    fetchTasks();
  };

  const handleDragStart = (taskId: string) => setDraggedTask(taskId);

  const handleDrop = async (status: TaskStatus) => {
    if (!draggedTask) return;
    const task = tasks.find(t => t.id === draggedTask);
    if (!task || task.status === status) { setDraggedTask(null); return; }

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === draggedTask ? { ...t, status } : t));
    setDraggedTask(null);

    const updates: any = { status };
    if (status === 'done') updates.completed_at = new Date().toISOString();
    else updates.completed_at = null;

    await supabase.from('tasks').update(updates).eq('id', task.id);
  };

  const toggleStar = async (taskId: string, currentStarred: boolean) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_starred: !currentStarred } : t));
    await supabase.from('tasks').update({ is_starred: !currentStarred }).eq('id', taskId);
  };

  // Filters
  const filtered = tasks.filter(task => {
    if (search && !task.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (viewMode === 'my' && task.assigned_to !== user?.id) return false;
    if (viewMode === 'starred' && !task.is_starred) return false;
    if (filterType && task.task_type !== filterType) return false;
    if (filterPriority && task.priority !== filterPriority) return false;
    if (filterAssignee && task.assigned_to !== filterAssignee) return false;
    if (filterTeam && (task as any).team_id !== filterTeam) return false;
    if (filterProject && task.project_id !== filterProject) return false;
    return true;
  });

  const activeMembers = members.filter(m => m.status === 'active' && m.user_id);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Tasks</h1>
          <p className="page-subtitle">{filtered.length} tasks</p>
        </div>
        {canCreate && (
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} /> New Task
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
        marginBottom: 'var(--space-4)', flexWrap: 'wrap',
      }}>
        <div style={{ position: 'relative', flex: '0 1 260px' }}>
          <Search size={16} style={{
            position: 'absolute', left: '12px', top: '50%',
            transform: 'translateY(-50%)', color: 'var(--text-muted)',
          }} />
          <input type="text" className="input" placeholder="Search tasks..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '36px' }} />
        </div>

        <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '2px' }}>
          {(['all', 'my', 'starred'] as const).map(mode => (
            <button key={mode} className={`btn btn-sm ${viewMode === mode ? 'btn-secondary' : 'btn-ghost'}`}
              onClick={() => setViewMode(mode)} style={{ textTransform: 'capitalize' }}>
              {mode === 'starred' && <Star size={12} />}
              {mode}
            </button>
          ))}
        </div>

        <select className="input select" value={filterType}
          onChange={(e) => setFilterType(e.target.value as TaskType | '')}
          style={{ width: '130px' }}>
          <option value="">All Types</option>
          {Object.entries(TASK_TYPE_INFO).map(([key, info]) => (
            <option key={key} value={key}>{info.label}</option>
          ))}
        </select>

        <select className="input select" value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value as Priority | '')}
          style={{ width: '130px' }}>
          <option value="">All Priority</option>
          {Object.entries(PRIORITY_INFO).map(([key, info]) => (
            <option key={key} value={key}>{info.label}</option>
          ))}
        </select>

        <select className="input select" value={filterAssignee}
          onChange={(e) => setFilterAssignee(e.target.value)}
          style={{ width: '140px' }}>
          <option value="">All Members</option>
          {activeMembers.map(m => (
            <option key={m.user_id} value={m.user_id!}>
              {m.profile?.full_name || 'Member'}
            </option>
          ))}
        </select>

        {projects.length > 0 && (
          <select className="input select" value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            style={{ width: '140px' }}>
            <option value="">All Projects</option>
            {projects.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}

        {teams.length > 0 && (
          <select className="input select" value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
            style={{ width: '140px' }}>
            <option value="">All Teams</option>
            {teams.map((t: any) => (
              <option key={t.id} value={t.id}>{t.icon} {t.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Kanban Board */}
      {loading ? (
        <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ flex: 1 }}>
              <div className="skeleton" style={{ height: '40px', marginBottom: 'var(--space-3)' }} />
              <div className="skeleton" style={{ height: '200px' }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="kanban-board">
          {TASK_COLUMNS.map(col => {
            const colTasks = filtered.filter(t => t.status === col.status);
            return (
              <div key={col.status} className="kanban-column"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(col.status)}>
                <div className="kanban-column-header">
                  <div className="kanban-column-title">
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: col.color }} />
                    {TASK_STATUS_INFO[col.status].label}
                    <span className="kanban-column-count">{colTasks.length}</span>
                  </div>
                </div>
                <div className="kanban-column-body">
                  {colTasks.map((task) => {
                    const typeInfo = TASK_TYPE_INFO[task.task_type];
                    const TypeIcon = TYPE_ICONS[task.task_type] || CheckSquare;
                    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';
                    return (
                      <div key={task.id} className="kanban-card" draggable
                        onDragStart={() => handleDragStart(task.id)}
                        style={{ cursor: 'grab' }}>
                        <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                          <Link href={`/dashboard/tasks/${task.id}`} className="kanban-card-title"
                            style={{ textDecoration: 'none', color: 'inherit', flex: 1 }}>
                            {task.title}
                          </Link>
                          <button onClick={(e) => { e.stopPropagation(); toggleStar(task.id, task.is_starred); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', flexShrink: 0 }}>
                            <Star size={14} style={{ color: task.is_starred ? '#f59e0b' : 'var(--text-muted)' }}
                              fill={task.is_starred ? '#f59e0b' : 'none'} />
                          </button>
                        </div>
                        <div className="kanban-card-meta" style={{ marginTop: 'var(--space-2)' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '3px',
                            fontSize: '10px', color: typeInfo.color, fontWeight: 600,
                          }}>
                            <TypeIcon size={10} /> {typeInfo.label}
                          </span>
                          <span style={{
                            fontSize: '10px', color: PRIORITY_INFO[task.priority].color,
                            fontWeight: 600, textTransform: 'uppercase',
                          }}>
                            {task.priority}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--space-2)' }}>
                          {task.due_date ? (
                            <span style={{
                              fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px',
                              color: isOverdue ? 'var(--error-400)' : 'var(--text-tertiary)',
                            }}>
                              <Clock size={10} /> {formatDate(task.due_date)}
                            </span>
                          ) : <span />}
                          {task.assignee && (
                            <div className="avatar avatar-xs" style={{ fontSize: '9px', width: '22px', height: '22px' }}>
                              {getInitials(task.assignee.full_name)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h2 className="modal-title">New Task</h2>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowCreateModal(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Title *</label>
                <input type="text" className="input" value={formTitle}
                  onChange={e => setFormTitle(e.target.value)} required autoFocus />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Description</label>
                <textarea className="input textarea" value={formDescription}
                  onChange={e => setFormDescription(e.target.value)} rows={3} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Type</label>
                  <select className="input select" value={formType}
                    onChange={e => setFormType(e.target.value as TaskType)}>
                    {Object.entries(TASK_TYPE_INFO).map(([key, info]) => (
                      <option key={key} value={key}>{info.label}</option>
                    ))}
                  </select>
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Priority</label>
                  <select className="input select" value={formPriority}
                    onChange={e => setFormPriority(e.target.value as Priority)}>
                    {Object.entries(PRIORITY_INFO).map(([key, info]) => (
                      <option key={key} value={key}>{info.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Assign To</label>
                  <select className="input select" value={formAssignee}
                    onChange={e => setFormAssignee(e.target.value)}>
                    <option value="">Unassigned</option>
                    {activeMembers.map(m => (
                      <option key={m.user_id} value={m.user_id!}>
                        {m.profile?.full_name || 'Member'}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Status</label>
                  <select className="input select" value={formStatus}
                    onChange={e => setFormStatus(e.target.value as TaskStatus)}>
                    {Object.entries(TASK_STATUS_INFO).map(([key, info]) => (
                      <option key={key} value={key}>{info.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Due Date</label>
                <input type="datetime-local" className="input" value={formDueDate}
                  onChange={e => setFormDueDate(e.target.value)} />
              </div>
              {projects.length > 0 && (
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Project (optional)</label>
                  <select className="input select" value={formProject}
                    onChange={e => setFormProject(e.target.value)}>
                    <option value="">No project</option>
                    {projects.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.color ? `● ${p.name}` : p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {teams.length > 0 && (
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Team (optional)</label>
                  <select className="input select" value={formTeam}
                    onChange={e => setFormTeam(e.target.value)}>
                    <option value="">No team</option>
                    {teams.map((t: any) => (
                      <option key={t.id} value={t.id}>
                        {t.icon} {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <button className="btn btn-primary w-full" type="submit" disabled={creating || !formTitle.trim()}>
                {creating ? (
                  <span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                ) : (
                  <Plus size={16} />
                )}
                Create Task
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
