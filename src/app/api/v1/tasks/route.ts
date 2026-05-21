import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { orgId, supabase } = auth;
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const assignee = url.searchParams.get('assigned_to');
  const projectId = url.searchParams.get('project_id');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  let query = supabase
    .from('tasks')
    .select('*, assignee:profiles!tasks_assigned_to_fkey(id, full_name), project:projects(id, name)', { count: 'exact' })
    .eq('org_id', orgId)
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (assignee) query = query.eq('assigned_to', assignee);
  if (projectId) query = query.eq('project_id', projectId);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, total: count, limit, offset });
}

export async function POST(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!auth.scopes.includes('write')) return NextResponse.json({ error: 'Write scope required' }, { status: 403 });

  const { orgId, supabase } = auth;
  const body = await request.json();

  const { title, description, status, task_type, priority, assigned_to, due_date, project_id } = body;
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      org_id: orgId,
      title,
      description: description || null,
      status: status || 'todo',
      task_type: task_type || 'general',
      priority: priority || 'medium',
      assigned_to: assigned_to || null,
      due_date: due_date || null,
      project_id: project_id || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
