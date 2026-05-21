'use client';

import { useState } from 'react';
import { useOrg } from '@/contexts/OrgContext';
import { createClient } from '@/lib/supabase/client';
import { Save, Building2, Globe, Briefcase } from 'lucide-react';

export default function SettingsPage() {
  const { currentOrg, refreshOrgs } = useOrg();
  const supabase = createClient();
  const [name, setName] = useState(currentOrg?.name || '');
  const [industry, setIndustry] = useState(currentOrg?.industry || '');
  const [website, setWebsite] = useState(currentOrg?.website || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg) return;
    setSaving(true);

    await supabase
      .from('organizations')
      .update({
        name,
        industry: industry || null,
        website: website || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', currentOrg.id);

    await refreshOrgs();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '700px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Organization Settings</h1>
          <p className="page-subtitle">Manage your organization details</p>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <h2 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>
            <Building2 size={18} style={{ display: 'inline', marginRight: 'var(--space-2)' }} />
            General
          </h2>

          <div className="input-group" style={{ marginBottom: 'var(--space-4)' }}>
            <label className="input-label">Organization Name</label>
            <input
              type="text"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="input-group" style={{ marginBottom: 'var(--space-4)' }}>
            <label className="input-label">Industry</label>
            <select
              className="input select"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
            >
              <option value="">Select industry</option>
              <option value="technology">Technology</option>
              <option value="marketing">Marketing & Advertising</option>
              <option value="ecommerce">E-Commerce</option>
              <option value="saas">SaaS</option>
              <option value="media">Media & Entertainment</option>
              <option value="healthcare">Healthcare</option>
              <option value="education">Education</option>
              <option value="finance">Finance</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="input-group">
            <label className="input-label">Website</label>
            <input
              type="url"
              className="input"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? (
              <span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
            ) : (
              <Save size={16} />
            )}
            Save Changes
          </button>
          {saved && (
            <span className="text-success text-sm animate-fade-in">✓ Saved successfully</span>
          )}
        </div>
      </form>
    </div>
  );
}
