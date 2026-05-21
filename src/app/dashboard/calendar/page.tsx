'use client';

import { useEffect, useState, useMemo } from 'react';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { getDaysInMonth, isSameDay, formatDate } from '@/lib/utils';
import Link from 'next/link';
import {
  ChevronLeft, ChevronRight, Plus, CheckSquare, Star,
} from 'lucide-react';
import type { Task, TaskStatus } from '@/types';
import { TASK_STATUS_INFO, TASK_TYPE_INFO } from '@/types';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const TASK_COLORS: Record<string, string> = {
  todo: '#64748b', in_progress: '#3b82f6', in_review: '#f59e0b',
  done: '#22c55e', blocked: '#ef4444',
};

export default function CalendarPage() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const supabase = createClient();
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewFilter, setViewFilter] = useState<'all' | 'my'>('all');

  useEffect(() => {
    if (currentOrg) fetchData();
  }, [currentOrg, currentMonth, currentYear]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    if (!currentOrg) return;
    setLoading(true);

    const startDate = new Date(currentYear, currentMonth, 1);
    const endDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);

    const { data: taskData } = await supabase
      .from('tasks')
      .select('*, assignee:profiles!tasks_assigned_to_fkey(*)')
      .eq('org_id', currentOrg.id)
      .not('due_date', 'is', null)
      .gte('due_date', startDate.toISOString())
      .lte('due_date', endDate.toISOString())
      .order('due_date', { ascending: true });

    setTasks((taskData || []) as Task[]);
    setLoading(false);
  };

  const days = useMemo(() => getDaysInMonth(currentYear, currentMonth), [currentYear, currentMonth]);

  const filteredTasks = viewFilter === 'my'
    ? tasks.filter(t => t.assigned_to === user?.id)
    : tasks;

  const getTasksForDay = (date: Date) =>
    filteredTasks.filter(t => t.due_date && isSameDay(new Date(t.due_date), date));

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  const goToday = () => {
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Calendar</h1>
          <p className="page-subtitle">Tasks by due date</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '2px' }}>
            {(['all', 'my'] as const).map(mode => (
              <button key={mode} className={`btn btn-sm ${viewFilter === mode ? 'btn-secondary' : 'btn-ghost'}`}
                onClick={() => setViewFilter(mode)} style={{ textTransform: 'capitalize' }}>
                {mode === 'my' ? 'My Tasks' : 'All Tasks'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar Nav */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 'var(--space-4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <button className="btn btn-ghost btn-icon" onClick={prevMonth}><ChevronLeft size={18} /></button>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, minWidth: '180px', textAlign: 'center' }}>
            {MONTHS[currentMonth]} {currentYear}
          </h2>
          <button className="btn btn-ghost btn-icon" onClick={nextMonth}><ChevronRight size={18} /></button>
          <button className="btn btn-ghost btn-sm" onClick={goToday}>Today</button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div style={{
        borderRadius: 'var(--radius-xl)', overflow: 'hidden',
        border: '1px solid var(--border-default)',
        background: 'var(--bg-secondary)',
      }}>
        {/* Day Headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border-subtle)' }}>
          {DAYS_OF_WEEK.map(day => (
            <div key={day} style={{
              padding: 'var(--space-2) var(--space-3)',
              fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)',
              textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {day}
            </div>
          ))}
        </div>

        {/* Day Cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {days.map((date, i) => {
            const isCurrentMonth = date.getMonth() === currentMonth;
            const isToday = isSameDay(date, today);
            const dayTasks = getTasksForDay(date);

            return (
              <div key={i} style={{
                minHeight: '110px', padding: 'var(--space-2)',
                borderRight: (i + 1) % 7 !== 0 ? '1px solid var(--border-subtle)' : 'none',
                borderBottom: i < days.length - 7 ? '1px solid var(--border-subtle)' : 'none',
                background: isToday ? 'rgba(99,102,241,0.06)' : isCurrentMonth ? 'transparent' : 'rgba(0,0,0,0.15)',
                opacity: isCurrentMonth ? 1 : 0.4,
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '28px', height: '28px', borderRadius: '50%',
                  fontSize: 'var(--text-sm)', fontWeight: isToday ? 700 : 500,
                  color: isToday ? 'white' : 'var(--text-primary)',
                  background: isToday ? 'var(--brand-400)' : 'transparent',
                  marginBottom: 'var(--space-1)',
                }}>
                  {date.getDate()}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {dayTasks.slice(0, 3).map(task => (
                    <Link key={task.id} href={`/dashboard/tasks/${task.id}`} style={{
                      display: 'flex', alignItems: 'center', gap: '4px',
                      padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                      fontSize: '10px', fontWeight: 500, textDecoration: 'none',
                      color: 'white', lineHeight: 1.3,
                      background: TASK_COLORS[task.status] || '#64748b',
                      overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                    }}>
                      {task.is_starred && <Star size={8} fill="currentColor" />}
                      {task.title}
                    </Link>
                  ))}
                  {dayTasks.length > 3 && (
                    <span style={{ fontSize: '9px', color: 'var(--text-tertiary)', paddingLeft: '6px' }}>
                      +{dayTasks.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
