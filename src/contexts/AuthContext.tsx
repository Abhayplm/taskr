'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { acceptPendingInvites } from '@/lib/accept-invites';
import type { Profile } from '@/types';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const initialized = useRef(false);

  const fetchProfile = async (userId: string) => {
    // Use SECURITY DEFINER RPC — bypasses profiles RLS entirely
    const { data } = await supabase.rpc('get_my_profile');
    if (data && data.length > 0) setProfile(data[0] as Profile);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // ─── STEP 1: Read session from localStorage immediately (zero network) ───
    // getSession() is synchronous from cache — resolves auth state instantly.
    // This fixes the "stuck loading on tab switch / refresh" bug.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        // Fire profile fetch and invite acceptance in parallel — don't block loading
        fetchProfile(currentUser.id);
        if (currentUser.email) {
          acceptPendingInvites(supabase, currentUser.id, currentUser.email);
        }
      }
      // Unblock the UI immediately — profile loads in the background
      setLoading(false);
    });

    // ─── STEP 2: Listen for subsequent auth changes ──────────────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const currentUser = session?.user ?? null;

        if (event === 'SIGNED_IN' && currentUser) {
          setUser(currentUser);
          setLoading(false);
          fetchProfile(currentUser.id);
          if (currentUser.email) {
            acceptPendingInvites(supabase, currentUser.id, currentUser.email);
          }
          return;
        }

        if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        if (event === 'TOKEN_REFRESHED' && currentUser) {
          // Just update user object — no profile re-fetch needed
          setUser(currentUser);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
