'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Code, BookOpen, Terminal, Check, Copy } from 'lucide-react';

export default function ApiDocsPage() {
  const [activeTab, setActiveTab] = useState<'js' | 'python'>('js');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin);
    }
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const jsSnippets = {
    listTasks: `// Fetch a list of tasks with optional filters
const apiKey = 'tf_your_api_key_here';
const baseUrl = '${baseUrl || 'http://localhost:3000'}';

async function getTasks() {
  const url = new URL('/api/v1/tasks', baseUrl);
  url.searchParams.append('status', 'todo');      // Filter by status (todo, in_progress, review, done)
  url.searchParams.append('limit', '10');          // Page size (default: 50)
  url.searchParams.append('offset', '0');          // Offset for pagination

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': \`Bearer \${apiKey}\`,
      'Content-Type': 'application/json'
    }
  });

  const result = await response.json();
  if (response.ok) {
    console.log('Tasks:', result.data);
    console.log('Total Tasks:', result.total);
  } else {
    console.error('Error:', result.error);
  }
}

getTasks();`,
    createTask: `// Create a new task inside your organization
const apiKey = 'tf_your_api_key_here';
const baseUrl = '${baseUrl || 'http://localhost:3000'}';

async function createTask() {
  const response = await fetch(\`\${baseUrl}/api/v1/tasks\`, {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${apiKey}\`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: 'Complete System Migration',
      description: 'Migrate active database clusters to the primary cloud server.',
      status: 'in_progress',       // optional (default: todo)
      priority: 'high',            // optional: low, medium, high (default: medium)
      task_type: 'feature',        // optional: general, bug, feature (default: general)
      due_date: '2026-06-30'       // optional
    })
  });

  const result = await response.json();
  if (response.ok) {
    console.log('Created Task:', result.data);
  } else {
    console.error('Error:', result.error);
  }
}

createTask();`
  };

  const pythonSnippets = {
    listTasks: `import requests

api_key = "tf_your_api_key_here"
base_url = "${baseUrl || 'http://localhost:3000'}"

# Define request headers & optional query parameters
headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}

params = {
    "status": "todo",      # Filter by status (todo, in_progress, review, done)
    "limit": 10,           # Number of items (default: 50)
    "offset": 0            # Offset for pagination
}

response = requests.get(f"{base_url}/api/v1/tasks", headers=headers, params=params)

if response.status_code == 200:
    result = response.json()
    print("Tasks:", result["data"])
    print("Total count:", result["total"])
else:
    print("Error:", response.json().get("error"))`,
    createTask: `import requests

api_key = "tf_your_api_key_here"
base_url = "${baseUrl || 'http://localhost:3000'}"

headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}

payload = {
    "title": "Complete System Migration",
    "description": "Migrate active database clusters to the primary cloud server.",
    "status": "in_progress",       # optional (default: todo)
    "priority": "high",            # optional: low, medium, high (default: medium)
    "task_type": "feature",        # optional: general, bug, feature (default: general)
    "due_date": "2026-06-30"       # optional
}

response = requests.post(f"{base_url}/api/v1/tasks", headers=headers, json=payload)

if response.status_code == 201:
    result = response.json()
    print("Created Task:", result["data"])
else:
    print("Error:", response.json().get("error"))`
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '900px', paddingBottom: 'var(--space-12)' }}>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <Link href="/dashboard/settings/api-keys" style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          color: 'var(--text-tertiary)', textDecoration: 'none', fontSize: 'var(--text-sm)',
          marginBottom: 'var(--space-3)', transition: 'color 0.2s'
        }} className="hover:text-primary">
          <ArrowLeft size={16} /> Back to API Keys
        </Link>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <BookOpen size={24} style={{ color: 'var(--brand-400)' }} /> API Reference Docs
        </h1>
        <p className="page-subtitle">Fully detailed developer reference and SDK integration manuals for REST API v1.</p>
      </div>

      {/* Overview Card */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Terminal size={18} style={{ color: 'var(--brand-400)' }} /> Authentication
        </h3>
        <p style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          All TaskFlow API requests require an active API key. Authentication is handled using the 
          <code style={{ background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px', margin: '0 4px', fontSize: 'var(--text-xs)' }}>Authorization</code> 
          header passed as a bearer token.
        </p>
        <div style={{
          background: 'var(--bg-tertiary)', padding: 'var(--space-3)',
          borderRadius: 'var(--radius-md)', fontFamily: 'monospace', fontSize: 'var(--text-xs)',
          marginTop: 'var(--space-3)', color: 'var(--text-secondary)', position: 'relative'
        }}>
          <span style={{ color: 'var(--text-muted)' }}># Send the header as follows</span><br />
          Authorization: Bearer tf_your_api_key_here
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-2)' }}>
        <button className={`btn btn-sm ${activeTab === 'js' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('js')}>
          <Code size={14} /> JavaScript / Node.js
        </button>
        <button className={`btn btn-sm ${activeTab === 'python' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('python')}>
          <Code size={14} /> Python (Requests)
        </button>
      </div>

      {/* Snippet Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>

        {/* 1. LIST TASKS */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            <div>
              <span className="badge-info" style={{ textTransform: 'uppercase', padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>GET</span>
              <h3 className="card-title" style={{ display: 'inline-block', marginLeft: 'var(--space-2)' }}>/api/v1/tasks</h3>
              <p className="text-secondary text-sm" style={{ marginTop: '4px' }}>List tasks inside your active organization with optional query parameters.</p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => handleCopy(activeTab === 'js' ? jsSnippets.listTasks : pythonSnippets.listTasks, 'list')} style={{ border: '1px solid var(--border-subtle)' }}>
              {copiedText === 'list' ? <Check size={14} /> : <Copy size={14} />} {copiedText === 'list' ? 'Copied' : 'Copy'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-4)' }}>
            <div><strong>Query Parameters</strong></div><div><strong>Description</strong></div>
            <div><code className="text-sm">status</code></div><div>Filter by task status: <code className="text-xs">todo</code>, <code className="text-xs">in_progress</code>, <code className="text-xs">review</code>, or <code className="text-xs">done</code>.</div>
            <div><code className="text-sm">assigned_to</code></div><div>Filter by assignee’s UUID.</div>
            <div><code className="text-sm">project_id</code></div><div>Filter by project ID.</div>
            <div><code className="text-sm">limit</code></div><div>Max number of items to return. Default is <code className="text-xs">50</code>.</div>
            <div><code className="text-sm">offset</code></div><div>Number of tasks to skip (for pagination). Default is <code className="text-xs">0</code>.</div>
          </div>

          <div style={{
            background: 'var(--bg-tertiary)', padding: 'var(--space-4)',
            borderRadius: 'var(--radius-lg)', fontFamily: 'monospace', fontSize: 'var(--text-xs)',
            overflowX: 'auto', maxHeight: '420px', border: '1px solid var(--border-subtle)',
            lineHeight: 1.5
          }}>
            <pre style={{ margin: 0 }}>{activeTab === 'js' ? jsSnippets.listTasks : pythonSnippets.listTasks}</pre>
          </div>
        </div>

        {/* 2. CREATE TASK */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            <div>
              <span style={{ textTransform: 'uppercase', padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>POST</span>
              <h3 className="card-title" style={{ display: 'inline-block', marginLeft: 'var(--space-2)' }}>/api/v1/tasks</h3>
              <p className="text-secondary text-sm" style={{ marginTop: '4px' }}>Create a new task. Requires a <code className="text-xs">write</code> scope API key.</p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => handleCopy(activeTab === 'js' ? jsSnippets.createTask : pythonSnippets.createTask, 'create')} style={{ border: '1px solid var(--border-subtle)' }}>
              {copiedText === 'create' ? <Check size={14} /> : <Copy size={14} />} {copiedText === 'create' ? 'Copied' : 'Copy'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-4)' }}>
            <div><strong>Request Body Fields</strong></div><div><strong>Description</strong></div>
            <div><code className="text-sm">title</code> <span style={{ color: 'var(--error-400)', fontSize: '10px' }}>(Required)</span></div><div>The task summary / headline.</div>
            <div><code className="text-sm">description</code></div><div>Detailed text markdown.</div>
            <div><code className="text-sm">status</code></div><div>Status: <code className="text-xs">todo</code>, <code className="text-xs">in_progress</code>, <code className="text-xs">review</code>, <code className="text-xs">done</code> (default: <code className="text-xs">todo</code>).</div>
            <div><code className="text-sm">priority</code></div><div>Priority: <code className="text-xs">low</code>, <code className="text-xs">medium</code>, <code className="text-xs">high</code> (default: <code className="text-xs">medium</code>).</div>
            <div><code className="text-sm">task_type</code></div><div>Type: <code className="text-xs">general</code>, <code className="text-xs">bug</code>, <code className="text-xs">feature</code> (default: <code className="text-xs">general</code>).</div>
            <div><code className="text-sm">due_date</code></div><div>ISO date string (e.g. <code className="text-xs">"2026-06-30"</code>).</div>
            <div><code className="text-sm">project_id</code></div><div>Optional project UUID to link the task.</div>
          </div>

          <div style={{
            background: 'var(--bg-tertiary)', padding: 'var(--space-4)',
            borderRadius: 'var(--radius-lg)', fontFamily: 'monospace', fontSize: 'var(--text-xs)',
            overflowX: 'auto', maxHeight: '420px', border: '1px solid var(--border-subtle)',
            lineHeight: 1.5
          }}>
            <pre style={{ margin: 0 }}>{activeTab === 'js' ? jsSnippets.createTask : pythonSnippets.createTask}</pre>
          </div>
        </div>

        {/* 3. OTHER ENDPOINTS SUMMARY */}
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>Additional Resource Endpoints</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-2)' }}>
              <span className="badge-info" style={{ width: '48px', textAlign: 'center', fontSize: '10px', fontWeight: 700 }}>GET</span>
              <code style={{ fontSize: 'var(--text-xs)', flex: 1 }}>/api/v1/tasks/:id</code>
              <span style={{ color: 'var(--text-tertiary)' }}>Fetch detailed task payload.</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-2)' }}>
              <span style={{ width: '48px', textAlign: 'center', fontSize: '10px', fontWeight: 700, background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>PUT</span>
              <code style={{ fontSize: 'var(--text-xs)', flex: 1 }}>/api/v1/tasks/:id</code>
              <span style={{ color: 'var(--text-tertiary)' }}>Update details, priority, or status (requires <code className="text-xs">write</code> scope).</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-2)' }}>
              <span style={{ width: '48px', textAlign: 'center', fontSize: '10px', fontWeight: 700, background: 'rgba(239,68,68,0.15)', color: 'var(--error-400)' }}>DELETE</span>
              <code style={{ fontSize: 'var(--text-xs)', flex: 1 }}>/api/v1/tasks/:id</code>
              <span style={{ color: 'var(--text-tertiary)' }}>Delete task from workspace (requires <code className="text-xs">write</code> scope).</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-2)' }}>
              <span className="badge-info" style={{ width: '48px', textAlign: 'center', fontSize: '10px', fontWeight: 700 }}>GET</span>
              <code style={{ fontSize: 'var(--text-xs)', flex: 1 }}>/api/v1/projects</code>
              <span style={{ color: 'var(--text-tertiary)' }}>List all projects in the active organization.</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <span className="badge-info" style={{ width: '48px', textAlign: 'center', fontSize: '10px', fontWeight: 700 }}>GET</span>
              <code style={{ fontSize: 'var(--text-xs)', flex: 1 }}>/api/v1/labels</code>
              <span style={{ color: 'var(--text-tertiary)' }}>List all task labels configured in your workspace.</span>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
