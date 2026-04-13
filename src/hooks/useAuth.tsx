import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
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

  // Helper to fetch profile with retry
  const fetchProfile = useCallback(async (userId: string, retries = 3): Promise<UserProfile | null> => {
    for (let i = 0; i < retries; i++) {
      try {
        const profileData = await getProfileAfterLogin(userId);
        if (profileData) return profileData;
        // Wait before retry
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (err) {
        console.error(`Profile fetch attempt ${i + 1} failed:`, err);
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    return null;
  }, []);

  useEffect(() => {
    if (isDemoMode) {
      // Demo mode - tidak perlu auth
      setLoading(false);
      return;
    }

    let mounted = true;

    // Get initial session
    const initAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Session error:', sessionError);
          if (mounted) {
            setError('Gagal memuat sesi. Silakan login ulang.');
            setLoading(false);
          }
          return;
        }

        if (!mounted) return;

        setUser(session?.user ?? null);

        if (session?.user) {
          const profileData = await fetchProfile(session.user.id);

          if (!mounted) return;

          if (!profileData) {
            // Profile tidak ditemukan - sign out dan tampilkan error
            console.error('Profile not found for user:', session.user.id);
            setError('Profil tidak ditemukan. Hubungi admin.');
            await supabase.auth.signOut();
            setUser(null);
          } else {
            setProfile(profileData);
            setError(null);
          }
        }
      } catch (err) {
        console.error('Auth init error:', err);
        if (mounted) {
          setError('Terjadi kesalahan saat memuat data.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      console.log('Auth state changed:', event);

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setError(null);
        return;
      }

      setUser(session?.user ?? null);

      if (session?.user) {
        const profileData = await fetchProfile(session.user.id);

        if (!mounted) return;

        if (!profileData) {
          setError('Profil tidak ditemukan. Hubungi admin.');
          await supabase.auth.signOut();
          setUser(null);
          setProfile(null);
        } else {
          setProfile(profileData);
          setError(null);
        }
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    if (isDemoMode) {
      // Demo mode: login sebagai owner atau karyawan berdasarkan email
      const role = email.includes('karyawan') ? 'karyawan' : 'owner';
      setUser(DEMO_USER);
      setProfile(DEMO_PROFILES[role]);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signOut = async () => {
    if (isDemoMode) {
      setUser(null);
      setProfile(null);
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setProfile(null);
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
