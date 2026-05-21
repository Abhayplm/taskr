import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { orgId, supabase } = auth;

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!auth.scopes.includes('write')) return NextResponse.json({ error: 'Write scope required' }, { status: 403 });

  const { orgId, supabase } = auth;
  const body = await request.json();

  const { name, description, color, status } = body;
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const { data, error } = await supabase
    .from('projects')
    .insert({
      org_id: orgId,
      name,
      description: description || null,
      color: color || '#6366f1',
      status: status || 'active',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
