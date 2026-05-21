'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { createClient } from '@/lib/supabase/client';
import { generateApiKey, hashApiKey, formatDate } from '@/lib/utils';
import Link from 'next/link';
import {
  Plus, X, Key, Copy, Trash2, Check, Eye, EyeOff,
  Code, AlertTriangle, Clock, Shield, BookOpen,
} from 'lucide-react';
import type { ApiKey } from '@/types';

export default function ApiKeysPage() {
  const { user } = useAuth();
  const { currentOrg, hasPermission } = useOrg();
  const supabase = createClient();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['read']);
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState('');
  const [copied, setCopied] = useState(false);

  const canManage = hasPermission('api_keys.manage');

  useEffect(() => {
    if (currentOrg) fetchKeys();
  }, [currentOrg]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchKeys = async () => {
    if (!currentOrg) return;
    setLoading(true);
    const { data } = await supabase
      .from('api_keys')
      .select('*')
      .eq('org_id', currentOrg.id)
      .order('created_at', { ascending: false });
    setKeys((data || []) as ApiKey[]);
    setLoading(false);
  };

  const createKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg || !user || !newKeyName.trim()) return;
    setCreating(true);

    const rawKey = generateApiKey();
    const keyHash = await hashApiKey(rawKey);
    const keyPrefix = rawKey.substring(0, 8);

    const { error } = await supabase.from('api_keys').insert({
      org_id: currentOrg.id,
      created_by: user.id,
      name: newKeyName.trim(),
      key_prefix: keyPrefix,
      key_hash: keyHash,
      scopes: newKeyScopes,
    });

    if (!error) {
      setCreatedKey(rawKey);
      fetchKeys();
    }
    setCreating(false);
  };

  const toggleActive = async (keyId: string, currentActive: boolean) => {
    await supabase.from('api_keys').update({ is_active: !currentActive }).eq('id', keyId);
    fetchKeys();
  };

  const deleteKey = async (keyId: string) => {
    if (!confirm('Delete this API key? This cannot be undone.')) return;
    await supabase.from('api_keys').delete().eq('id', keyId);
    fetchKeys();
  };

  const copyKey = () => {
    navigator.clipboard.writeText(createdKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const closeCreate = () => {
    setShowCreateModal(false);
    setCreatedKey('');
    setNewKeyName('');
    setNewKeyScopes(['read']);
  };

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="animate-fade-in" style={{ maxWidth: '800px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">API Keys</h1>
          <p className="page-subtitle">Manage API access to your workspace</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Link href="/dashboard/settings/api-keys/docs" className="btn btn-secondary">
            <BookOpen size={16} /> API Docs
          </Link>
          {canManage && (
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              <Plus size={16} /> Create API Key
            </button>
          )}
        </div>
      </div>

      {/* API Docs */}
      <div className="card" style={{ marginBottom: 'var(--space-6)', borderLeft: '3px solid var(--brand-400)' }}>
        <h3 className="card-title" style={{ marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Code size={16} /> Quick Reference
        </h3>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          <p>Authenticate by passing your API key in the <code style={{ background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>Authorization</code> header:</p>
          <div style={{
            background: 'var(--bg-tertiary)', padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)', fontFamily: 'monospace', fontSize: 'var(--text-xs)',
            marginTop: 'var(--space-2)', marginBottom: 'var(--space-3)', overflowX: 'auto',
          }}>
            <p style={{ color: 'var(--text-muted)' }}># List tasks</p>
            <p>curl {baseUrl}/api/v1/tasks \</p>
            <p>  -H &quot;Authorization: Bearer tf_your_key_here&quot;</p>
            <br />
            <p style={{ color: 'var(--text-muted)' }}># Create a task</p>
            <p>curl -X POST {baseUrl}/api/v1/tasks \</p>
            <p>  -H &quot;Authorization: Bearer tf_your_key_here&quot; \</p>
            <p>  -H &quot;Content-Type: application/json&quot; \</p>
            <p>  -d &#39;{'{'}&#34;title&#34;: &#34;New Task&#34;, &#34;priority&#34;: &#34;high&#34;{'}'}&#39;</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', fontSize: 'var(--text-xs)' }}>
            <div><strong>Endpoints:</strong></div><div />
            <div><code style={{ background: 'var(--bg-tertiary)', padding: '2px 4px', borderRadius: '3px' }}>GET /api/v1/tasks</code></div><div>List tasks</div>
            <div><code style={{ background: 'var(--bg-tertiary)', padding: '2px 4px', borderRadius: '3px' }}>POST /api/v1/tasks</code></div><div>Create task</div>
            <div><code style={{ background: 'var(--bg-tertiary)', padding: '2px 4px', borderRadius: '3px' }}>GET /api/v1/tasks/:id</code></div><div>Get task</div>
            <div><code style={{ background: 'var(--bg-tertiary)', padding: '2px 4px', borderRadius: '3px' }}>PUT /api/v1/tasks/:id</code></div><div>Update task</div>
            <div><code style={{ background: 'var(--bg-tertiary)', padding: '2px 4px', borderRadius: '3px' }}>DELETE /api/v1/tasks/:id</code></div><div>Delete task</div>
            <div><code style={{ background: 'var(--bg-tertiary)', padding: '2px 4px', borderRadius: '3px' }}>GET /api/v1/projects</code></div><div>List projects</div>
            <div><code style={{ background: 'var(--bg-tertiary)', padding: '2px 4px', borderRadius: '3px' }}>GET /api/v1/labels</code></div><div>List labels</div>
          </div>
        </div>
      </div>

      {/* Key List */}
      <div className="card">
        <h3 className="card-title" style={{ marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Key size={16} /> Active Keys ({keys.filter(k => k.is_active).length})
        </h3>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: '60px' }} />)}
          </div>
        ) : keys.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
            <Key size={32} style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }} />
            <p className="text-secondary text-sm">No API keys yet. Create one to get started.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {keys.map(key => (
              <div key={key.id} style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)', background: 'var(--bg-glass)',
                opacity: key.is_active ? 1 : 0.5,
              }}>
                <Key size={16} style={{ color: key.is_active ? 'var(--brand-400)' : 'var(--text-muted)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span style={{ fontWeight: 600 }}>{key.name}</span>
                    <code style={{
                      fontSize: 'var(--text-xs)', background: 'var(--bg-tertiary)',
                      padding: '2px 6px', borderRadius: '4px', color: 'var(--text-tertiary)',
                    }}>
                      {key.key_prefix}...
                    </code>
                    {!key.is_active && (
                      <span style={{ fontSize: '10px', color: 'var(--error-400)', fontWeight: 600 }}>REVOKED</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                    <span>Scopes: {key.scopes.join(', ')}</span>
                    <span>Created: {formatDate(key.created_at)}</span>
                    {key.last_used_at && <span>Last used: {formatDate(key.last_used_at)}</span>}
                  </div>
                </div>
                {canManage && (
                  <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => toggleActive(key.id, key.is_active)}
                      title={key.is_active ? 'Revoke' : 'Reactivate'}>
                      {key.is_active ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => deleteKey(key.id)} title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={closeCreate}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h2 className="modal-title">{createdKey ? 'API Key Created' : 'Create API Key'}</h2>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={closeCreate}><X size={16} /></button>
            </div>
            {createdKey ? (
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                  padding: 'var(--space-3)', background: 'rgba(239,68,68,0.1)',
                  borderRadius: 'var(--radius-md)', border: '1px solid rgba(239,68,68,0.2)',
                }}>
                  <AlertTriangle size={16} style={{ color: 'var(--error-400)', flexShrink: 0 }} />
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--error-400)' }}>
                    Copy this key now. You won&apos;t be able to see it again!
                  </p>
                </div>
                <div style={{
                  padding: 'var(--space-3)', background: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-md)', fontFamily: 'monospace',
                  fontSize: 'var(--text-xs)', wordBreak: 'break-all',
                }}>
                  {createdKey}
                </div>
                <button className="btn btn-primary w-full" onClick={copyKey}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copied!' : 'Copy API Key'}
                </button>
              </div>
            ) : (
              <form onSubmit={createKey} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Key Name</label>
                  <input type="text" className="input" value={newKeyName}
                    onChange={e => setNewKeyName(e.target.value)} required autoFocus
                    placeholder="e.g. Production, CI/CD, Zapier" />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Scopes</label>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    {['read', 'write'].map(scope => (
                      <button key={scope} type="button" className={`btn btn-sm ${newKeyScopes.includes(scope) ? 'btn-secondary' : 'btn-ghost'}`}
                        onClick={() => {
                          if (scope === 'read') return; // read always on
                          setNewKeyScopes(prev => prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]);
                        }}
                        style={{ textTransform: 'capitalize' }}>
                        {newKeyScopes.includes(scope) && <Check size={12} />} {scope}
                      </button>
                    ))}
                  </div>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                    read = GET only · write = all methods (POST, PUT, DELETE)
                  </p>
                </div>
                <button className="btn btn-primary w-full" type="submit" disabled={creating || !newKeyName.trim()}>
                  {creating ? <span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} /> : <Key size={16} />}
                  Generate Key
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
