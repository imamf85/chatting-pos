import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, isDemoMode } from '../lib/supabase';
import { getProfileAfterLogin } from '../lib/auth';
import type { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isDemoMode: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isDemoMode) {
      setLoading(false);
      return;
    }

    let mounted = true;
    let profileFetched = false; // Flag untuk hindari double fetch

    // Helper function untuk fetch profile
    const fetchProfile = async (userId: string) => {
      if (profileFetched) return; // Sudah di-fetch, skip
      profileFetched = true;

      try {
        const profileData = await getProfileAfterLogin(userId);
        if (mounted) {
          setProfile(profileData || null);
          if (!profileData) {
            setError('Profil tidak ditemukan. Hubungi admin.');
          }
        }
      } catch (err) {
        console.error('Profile fetch error:', err);
        if (mounted) {
          setError('Gagal memuat profil. Coba refresh.');
          setProfile(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    // 1. Setup listener untuk perubahan auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        console.log('Auth event:', event);

        setUser(session?.user ?? null);

        if (event === 'SIGNED_OUT') {
          setProfile(null);
          setError(null);
          setLoading(false);
          profileFetched = false; // Reset flag
          return;
        }

        // Untuk event SIGNED_IN atau TOKEN_REFRESHED, fetch profile
        if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
          profileFetched = false; // Reset untuk allow re-fetch
          await fetchProfile(session.user.id);
        }
      }
    );

    // 2. Get initial session - LANGSUNG fetch profile jika ada session
    const initialize = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Get session error:', sessionError);
          if (mounted) {
            setError('Gagal memuat sesi.');
            setLoading(false);
          }
          return;
        }

        if (session?.user) {
          // Ada session valid - langsung set user dan fetch profile
          if (mounted) {
            setUser(session.user);
            await fetchProfile(session.user.id);
          }
        } else {
          // Tidak ada session - selesai loading
          if (mounted) {
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Init error:', err);
        if (mounted) {
          setError('Terjadi kesalahan inisialisasi.');
          setLoading(false);
        }
      }
    };

    initialize();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // signIn dan signOut tetap sama, tapi pastikan setLoading(false) selalu dipanggil
  const signIn = async (email: string, password: string) => {
    setError(null);
    setLoading(true);

    if (isDemoMode) {
      // ... demo logic
      setLoading(false);
      return;
    }

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      // JANGAN setLoading(false) di sini → biarkan onAuthStateChange yang handle
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const signOut = async () => {
    if (isDemoMode) {
      setUser(null); setProfile(null); return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
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