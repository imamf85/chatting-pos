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

    // 1. Setup listener dulu (tanpa async di dalamnya sebisa mungkin)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        console.log('Auth event:', event);

        setUser(session?.user ?? null);

        if (event === 'SIGNED_OUT') {
          setProfile(null);
          setError(null);
          setLoading(false);
          return;
        }

        if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
          try {
            // Hindari deadlock: gunakan setTimeout kecil supaya tidak block
            const profileData = await getProfileAfterLogin(session.user.id);
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
        } else if (mounted) {
          setLoading(false);
        }
      }
    );

    // 2. Get initial session (tanpa terlalu banyak fallback)
    const initialize = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Get session error:', error);
          if (mounted) setError('Gagal memuat sesi.');
        }

        if (!session && mounted) {
          setLoading(false);
        }
        // Jika ada session, onAuthStateChange seharusnya sudah handle INITIAL_SESSION
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
  }, []);   // ← dependency kosong adalah yang benar di sini

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