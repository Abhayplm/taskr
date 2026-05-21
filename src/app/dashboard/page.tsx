'use client';

import { useEffect, useState } from 'react';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import Link from 'next/link';
import {
  CheckSquare, Clock, AlertTriangle, Star,
  ArrowRight, Plus, TrendingUp, Target, Zap,
} from 'lucide-react';
import type { Task, ActivityLog } from '@/types';
import { TASK_STATUS_INFO, PRIORITY_INFO } from '@/types';

export default function DashboardPage() {
  const { currentOrg, hasPermission } = useOrg();
  const { user, profile } = useAuth();
  const supabase = createClient();
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [starredTasks, setStarredTasks] = useState<Task[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [stats, setStats] = useState({
    myOpen: 0, myCompleted: 0, totalTasks: 0, overdue: 0,
  });
  const [loading, setLoading] = useState(true);

  // Quick-add
  const [quickTitle, setQuickTitle] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!currentOrg || !user) return;
    fetchDashboard();
  }, [currentOrg, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchDashboard = async () => {
    if (!currentOrg || !user) return;
    setLoading(true);

    const now = new Date().toISOString();

    // All tasks via SECURITY DEFINER RPC — bypasses all RLS 403 errors
    const { data: allTaskData } = await supabase.rpc('get_org_tasks', { p_org_id: currentOrg.id });
    const allTasks = (allTaskData || []).map((t: any) => ({
      ...t,
      assignee: t.assignee_id ? { id: t.assignee_id, full_name: t.assignee_name, avatar_url: t.assignee_avatar } : null,
      project: t.project_name ? { id: t.project_id, name: t.project_name, color: t.project_color } : null,
    }));

    // My tasks (assigned to me, not done)
    const myTaskData = allTasks.filter((t: any) => t.assigned_to === user.id && t.status !== 'done');
    setMyTasks(myTaskData as Task[]);

    // Starred tasks (not done, limit 5)
    const starredData = allTasks.filter((t: any) => t.is_starred && t.status !== 'done').slice(0, 5);
    setStarredTasks(starredData as Task[]);

    // Stats from the same data (no extra queries needed)
    const myOpen = allTasks.filter((t: any) => t.assigned_to === user.id && t.status !== 'done').length;
    const myCompleted = allTasks.filter((t: any) => t.assigned_to === user.id && t.status === 'done').length;
    const totalTasks = allTasks.length;
    const overdue = allTasks.filter((t: any) =>
      t.due_date && t.due_date < now && t.status !== 'done' && t.status !== 'blocked'
    ).length;

    setStats({ myOpen, myCompleted, totalTasks, overdue });

    // Recent activity via SECURITY DEFINER RPC
    const { data: activityData } = await supabase.rpc('get_org_activity', {
      p_org_id: currentOrg.id,
      p_limit: 10,
    });
    setActivities((activityData || []).map((a: any) => ({
      ...a,
      user: a.user_id ? { id: a.user_id, full_name: a.user_name, avatar_url: a.user_avatar } : null,
    })) as ActivityLog[]);

    setLoading(false);
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim() || !currentOrg || !user) return;
    setAdding(true);

    await supabase.from('tasks').insert({
      org_id: currentOrg.id,
      title: quickTitle.trim(),
      created_by: user.id,
      assigned_to: user.id,
      status: 'todo',
      priority: 'medium',
      task_type: 'general',
    });

    setQuickTitle('');
    setAdding(false);
    fetchDashboard();
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const overdueTasks = myTasks.filter(t => t.due_date && new Date(t.due_date) < new Date());
  const dueTodayTasks = myTasks.filter(t => {
    if (!t.due_date) return false;
    const due = new Date(t.due_date);
    const today = new Date();
    return due.toDateString() === today.toDateString();
  });
  const upcomingTasks = myTasks.filter(t => {
    if (!t.due_date) return true;
    const due = new Date(t.due_date);
    const today = new Date();
    return due > today && due.toDateString() !== today.toDateString();
  });

  const formatAction = (action: string, metadata: Record<string, unknown> | null) => {
    switch (action) {
      case 'status_changed':
        return `changed status to ${(metadata?.new_status as string || '').replace('_', ' ')}`;
      case 'assignment_changed':
        return 'reassigned';
      case 'priority_changed':
        return `changed priority to ${metadata?.new_priority || ''}`;
      case 'task_created':
        return 'created task';
      case 'comment_added':
        return 'commented on';
      default:
        return action.replace(/_/g, ' ');
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {getGreeting()}, {profile?.full_name?.split(' ')[0] || 'there'} 👋
          </h1>
          <p className="page-subtitle">Here&apos;s what&apos;s on your plate today</p>
        </div>
      </div>

      {/* Quick Add */}
      {hasPermission('tasks.create') && (
        <form onSubmit={handleQuickAdd} style={{
          display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)',
        }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '500px' }}>
            <Plus size={16} style={{
              position: 'absolute', left: '12px', top: '50%',
              transform: 'translateY(-50%)', color: 'var(--text-muted)',
            }} />
            <input
              type="text" className="input" placeholder="Quick add a task..."
              value={quickTitle} onChange={(e) => setQuickTitle(e.target.value)}
              style={{ paddingLeft: '36px' }}
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={adding || !quickTitle.trim()}>
            {adding ? <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} /> : <Zap size={14} />}
            Add
          </button>
        </form>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4" style={{ marginBottom: 'var(--space-6)' }}>
        {[
          { label: 'My Open Tasks', value: stats.myOpen, icon: Target, color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
          { label: 'Completed', value: stats.myCompleted, icon: CheckSquare, color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
          { label: 'Overdue', value: stats.overdue, icon: AlertTriangle, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
          { label: 'Team Total', value: stats.totalTasks, icon: TrendingUp, color: '#06b6d4', bg: 'rgba(6,182,212,0.1)' },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="card animate-fade-in-up" style={{ animationDelay: `${i * 60}ms` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-1)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</p>
                  <p style={{ fontSize: 'var(--text-3xl)', fontWeight: 700 }}>
                    {loading ? '—' : stat.value}
                  </p>
                </div>
                <div style={{ width: '44px', height: '44px', borderRadius: 'var(--radius-lg)', background: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={20} color={stat.color} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 'var(--space-6)' }}>
        {/* Left: My Tasks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Starred Tasks */}
          {starredTasks.length > 0 && (
            <div className="card animate-fade-in-up" style={{ animationDelay: '200ms' }}>
              <h3 className="card-title" style={{ marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Star size={16} style={{ color: '#f59e0b' }} /> Starred
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                {starredTasks.map(task => (
                  <Link key={task.id} href={`/dashboard/tasks/${task.id}`} style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                    padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)',
                    textDecoration: 'none', color: 'inherit', transition: 'background 0.15s',
                  }} className="hover-bg-subtle">
                    <Star size={14} style={{ color: '#f59e0b', flexShrink: 0 }} fill="#f59e0b" />
                    <span style={{ flex: 1, fontSize: 'var(--text-sm)', fontWeight: 500 }}>{task.title}</span>
                    {task.due_date && (
                      <span style={{ fontSize: 'var(--text-xs)', color: new Date(task.due_date) < new Date() ? 'var(--error-400)' : 'var(--text-tertiary)' }}>
                        {formatDate(task.due_date)}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Overdue */}
          {overdueTasks.length > 0 && (
            <div className="card animate-fade-in-up" style={{ animationDelay: '300ms', borderLeft: '3px solid var(--error-400)' }}>
              <h3 className="card-title" style={{ marginBottom: 'var(--space-3)', color: 'var(--error-400)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <AlertTriangle size={16} /> Overdue ({overdueTasks.length})
              </h3>
              <TaskList tasks={overdueTasks} />
            </div>
          )}

          {/* Due Today */}
          {dueTodayTasks.length > 0 && (
            <div className="card animate-fade-in-up" style={{ animationDelay: '350ms', borderLeft: '3px solid var(--warning-400)' }}>
              <h3 className="card-title" style={{ marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Clock size={16} style={{ color: 'var(--warning-400)' }} /> Due Today ({dueTodayTasks.length})
              </h3>
              <TaskList tasks={dueTodayTasks} />
            </div>
          )}

          {/* Upcoming */}
          <div className="card animate-fade-in-up" style={{ animationDelay: '400ms' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
              <h3 className="card-title" style={{ margin: 0 }}>My Tasks ({upcomingTasks.length})</h3>
              <Link href="/dashboard/tasks" className="btn btn-ghost btn-sm">
                View All <ArrowRight size={14} />
              </Link>
            </div>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: '48px' }} />)}
              </div>
            ) : upcomingTasks.length === 0 && overdueTasks.length === 0 && dueTodayTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                <CheckSquare size={32} style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }} />
                <p className="text-secondary text-sm">No tasks assigned to you. You&apos;re all caught up! 🎉</p>
              </div>
            ) : (
              <TaskList tasks={upcomingTasks} />
            )}
          </div>
        </div>

        {/* Right: Activity Feed */}
        <div className="card animate-fade-in-up" style={{ animationDelay: '450ms', alignSelf: 'start' }}>
          <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Recent Activity</h3>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton" style={{ height: '40px' }} />)}
            </div>
          ) : activities.length === 0 ? (
            <p className="text-secondary text-sm">No recent activity</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {activities.map(activity => (
                <div key={activity.id} style={{
                  display: 'flex', gap: 'var(--space-3)', fontSize: 'var(--text-sm)',
                }}>
                  <div style={{
                    width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                    background: 'var(--brand-400)', marginTop: '6px',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ lineHeight: 1.5 }}>
                      <strong>{activity.user?.full_name || 'Someone'}</strong>{' '}
                      {formatAction(activity.action, activity.metadata)}{' '}
                      {(activity.metadata as Record<string, string>)?.task_title && (
                        <Link href={`/dashboard/tasks/${activity.entity_id}`}
                          style={{ color: 'var(--brand-400)', textDecoration: 'none' }}>
                          {(activity.metadata as Record<string, string>).task_title}
                        </Link>
                      )}
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
    </div>
  );
}

// Reusable task list component
function TaskList({ tasks }: { tasks: Task[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      {tasks.map(task => {
        const statusInfo = TASK_STATUS_INFO[task.status];
        const priorityInfo = PRIORITY_INFO[task.priority];
        return (
          <Link key={task.id} href={`/dashboard/tasks/${task.id}`} style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)',
            textDecoration: 'none', color: 'inherit', transition: 'background 0.15s',
          }} className="hover-bg-subtle">
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
              background: statusInfo.color,
            }} />
            <span style={{ flex: 1, fontSize: 'var(--text-sm)', fontWeight: 500 }}>{task.title}</span>
            <span style={{
              fontSize: '10px', color: priorityInfo.color, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {task.priority}
            </span>
            {task.due_date && (
              <span style={{
                fontSize: 'var(--text-xs)',
                color: new Date(task.due_date) < new Date() ? 'var(--error-400)' : 'var(--text-tertiary)',
              }}>
                {formatDate(task.due_date)}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
