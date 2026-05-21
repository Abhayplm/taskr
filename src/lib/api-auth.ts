import { createClient } from '@supabase/supabase-js';
import { hashApiKey } from '@/lib/utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function authenticateApiKey(request: Request) {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return { error: 'Missing or invalid Authorization header', status: 401 };
  }

  const rawKey = auth.substring(7);
  const keyHash = await hashApiKey(rawKey);
  const keyPrefix = rawKey.substring(0, 8);

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: apiKey, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('key_prefix', keyPrefix)
    .eq('key_hash', keyHash)
    .eq('is_active', true)
    .single();

  if (error || !apiKey) {
    return { error: 'Invalid API key', status: 401 };
  }

  // Check expiry
  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
    return { error: 'API key expired', status: 401 };
  }

  // Update last_used_at
  await supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', apiKey.id);

  return {
    orgId: apiKey.org_id as string,
    scopes: apiKey.scopes as string[],
    supabase,
  };
}
