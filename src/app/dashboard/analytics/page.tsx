'use client';

import { useEffect, useState } from 'react';
import { useOrg } from '@/contexts/OrgContext';
import { createClient } from '@/lib/supabase/client';
import { getInitials } from '@/lib/utils';
import {
  BarChart3, CheckSquare, TrendingUp,
  Clock, Target, AlertTriangle, Hash, FolderKanban,
} from 'lucide-react';
import type { Task } from '@/types';
import { TASK_STATUS_INFO } from '@/types';

type DateRange = '7d' | '30d' | '90d' | 'all';
type BreakdownTab = 'members' | 'teams' | 'projects';

export default function AnalyticsPage() {
  const { currentOrg } = useOrg();
  const supabase = createClient();
  const [range, setRange] = useState<DateRange>('30d');
  const [loading, setLoading] = useState(true);
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [breakdownTab, setBreakdownTab] = useState<BreakdownTab>('members');

  useEffect(() => {
    if (currentOrg) fetchData();
  }, [currentOrg, range]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    if (!currentOrg) return;
    setLoading(true);

    // Use SECURITY DEFINER RPC — bypasses tasks RLS
    const { data: taskData, error } = await supabase.rpc('get_org_tasks', { p_org_id: currentOrg.id });
    if (error) console.error('[Analytics] get_org_tasks error:', error.message);

    let tasks = (taskData || []).map((t: any) => ({
      ...t,
      assignee: t.assignee_id ? { id: t.assignee_id, full_name: t.assignee_name } : null,
      project: t.project_name ? { id: t.project_id, name: t.project_name, color: t.project_color } : null,
    }));

    // Client-side date filter (RPC returns all, filter here)
    if (range !== 'all') {
      const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
      const from = new Date();
      from.setDate(from.getDate() - days);
      tasks = tasks.filter((t: any) => new Date(t.created_at) >= from);
    }

    setAllTasks(tasks);

    // Fetch teams for breakdown
    const { data: teamsData } = await supabase.rpc('get_org_teams', { p_org_id: currentOrg.id });
    setTeams(teamsData || []);

    setLoading(false);
  };

  // ── Computed stats ────────────────────────────────────────────────
  const total = allTasks.length;
  const completed = allTasks.filter(t => t.status === 'done').length;
  const overdue = allTasks.filter(t =>
    t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done'
  ).length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const completedTasks = allTasks.filter(t => t.status === 'done' && t.completed_at);
  const avgDays = completedTasks.length > 0
    ? Math.round(completedTasks.reduce((sum, t) => {
        const created = new Date(t.created_at).getTime();
        const done = new Date(t.completed_at!).getTime();
        return sum + (done - created) / (1000 * 60 * 60 * 24);
      }, 0) / completedTasks.length * 10) / 10
    : 0;

  // Tasks by status (donut legend)
  const byStatus = Object.entries(TASK_STATUS_INFO).map(([status, info]) => ({
    status, label: info.label, color: info.color,
    count: allTasks.filter(t => t.status === status).length,
  }));

  // Tasks by assignee
  const assigneeMap = new Map<string, { name: string; count: number; completed: number }>();
  allTasks.forEach(t => {
    const name = t.assignee?.full_name || 'Unassigned';
    const key = t.assigned_to || 'none';
    if (!assigneeMap.has(key)) assigneeMap.set(key, { name, count: 0, completed: 0 });
    const entry = assigneeMap.get(key)!;
    entry.count++;
    if (t.status === 'done') entry.completed++;
  });
  const byAssignee = Array.from(assigneeMap.values()).sort((a, b) => b.count - a.count);

  // Tasks by team (uses team_id on task)
  const byTeam: { name: string; icon: string; color: string; count: number; completed: number }[] = teams.map((team: any) => {
    const teamTasks = allTasks.filter(t => t.team_id === team.id);
    return {
      name: team.name, icon: team.icon, color: team.color,
      count: teamTasks.length,
      completed: teamTasks.filter(t => t.status === 'done').length,
    };
  }).filter(t => t.count > 0).sort((a, b) => b.count - a.count);

  // Unassigned to any team
  const noTeamCount = allTasks.filter(t => !t.team_id).length;
  if (noTeamCount > 0) byTeam.push({
    name: 'No Team', icon: '📋', color: '#64748b',
    count: noTeamCount,
    completed: allTasks.filter(t => !t.team_id && t.status === 'done').length,
  });

  // Project progress
  const projectMap = new Map<string, { name: string; color: string; total: number; done: number }>();
  allTasks.forEach(t => {
    const proj = t.project;
    if (!proj) return;
    if (!projectMap.has(proj.id)) projectMap.set(proj.id, { name: proj.name, color: proj.color || '#6366f1', total: 0, done: 0 });
    const entry = projectMap.get(proj.id)!;
    entry.total++;
    if (t.status === 'done') entry.done++;
  });
  const projects = Array.from(projectMap.values()).sort((a, b) => b.total - a.total);

  // Trend (created vs completed per day)
  const trendBuckets = new Map<string, { completed: number; created: number }>();
  allTasks.forEach(t => {
    const date = new Date(t.created_at);
    const key = range === '90d'
      ? `W${Math.ceil(date.getDate() / 7)} ${date.toLocaleDateString('en-US', { month: 'short' })}`
      : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (!trendBuckets.has(key)) trendBuckets.set(key, { completed: 0, created: 0 });
    trendBuckets.get(key)!.created++;
    if (t.status === 'done') trendBuckets.get(key)!.completed++;
  });
  const trendData = Array.from(trendBuckets.entries()).map(([label, data]) => ({ label, ...data }));
  const maxTrendCreated = Math.max(...trendData.map(d => d.created), 1);

  // Current breakdown list
  const activeBreakdown = breakdownTab === 'members' ? byAssignee
    : breakdownTab === 'teams' ? byTeam
    : projects.map(p => ({ name: p.name, count: p.total, completed: p.done, icon: '●', color: p.color }));
  const maxBreakdownCount = Math.max(...activeBreakdown.map(a => a.count), 1);

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Task metrics for {currentOrg?.name}</p>
        </div>
        <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '2px' }}>
          {(['7d', '30d', '90d', 'all'] as DateRange[]).map(r => (
            <button key={r} className={`btn btn-sm ${range === r ? 'btn-secondary' : 'btn-ghost'}`}
              onClick={() => setRange(r)}>
              {r === 'all' ? 'All Time' : r.replace('d', ' Days')}
            </button>
          ))}
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-4 gap-4" style={{ marginBottom: 'var(--space-6)' }}>
        {[
          { label: 'Total Tasks', value: total, icon: Target, color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
          { label: 'Completed', value: completed, icon: CheckSquare, color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
          { label: 'Overdue', value: overdue, icon: AlertTriangle, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
          { label: 'Avg. Completion', value: `${avgDays}d`, icon: Clock, color: '#06b6d4', bg: 'rgba(6,182,212,0.1)' },
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

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        {/* Completion Rate Donut */}
        <div className="card animate-fade-in-up" style={{ animationDelay: '250ms' }}>
          <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Completion Rate</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)' }}>
            <div style={{ position: 'relative', width: '120px', height: '120px', flexShrink: 0 }}>
              <svg viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border-subtle)" strokeWidth="10" />
                <circle cx="60" cy="60" r="50" fill="none" stroke="var(--brand-400)" strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={`${completionRate * 3.14} ${314 - completionRate * 3.14}`}
                  style={{ transition: 'stroke-dasharray 1s ease' }} />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-2xl)', fontWeight: 700 }}>
                {loading ? '—' : `${completionRate}%`}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {byStatus.map(s => (
                <div key={s.status} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: s.color }} />
                  <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{s.label}</span>
                  <strong>{s.count}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Task Trend */}
        <div className="card animate-fade-in-up" style={{ animationDelay: '350ms' }}>
          <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Task Trend</h3>
          {trendData.length === 0 ? (
            <p className="text-secondary text-sm">No data for this period</p>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '140px' }}>
              {trendData.slice(-20).map((d, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', height: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '9px', fontWeight: 600, color: 'var(--text-tertiary)' }}>{d.created}</span>
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    <div style={{ height: `${Math.max((d.completed / maxTrendCreated) * 110, 2)}px`, background: '#22c55e', borderRadius: '3px 3px 0 0', transition: 'height 0.5s' }} />
                    <div style={{ height: `${Math.max(((d.created - d.completed) / maxTrendCreated) * 110, 2)}px`, background: 'var(--brand-400)', borderRadius: '0 0 3px 3px', transition: 'height 0.5s' }} />
                  </div>
                  <span style={{ fontSize: '8px', color: 'var(--text-muted)', writingMode: 'vertical-rl', transform: 'rotate(180deg)', maxHeight: '40px', overflow: 'hidden' }}>
                    {d.label}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-3)', justifyContent: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#22c55e' }} /> Completed
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--brand-400)' }} /> Open
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>

        {/* Breakdown: Members / Teams / Projects */}
        <div className="card animate-fade-in-up" style={{ animationDelay: '450ms' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
            <h3 className="card-title">Task Breakdown</h3>
            {/* Tab switcher */}
            <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', padding: '2px' }}>
              {([
                { key: 'members', icon: '👤', label: 'Members' },
                { key: 'teams', icon: '👥', label: 'Teams' },
                { key: 'projects', icon: '📁', label: 'Projects' },
              ] as const).map(tab => (
                <button key={tab.key}
                  className={`btn btn-sm ${breakdownTab === tab.key ? 'btn-secondary' : 'btn-ghost'}`}
                  style={{ fontSize: '11px', padding: '3px 8px' }}
                  onClick={() => setBreakdownTab(tab.key)}>
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-8)' }}>
              <span className="spinner" />
            </div>
          ) : activeBreakdown.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: 'var(--text-sm)' }}>
                {breakdownTab === 'teams'
                  ? 'No teams yet — create teams and assign tasks to them'
                  : breakdownTab === 'projects'
                  ? 'No projects with tasks'
                  : 'No task data'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {activeBreakdown.slice(0, 8).map((a: any, i: number) => {
                const pct = (a.count / maxBreakdownCount) * 100;
                const completedPct = a.count > 0 ? (a.completed / a.count) * 100 : 0;
                const color = a.color || 'var(--brand-400)';
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        {breakdownTab === 'teams' ? (
                          <span style={{ fontSize: '16px' }}>{a.icon}</span>
                        ) : breakdownTab === 'projects' ? (
                          <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
                        ) : (
                          <div className="avatar avatar-xs" style={{ width: '22px', height: '22px', fontSize: '9px' }}>
                            {getInitials(a.name)}
                          </div>
                        )}
                        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{a.name}</span>
                      </div>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>
                        {a.count} tasks · {Math.round(completedPct)}% done
                      </span>
                    </div>
                    <div style={{ height: '6px', borderRadius: 'var(--radius-full)', background: 'var(--bg-glass)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${pct}%`, borderRadius: 'var(--radius-full)',
                        background: `linear-gradient(90deg, #22c55e ${completedPct}%, ${color} ${completedPct}%)`,
                        transition: 'width 1s ease',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Project Progress */}
        <div className="card animate-fade-in-up" style={{ animationDelay: '550ms' }}>
          <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Project Progress</h3>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-8)' }}>
              <span className="spinner" />
            </div>
          ) : projects.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)' }}>
              <FolderKanban size={32} style={{ margin: '0 auto var(--space-3)', opacity: 0.4 }} />
              <p style={{ fontSize: 'var(--text-sm)' }}>No projects with tasks yet</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {projects.slice(0, 6).map((p, i) => {
                const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: p.color }} />
                        <span style={{ fontWeight: 500 }}>{p.name}</span>
                      </div>
                      <span style={{ color: 'var(--text-tertiary)' }}>{p.done}/{p.total} ({pct}%)</span>
                    </div>
                    <div style={{ height: '8px', borderRadius: 'var(--radius-full)', background: 'var(--bg-glass)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${pct}%`, borderRadius: 'var(--radius-full)',
                        background: p.color, transition: 'width 1s ease',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
