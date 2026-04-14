import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import type { User, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase, isDemoMode } from '../lib/supabase';
import { getProfileAfterLogin } from '../lib/auth';
import type { UserProfile } from '../types';

// Demo user untuk testing tanpa Supabase
const DEMO_USER: User = {
  id: 'demo-user-id',
  email: 'demo@albewok.com',
  aud: 'authenticated',
  role: 'authenticated',
  created_at: new Date().toISOString(),
  app_metadata: {},
  user_metadata: {},
};

const DEMO_PROFILES: Record<string, UserProfile> = {
  owner: {
    id: 'demo-user-id',
    nama: 'Demo Owner',
    role: 'owner',
    lapak_id: null,
  },
  karyawan: {
    id: 'demo-user-id',
    nama: 'Demo Karyawan',
    role: 'karyawan',
    lapak_id: '11111111-1111-1111-1111-111111111111',
  },
};

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

    // Handle auth state changes - this is the main auth handler
    const handleAuthChange = async (event: AuthChangeEvent, userId: string | null) => {
      if (!mounted) return;

      console.log('Auth event:', event, 'User:', userId ? 'present' : 'null');

      if (!userId) {
        setUser(null);
        setProfile(null);
        setError(null);
        setLoading(false);
        return;
      }

      // Fetch profile for authenticated user
      try {
        // Small delay to ensure Supabase auth is fully ready
        await new Promise(resolve => setTimeout(resolve, 100));

        const profileData = await getProfileAfterLogin(userId);

        if (!mounted) return;

        if (profileData) {
          setProfile(profileData);
          setError(null);
        } else {
          console.error('Profile not found for user:', userId);
          setError('Profil tidak ditemukan. Hubungi admin.');
          // Don't sign out - let user see the error
          setProfile(null);
        }
      } catch (err) {
        console.error('Profile fetch error:', err);
        if (mounted) {
          setError('Gagal memuat profil. Coba refresh halaman.');
          setProfile(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Subscribe to auth state changes FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      // Update user immediately
      setUser(session?.user ?? null);

      // Handle different events
      if (event === 'SIGNED_OUT') {
        setProfile(null);
        setError(null);
        setLoading(false);
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        if (session?.user) {
          await handleAuthChange(event, session.user.id);
        } else {
          setLoading(false);
        }
      }
    });

    // Then get current session - this will trigger INITIAL_SESSION event
    const initSession = async () => {
      try {
        // Use getSession to check for existing session
        // This will trigger onAuthStateChange with INITIAL_SESSION
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Get session error:', sessionError);
          if (mounted) {
            setError('Gagal memuat sesi.');
            setLoading(false);
          }
          return;
        }

        // If no session exists, just stop loading
        if (!session && mounted) {
          setLoading(false);
        }

        // If session exists but onAuthStateChange hasn't fired yet,
        // manually handle it after a short delay
        if (session?.user && mounted) {
          // Give onAuthStateChange time to fire
          setTimeout(async () => {
            // Only proceed if still loading (onAuthStateChange didn't handle it)
            if (mounted && loading && !profile) {
              console.log('Fallback: manually fetching profile');
              setUser(session.user);
              await handleAuthChange('INITIAL_SESSION', session.user.id);
            }
          }, 500);
        }
      } catch (err) {
        console.error('Init session error:', err);
        if (mounted) {
          setError('Terjadi kesalahan.');
          setLoading(false);
        }
      }
    };

    initSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setError(null);
    setLoading(true);

    if (isDemoMode) {
      const role = email.includes('karyawan') ? 'karyawan' : 'owner';
      setUser(DEMO_USER);
      setProfile(DEMO_PROFILES[role]);
      setLoading(false);
      return;
    }

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;
      // onAuthStateChange will handle the rest
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
    setUser(null);
    setProfile(null);
    setError(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, error, signIn, signOut, isDemoMode }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
