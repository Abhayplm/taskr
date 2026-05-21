import { createClient } from '@supabase/supabase-js';

// Admin client uses the service role key to bypass RLS.
// ONLY use this in API routes and server-side code, NEVER expose to the client.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
