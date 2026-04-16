import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, isDemoMode } from '../lib/supabase';
import type { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  isDemoMode: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cek email di allowed_emails dan buat/ambil profile
  const checkAndCreateProfile = useCallback(async (authUser: User): Promise<UserProfile | null> => {
    const email = authUser.email?.toLowerCase();
    if (!email) {
      console.error('[Auth] No email in user object');
      return null;
    }

    console.log('[Auth] Checking allowed email:', email);

    try {
      // 1. Cek apakah email ada di allowed_emails
      const { data: allowedData, error: allowedError } = await supabase
        .from('allowed_emails')
        .select('*')
        .eq('email', email)
        .single();

      if (allowedError || !allowedData) {
        console.error('[Auth] Email not in allowed list:', allowedError);
        return null;
      }

      console.log('[Auth] Email allowed:', allowedData.nama, allowedData.role);

      // 2. Cek apakah profile sudah ada
      const { data: existingProfile } = await supabase
        .from('user_profile')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (existingProfile) {
        console.log('[Auth] Existing profile found');
        return existingProfile as UserProfile;
      }

      // 3. Buat profile baru
      console.log('[Auth] Creating new profile...');
      const { data: newProfile, error: insertError } = await supabase
        .from('user_profile')
        .insert({
          id: authUser.id,
          nama: allowedData.nama,
          role: allowedData.role,
          lapak_id: allowedData.lapak_id,
        })
        .select()
        .single();

      if (insertError) {
        console.error('[Auth] Profile insert error:', insertError);
        return null;
      }

      // 4. Update registered_at di allowed_emails
      await supabase
        .from('allowed_emails')
        .update({ registered_at: new Date().toISOString() })
        .eq('email', email);

      console.log('[Auth] Profile created:', newProfile);
      return newProfile as UserProfile;

    } catch (err) {
      console.error('[Auth] checkAndCreateProfile error:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    if (isDemoMode) {
      console.log('[Auth] Demo mode - skipping auth');
      setLoading(false);
      return;
    }

    let mounted = true;

    const initializeAuth = async () => {
      console.log('[Auth] Initializing...');

      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (!mounted) return;

        if (sessionError) {
          console.error('[Auth] Session error:', sessionError);
          setLoading(false);
          return;
        }

        console.log('[Auth] Session:', session ? `exists (${session.user.email})` : 'none');

        if (!session?.user) {
          setLoading(false);
          return;
        }

        setUser(session.user);

        // Cek dan buat profile
        const profileData = await checkAndCreateProfile(session.user);

        if (!mounted) return;

        if (profileData) {
          setProfile(profileData);
          setError(null);
          console.log('[Auth] Ready - user:', profileData.nama);
        } else {
          setError('Email tidak terdaftar. Hubungi admin untuk mendapatkan akses.');
          console.log('[Auth] Email not allowed');
        }

        setLoading(false);

      } catch (err) {
        console.error('[Auth] Init error:', err);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[Auth] Event:', event, session?.user?.email);

        if (!mounted) return;

        if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          setError(null);
          setLoading(false);
          return;
        }

        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          setLoading(true);
          setError(null);

          const profileData = await checkAndCreateProfile(session.user);

          if (mounted) {
            if (profileData) {
              setProfile(profileData);
            } else {
              setError('Email tidak terdaftar. Hubungi admin untuk mendapatkan akses.');
            }
            setLoading(false);
          }
        }

        if (event === 'TOKEN_REFRESHED' && session?.user) {
          setUser(session.user);
        }
      }
    );

    initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [checkAndCreateProfile]);

  const signIn = async () => {
    setError(null);
    setLoading(true);

    if (isDemoMode) {
      setError('Demo mode: Setup Supabase untuk mengaktifkan login.');
      setLoading(false);
      return;
    }

    try {
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/order`,
        },
      });
      if (signInError) throw signInError;
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const signOut = async () => {
    if (isDemoMode) {
      setUser(null);
      setProfile(null);
      return;
    }
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) throw signOutError;
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, error, signIn, signOut, isDemoMode }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
