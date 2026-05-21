import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { orgId, supabase } = auth;

  const { data, error } = await supabase
    .from('labels')
    .select('*')
    .eq('org_id', orgId)
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
