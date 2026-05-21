import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Check for any pending invites matching the user's email and auto-accept them.
 * Uses SECURITY DEFINER RPCs — bypasses all RLS on org_members.
 */
export async function acceptPendingInvites(
  supabase: SupabaseClient,
  userId: string,
  userEmail: string
) {
  // Use SECURITY DEFINER RPC — bypasses org_members RLS
  const { data: pendingInvites } = await supabase.rpc('get_my_pending_invites');

  if (!pendingInvites || pendingInvites.length === 0) return;

  for (const invite of pendingInvites) {
    await supabase.rpc('accept_invite', { p_invite_id: invite.id });
  }
}
