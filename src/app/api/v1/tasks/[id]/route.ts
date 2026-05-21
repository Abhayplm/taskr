import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiKey(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const { orgId, supabase } = auth;

  const { data, error } = await supabase
    .from('tasks')
    .select('*, assignee:profiles!tasks_assigned_to_fkey(id, full_name), project:projects(id, name)')
    .eq('id', id)
    .eq('org_id', orgId)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiKey(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!auth.scopes.includes('write')) return NextResponse.json({ error: 'Write scope required' }, { status: 403 });

  const { id } = await params;
  const { orgId, supabase } = auth;
  const body = await request.json();

  const updates: Record<string, unknown> = {};
  const allowed = ['title', 'description', 'status', 'task_type', 'priority', 'assigned_to', 'due_date', 'project_id', 'is_starred'];
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }
  if (updates.status === 'done') updates.completed_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .eq('org_id', orgId)
    .select()
    .single();

  if (error || !data) return NextResponse.json({ error: 'Task not found or update failed' }, { status: 404 });
  return NextResponse.json({ data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiKey(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!auth.scopes.includes('write')) return NextResponse.json({ error: 'Write scope required' }, { status: 403 });

  const { id } = await params;
  const { orgId, supabase } = auth;

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
