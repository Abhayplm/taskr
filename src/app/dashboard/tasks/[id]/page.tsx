'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { createClient } from '@/lib/supabase/client';
import { formatDate, formatRelativeTime, getInitials } from '@/lib/utils';
import Link from 'next/link';
import {
  ArrowLeft, Save, Plus, X, Trash2, ExternalLink,
  CheckSquare, Palette, Eye, Code, FlaskConical, Star,
  Clock, MessageSquare, Paperclip, Activity,
  Image as ImageIcon, File,
} from 'lucide-react';
import type {
  Task, TaskStatus, TaskType, Priority, TaskComment,
  Deliverable, CommentAttachment, ActivityLog, Label,
} from '@/types';
import { TASK_STATUS_INFO, TASK_TYPE_INFO, PRIORITY_INFO } from '@/types';

const TYPE_ICONS: Record<string, any> = {
  general: CheckSquare, design: Palette, development: Code,
  testing: FlaskConical, review: Eye,
};

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { currentOrg, members, hasPermission } = useOrg();
  const supabase = createClient();

  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [taskLabels, setTaskLabels] = useState<Label[]>([]);
  const [allLabels, setAllLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'comments' | 'activity'>('comments');

  // Editable fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [taskType, setTaskType] = useState<TaskType>('general');
  const [priority, setPriority] = useState<Priority>('medium');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isStarred, setIsStarred] = useState(false);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);

  // Comment form
  const [newComment, setNewComment] = useState('');
  const [commentAttachments, setCommentAttachments] = useState<CommentAttachment[]>([]);
  const [posting, setPosting] = useState(false);

  // New deliverable form
  const [newDelivLabel, setNewDelivLabel] = useState('');
  const [newDelivUrl, setNewDelivUrl] = useState('');

  const canEditAll = hasPermission('tasks.edit_all');
  const canEditOwn = hasPermission('tasks.edit_own');
  const isAssignee = task?.assigned_to === user?.id;
  const isCreator = task?.created_by === user?.id;
  const canEdit = canEditAll || (canEditOwn && (isAssignee || isCreator));
  const canDelete = hasPermission('tasks.delete');

  useEffect(() => {
    if (currentOrg && id) fetchTask();
  }, [currentOrg, id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchTask = async () => {
    setLoading(true);

    // 1. Task with assignee, creator, project — SECURITY DEFINER RPC
    const { data: taskRows, error: taskErr } = await supabase.rpc('get_task_detail', { p_task_id: id });
    if (taskErr) console.error('[TaskDetail] get_task_detail error:', taskErr.message);

    if (taskRows && taskRows.length > 0) {
      const row = taskRows[0];
      const t: Task = {
        id: row.id, org_id: row.org_id, title: row.title,
        description: row.description, status: row.status as TaskStatus,
        priority: row.priority as Priority, task_type: row.task_type as TaskType,
        assigned_to: row.assigned_to, created_by: row.created_by,
        due_date: row.due_date, completed_at: row.completed_at,
        is_starred: row.is_starred, sort_order: row.sort_order,
        project_id: row.project_id, created_at: row.created_at, updated_at: row.updated_at,
        deliverables: row.deliverables || [],
        assignee: row.assignee_id ? {
          id: row.assignee_id, full_name: row.assignee_name,
          avatar_url: row.assignee_avatar, job_title: row.assignee_job_title,
        } : null,
        creator: row.creator_id ? {
          id: row.creator_id, full_name: row.creator_name, avatar_url: row.creator_avatar,
        } : null,
        project: row.project_name ? {
          id: row.project_id, name: row.project_name, color: row.project_color,
        } : null,
      } as any;

      setTask(t);
      setTitle(t.title); setDescription(t.description || '');
      setStatus(t.status); setTaskType(t.task_type);
      setPriority(t.priority); setAssignedTo(t.assigned_to || '');
      setDueDate(t.due_date ? new Date(t.due_date).toISOString().slice(0, 16) : '');
      setIsStarred(t.is_starred); setDeliverables(t.deliverables);

      // 2. Task labels
      const { data: labelData } = await supabase.rpc('get_task_labels', { p_task_id: id });
      setTaskLabels((labelData || []) as Label[]);

      // 3. All org labels (for picker)
      if (currentOrg) {
        const { data: allLabelData } = await supabase.rpc('get_org_labels', { p_org_id: currentOrg.id });
        setAllLabels((allLabelData || []) as Label[]);
      }
    }

    // 4. Comments
    const { data: commentData } = await supabase.rpc('get_task_comments', { p_task_id: id });
    setComments((commentData || []).map((c: any) => ({
      ...c,
      attachments: c.attachments || [],
      user: c.user_id ? { id: c.user_id, full_name: c.commenter_name, avatar_url: c.commenter_avatar } : null,
    })));

    // 5. Task activity
    const { data: activityData } = await supabase.rpc('get_task_activity', { p_task_id: id });
    setActivities((activityData || []).map((a: any) => ({
      ...a,
      user: a.user_id ? { id: a.user_id, full_name: a.actor_name, avatar_url: a.actor_avatar } : null,
    })) as ActivityLog[]);

    setLoading(false);
  };


  const handleSave = async () => {
    if (!task) return;
    setSaving(true);
    const updates: any = { status, is_starred: isStarred, deliverables };
    if (status === 'done') updates.completed_at = new Date().toISOString();
    else updates.completed_at = null;

    if (canEdit) {
      updates.title = title; updates.description = description || null;
      updates.task_type = taskType; updates.priority = priority;
      updates.assigned_to = assignedTo || null;
      updates.due_date = dueDate ? new Date(dueDate).toISOString() : null;
    }

    await supabase.from('tasks').update(updates).eq('id', task.id);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    fetchTask();
  };

  const toggleLabel = async (labelId: string) => {
    if (!task) return;
    const has = taskLabels.some(l => l.id === labelId);
    if (has) {
      await supabase.from('task_labels').delete().eq('task_id', task.id).eq('label_id', labelId);
      setTaskLabels(prev => prev.filter(l => l.id !== labelId));
    } else {
      await supabase.from('task_labels').insert({ task_id: task.id, label_id: labelId });
      const label = allLabels.find(l => l.id === labelId);
      if (label) setTaskLabels(prev => [...prev, label]);
    }
  };

  const addDeliverable = () => {
    if (!newDelivUrl.trim()) return;
    setDeliverables(prev => [...prev, { label: newDelivLabel.trim() || 'Link', url: newDelivUrl.trim() }]);
    setNewDelivLabel(''); setNewDelivUrl('');
  };

  const removeDeliverable = (index: number) => {
    setDeliverables(prev => prev.filter((_, i) => i !== index));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !currentOrg) return;
    for (const file of Array.from(files)) {
      const path = `${currentOrg.id}/comments/${Date.now()}_${file.name}`;
      const { data, error } = await supabase.storage.from('attachments').upload(path, file);
      if (!error && data) {
        const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(data.path);
        setCommentAttachments(prev => [...prev, { name: file.name, url: urlData.publicUrl, type: file.type, size: file.size }]);
      }
    }
    e.target.value = '';
  };

  const postComment = async () => {
    if (!user || !task || (!newComment.trim() && commentAttachments.length === 0)) return;
    setPosting(true);
    const { error } = await supabase.from('task_comments').insert({
      task_id: task.id, user_id: user.id,
      content: newComment.trim(), attachments: commentAttachments,
    });
    if (!error) {
      // Log activity
      await supabase.from('activity_log').insert({
        org_id: task.org_id, user_id: user.id,
        action: 'comment_added', entity_type: 'task', entity_id: task.id,
        metadata: { task_title: task.title },
      });
      setNewComment(''); setCommentAttachments([]); fetchTask();
    }
    setPosting(false);
  };

  const deleteTask = async () => {
    if (!task || !confirm('Are you sure you want to delete this task?')) return;
    await supabase.from('tasks').delete().eq('id', task.id);
    router.push('/dashboard/tasks');
  };

  const formatAction = (action: string, metadata: Record<string, unknown> | null) => {
    switch (action) {
      case 'status_changed': return `changed status from "${(metadata?.old_status as string || '').replace('_', ' ')}" to "${(metadata?.new_status as string || '').replace('_', ' ')}"`;
      case 'assignment_changed': return 'reassigned this task';
      case 'priority_changed': return `changed priority to ${metadata?.new_priority || ''}`;
      case 'task_created': return 'created this task';
      case 'comment_added': return 'added a comment';
      default: return action.replace(/_/g, ' ');
    }
  };

  if (loading) {
    return (
      <div className="animate-fade-in" style={{ maxWidth: '900px' }}>
        <div className="skeleton" style={{ height: '40px', width: '200px', marginBottom: 'var(--space-4)' }} />
        <div className="skeleton" style={{ height: '400px', borderRadius: 'var(--radius-xl)' }} />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="animate-fade-in" style={{ textAlign: 'center', padding: 'var(--space-16)' }}>
        <h2>Task not found</h2>
        <Link href="/dashboard/tasks" className="btn btn-secondary" style={{ marginTop: 'var(--space-4)' }}>
          Back to Tasks
        </Link>
      </div>
    );
  }

  const TypeIcon = TYPE_ICONS[task.task_type] || CheckSquare;
  const typeInfo = TASK_TYPE_INFO[task.task_type];
  const activeMembers = members.filter(m => m.status === 'active' && m.user_id);

  return (
    <div className="animate-fade-in" style={{ maxWidth: '900px' }}>
      <Link href="/dashboard/tasks" className="btn btn-ghost btn-sm" style={{ marginBottom: 'var(--space-3)' }}>
        <ArrowLeft size={16} /> Back to Tasks
      </Link>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 'var(--space-6)' }}>
        {/* Main */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Title */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                fontSize: 'var(--text-xs)', color: typeInfo?.color,
                background: `${typeInfo?.color}15`, padding: '4px 10px',
                borderRadius: 'var(--radius-full)', fontWeight: 600,
              }}>
                <TypeIcon size={12} /> {typeInfo?.label}
              </span>
              <button onClick={() => { setIsStarred(!isStarred); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                <Star size={16} style={{ color: isStarred ? '#f59e0b' : 'var(--text-muted)' }}
                  fill={isStarred ? '#f59e0b' : 'none'} />
              </button>
              {task.creator && (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
                  Created by {task.creator.full_name} · {formatDate(task.created_at)}
                </span>
              )}
            </div>
            {canEdit ? (
              <>
                <input type="text" className="input" value={title} onChange={e => setTitle(e.target.value)}
                  style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: 'var(--space-3)' }} />
                <textarea className="input textarea" value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Add a description..." rows={4} />
              </>
            ) : (
              <>
                <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: 'var(--space-3)' }}>{task.title}</h1>
                {task.description && <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{task.description}</p>}
              </>
            )}

            {/* Labels */}
            <div style={{ marginTop: 'var(--space-3)' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
                {taskLabels.map(label => (
                  <span key={label.id} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    padding: '2px 8px', borderRadius: 'var(--radius-full)',
                    fontSize: '11px', fontWeight: 600,
                    background: `${label.color}20`, color: label.color, border: `1px solid ${label.color}40`,
                  }}>
                    {label.name}
                    {canEdit && (
                      <button onClick={() => toggleLabel(label.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: label.color, padding: 0, lineHeight: 1 }}>
                        <X size={10} />
                      </button>
                    )}
                  </span>
                ))}
                {canEdit && allLabels.filter(l => !taskLabels.some(tl => tl.id === l.id)).length > 0 && (
                  <select className="input select" onChange={e => { if (e.target.value) toggleLabel(e.target.value); e.target.value = ''; }}
                    style={{ width: 'auto', height: '24px', fontSize: '11px', padding: '0 8px' }} defaultValue="">
                    <option value="">+ Label</option>
                    {allLabels.filter(l => !taskLabels.some(tl => tl.id === l.id)).map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* Deliverables */}
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <ExternalLink size={16} /> Deliverables ({deliverables.length})
            </h3>
            {deliverables.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                {deliverables.map((d, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                    padding: 'var(--space-2) var(--space-3)',
                    background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                  }}>
                    <ExternalLink size={14} style={{ color: 'var(--brand-400)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}>{d.label}</p>
                      <a href={d.url} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 'var(--text-xs)', color: 'var(--brand-400)', wordBreak: 'break-all' }}>{d.url}</a>
                    </div>
                    {canEdit && (
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => removeDeliverable(i)}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {canEdit && (
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
                <div className="input-group" style={{ flex: '0 0 120px', marginBottom: 0 }}>
                  <label className="input-label">Label</label>
                  <input type="text" className="input" placeholder="e.g. Figma"
                    value={newDelivLabel} onChange={e => setNewDelivLabel(e.target.value)}
                    style={{ fontSize: 'var(--text-sm)' }} />
                </div>
                <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label className="input-label">URL</label>
                  <input type="url" className="input" placeholder="https://..."
                    value={newDelivUrl} onChange={e => setNewDelivUrl(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addDeliverable(); }}
                    style={{ fontSize: 'var(--text-sm)' }} />
                </div>
                <button className="btn btn-secondary btn-sm" onClick={addDeliverable}
                  disabled={!newDelivUrl.trim()} style={{ flexShrink: 0, height: '38px' }}>
                  <Plus size={14} /> Add
                </button>
              </div>
            )}
          </div>

          {/* Comments / Activity tabs */}
          <div className="card">
            <div style={{ display: 'flex', gap: 'var(--space-1)', marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-2)' }}>
              <button className={`btn btn-sm ${activeTab === 'comments' ? 'btn-secondary' : 'btn-ghost'}`}
                onClick={() => setActiveTab('comments')}>
                <MessageSquare size={14} /> Comments ({comments.length})
              </button>
              <button className={`btn btn-sm ${activeTab === 'activity' ? 'btn-secondary' : 'btn-ghost'}`}
                onClick={() => setActiveTab('activity')}>
                <Activity size={14} /> Activity ({activities.length})
              </button>
            </div>

            {activeTab === 'comments' ? (
              <>
                {comments.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                    {comments.map(comment => (
                      <div key={comment.id} style={{
                        padding: 'var(--space-3)', background: 'var(--bg-glass)',
                        borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                          <div className="avatar avatar-xs">{getInitials(comment.user?.full_name)}</div>
                          <span style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}>{comment.user?.full_name || 'User'}</span>
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{formatRelativeTime(comment.created_at)}</span>
                        </div>
                        {comment.content && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{comment.content}</p>}
                        {comment.attachments?.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                            {comment.attachments.map((att, i) => (
                              <a key={i} href={att.url} target="_blank" rel="noopener noreferrer"
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 'var(--space-1)',
                                  padding: '4px 10px', background: 'var(--bg-tertiary)',
                                  borderRadius: 'var(--radius-md)', fontSize: 'var(--text-xs)',
                                  color: 'var(--brand-400)', textDecoration: 'none',
                                  border: '1px solid var(--border-subtle)',
                                }}>
                                {att.type?.startsWith('image/') ? <ImageIcon size={12} /> : <File size={12} />}
                                {att.name}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div>
                  <textarea className="input textarea" placeholder="Write a comment..."
                    value={newComment} onChange={e => setNewComment(e.target.value)} rows={3}
                    style={{ marginBottom: 'var(--space-2)' }} />
                  {commentAttachments.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                      {commentAttachments.map((att, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: 'var(--space-1)',
                          padding: '4px 8px', background: 'var(--bg-tertiary)',
                          borderRadius: 'var(--radius-md)', fontSize: 'var(--text-xs)',
                        }}>
                          <Paperclip size={10} /> {att.name}
                          <button onClick={() => setCommentAttachments(prev => prev.filter((_, idx) => idx !== i))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}>
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'space-between' }}>
                    <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
                      <Paperclip size={14} /> Attach
                      <input type="file" multiple onChange={handleFileUpload}
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.pptx,.txt,.csv"
                        style={{ display: 'none' }} />
                    </label>
                    <button className="btn btn-primary btn-sm" onClick={postComment}
                      disabled={posting || (!newComment.trim() && commentAttachments.length === 0)}>
                      {posting ? <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} /> : <MessageSquare size={14} />}
                      Post Comment
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {activities.length === 0 ? (
                  <p className="text-secondary text-sm">No activity yet</p>
                ) : activities.map(activity => (
                  <div key={activity.id} style={{ display: 'flex', gap: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                      background: 'var(--brand-400)', marginTop: '6px',
                    }} />
                    <div>
                      <p style={{ lineHeight: 1.5 }}>
                        <strong>{activity.user?.full_name || 'System'}</strong>{' '}
                        {formatAction(activity.action, activity.metadata)}
                      </p>
                      <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>
                        {formatRelativeTime(activity.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="card">
            <h4 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>Status</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              {Object.entries(TASK_STATUS_INFO).map(([key, info]) => (
                <button key={key}
                  className={`btn btn-sm ${status === key ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => canEdit && setStatus(key as TaskStatus)}
                  disabled={!canEdit}
                  style={{ justifyContent: 'flex-start' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: status === key ? 'white' : info.color }} />
                  {info.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <h4 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>Properties</h4>
            {canEdit ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Type</label>
                  <select className="input select" value={taskType} onChange={e => setTaskType(e.target.value as TaskType)}>
                    {Object.entries(TASK_TYPE_INFO).map(([key, info]) => (<option key={key} value={key}>{info.label}</option>))}
                  </select>
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Priority</label>
                  <select className="input select" value={priority} onChange={e => setPriority(e.target.value as Priority)}>
                    {Object.entries(PRIORITY_INFO).map(([key, info]) => (<option key={key} value={key}>{info.label}</option>))}
                  </select>
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Assigned To</label>
                  <select className="input select" value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
                    <option value="">Unassigned</option>
                    {activeMembers.map(m => (<option key={m.user_id} value={m.user_id!}>{m.profile?.full_name || 'Member'}</option>))}
                  </select>
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Due Date</label>
                  <input type="datetime-local" className="input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div><span className="input-label">Priority</span><p style={{ textTransform: 'capitalize', fontWeight: 500, color: PRIORITY_INFO[task.priority].color }}>{task.priority}</p></div>
                {task.assignee && (<div><span className="input-label">Assigned To</span><div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}><div className="avatar avatar-sm">{getInitials(task.assignee.full_name)}</div><span style={{ fontWeight: 500 }}>{task.assignee.full_name}</span></div></div>)}
                {task.due_date && (<div><span className="input-label">Due Date</span><p style={{ color: new Date(task.due_date) < new Date() ? 'var(--error-400)' : 'var(--text-primary)', fontWeight: 500 }}>{formatDate(task.due_date)}</p></div>)}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <button className="btn btn-primary w-full" onClick={handleSave} disabled={saving}>
              {saving ? <span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} /> : <Save size={16} />}
              Save Changes
            </button>
            {saved && <p className="text-success text-sm animate-fade-in" style={{ textAlign: 'center' }}>✓ Changes saved</p>}
            {canDelete && (
              <button className="btn btn-danger w-full" onClick={deleteTask}>
                <Trash2 size={16} /> Delete Task
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
