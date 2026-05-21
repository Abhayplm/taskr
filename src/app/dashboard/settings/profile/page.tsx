'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Save, User } from 'lucide-react';

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const supabase = createClient();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [jobTitle, setJobTitle] = useState(profile?.job_title || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);

    await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        job_title: jobTitle || null,
      })
      .eq('id', profile.id);

    await refreshProfile();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '600px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Profile</h1>
          <p className="page-subtitle">Manage your personal information</p>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <div className="card">
          <h2 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>
            <User size={18} style={{ display: 'inline', marginRight: 'var(--space-2)' }} />
            Personal Info
          </h2>

          <div className="input-group" style={{ marginBottom: 'var(--space-4)' }}>
            <label className="input-label">Full Name</label>
            <input
              type="text"
              className="input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label className="input-label">Job Title</label>
            <input
              type="text"
              className="input"
              placeholder="e.g., Content Manager"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? (
              <span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
            ) : (
              <Save size={16} />
            )}
            Save Changes
          </button>
          {saved && (
            <span className="text-success text-sm animate-fade-in">✓ Saved</span>
          )}
        </div>
      </form>
    </div>
  );
}
