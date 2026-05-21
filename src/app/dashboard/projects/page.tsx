'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { createClient } from '@/lib/supabase/client';
import { formatDate, randomColor } from '@/lib/utils';
import { Plus, FolderKanban, Calendar, X } from 'lucide-react';
import type { Project, ProjectStatus } from '@/types';

export default function ProjectsPage() {
  const { user } = useAuth();
  const { currentOrg } = useOrg();
  const supabase = createClient();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (currentOrg) fetchProjects();
  }, [currentOrg]);

  const fetchProjects = async () => {
    if (!currentOrg) return;
    setLoading(true);
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('org_id', currentOrg.id)
      .order('created_at', { ascending: false });
    setProjects(data || []);
    setLoading(false);
  };

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentOrg) return;
    setCreating(true);

    const { data, error } = await supabase
      .from('projects')
      .insert({
        org_id: currentOrg.id,
        name,
        description: description || null,
        color: randomColor(),
        status: 'active',
        start_date: startDate || null,
        end_date: endDate || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (!error && data) {
      setProjects(prev => [data, ...prev]);
      setShowCreate(false);
      setName('');
      setDescription('');
      setStartDate('');
      setEndDate('');
    }
    setCreating(false);
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">Organize content into campaigns and projects</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} />
          New Project
        </button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Create Project</h2>
              <button className="modal-close" onClick={() => setShowCreate(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={createProject}>
              <div className="input-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label className="input-label">Project Name *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., Q3 Product Launch"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="input-group" style={{ marginBottom: 'var(--space-4)' }}>
                <label className="input-label">Description</label>
                <textarea
                  className="input textarea"
                  placeholder="What is this project about?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div className="input-group">
                  <label className="input-label">Start Date</label>
                  <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="input-group">
                  <label className="input-label">End Date</label>
                  <input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating || !name.trim()}>
                  {creating ? <span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} /> : <Plus size={16} />}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Projects Grid */}
      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: '180px', borderRadius: 'var(--radius-xl)' }} />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="empty-state">
          <FolderKanban className="empty-state-icon" />
          <h3 className="empty-state-title">No projects yet</h3>
          <p className="empty-state-description">Create a project to organize your content into campaigns.</p>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} />
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {projects.map((project, i) => (
            <div
              key={project.id}
              className="card card-hover animate-fade-in-up"
              style={{
                animationDelay: `${i * 80}ms`,
                borderTop: `3px solid ${project.color}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
                <span className={`badge ${project.status === 'active' ? 'badge-success' : project.status === 'completed' ? 'badge-brand' : 'badge-default'}`}>
                  {project.status}
                </span>
              </div>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
                {project.name}
              </h3>
              {project.description && (
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)', lineHeight: '1.5' }}>
                  {project.description.substring(0, 100)}{project.description.length > 100 ? '...' : ''}
                </p>
              )}
              {(project.start_date || project.end_date) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                  <Calendar size={12} />
                  {project.start_date && formatDate(project.start_date, { month: 'short', day: 'numeric' })}
                  {project.start_date && project.end_date && ' → '}
                  {project.end_date && formatDate(project.end_date, { month: 'short', day: 'numeric' })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
