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

const PROFILE_FETCH_TIMEOUT = 5000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Register/fetch profile menggunakan RPC function
  const registerOrFetchProfile = useCallback(async (authUser: User): Promise<UserProfile | null> => {
    const email = authUser.email;
    if (!email) {
      console.error('[Auth] No email in user object');
      return null;
    }

    console.log('[Auth] Registering/fetching profile for:', email);

    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => {
        console.error('[Auth] Profile registration timeout');
        resolve(null);
      }, PROFILE_FETCH_TIMEOUT);
    });

    const registerPromise = (async () => {
      try {
        // Panggil RPC function untuk register/cek user
        const { data, error: rpcError } = await supabase.rpc('register_user_from_allowed_email', {
          user_email: email,
          user_id: authUser.id,
        });

        if (rpcError) {
          console.error('[Auth] RPC error:', rpcError);
          // Fallback: coba fetch profile langsung (untuk user yang sudah ada)
          const { data: profileData, error: profileError } = await supabase
            .from('user_profile')
            .select('*')
            .eq('id', authUser.id)
            .single();

          if (profileError || !profileData) {
            console.error('[Auth] Profile fetch error:', profileError);
            return null;
          }
          return profileData as UserProfile;
        }

        console.log('[Auth] RPC result:', data);

        if (!data.success) {
          console.error('[Auth] Registration failed:', data.error);
          // Sign out user yang tidak terdaftar
          await supabase.auth.signOut();
          throw new Error(data.error || 'Email tidak terdaftar');
        }

        return data.profile as UserProfile;
      } catch (err) {
        console.error('[Auth] Registration exception:', err);
        throw err;
      }
    })();

    try {
      const result = await Promise.race([registerPromise, timeoutPromise]);
      return result;
    } catch (err) {
      throw err;
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
          setError('Gagal memuat sesi.');
          setLoading(false);
          return;
        }

        console.log('[Auth] Session:', session ? 'exists' : 'none');

        if (!session?.user) {
          console.log('[Auth] No session, done loading');
          setLoading(false);
          return;
        }

        setUser(session.user);

        try {
          const profileData = await registerOrFetchProfile(session.user);

          if (!mounted) return;

          if (profileData) {
            setProfile(profileData);
            console.log('[Auth] Profile loaded:', profileData.nama);
          } else {
            setError('Profil tidak ditemukan. Hubungi admin.');
          }
        } catch (err) {
          if (!mounted) return;
          const errorMsg = err instanceof Error ? err.message : 'Gagal memuat profil';
          setError(errorMsg);
          setUser(null);
        }

        if (mounted) {
          setLoading(false);
        }

      } catch (err) {
        console.error('[Auth] Init exception:', err);
        if (mounted) {
          setError('Terjadi kesalahan. Coba refresh.');
          setLoading(false);
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[Auth] Event:', event);

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

          try {
            const profileData = await registerOrFetchProfile(session.user);

            if (mounted) {
              if (profileData) {
                setProfile(profileData);
              } else {
                setError('Email tidak terdaftar. Hubungi admin.');
                setUser(null);
              }
              setLoading(false);
            }
          } catch (err) {
            if (mounted) {
              const errorMsg = err instanceof Error ? err.message : 'Gagal memuat profil';
              setError(errorMsg);
              setUser(null);
              setLoading(false);
            }
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
  }, [registerOrFetchProfile]);

  const signIn = async () => {
    setError(null);
    setLoading(true);

    if (isDemoMode) {
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
