import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
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

  // Prevent duplicate profile fetches
  const profileFetchingRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  // Cek email di allowed_emails dan buat/ambil profile
  // Returns profile data atau null jika email tidak allowed
  const checkAndCreateProfile = useCallback(async (authUser: User): Promise<UserProfile | null> => {
    const email = authUser.email?.toLowerCase();
    if (!email) {
      console.error('[Auth] No email in user object');
      return null;
    }

    // Prevent duplicate fetches for same user
    if (profileFetchingRef.current === authUser.id) {
      console.log('[Auth] Profile fetch already in progress for:', email);
      return null; // Return null, the ongoing fetch will handle state
    }

    profileFetchingRef.current = authUser.id;
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
        profileFetchingRef.current = null;
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
        profileFetchingRef.current = null;
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
        profileFetchingRef.current = null;
        return null;
      }

      // 4. Update registered_at di allowed_emails
      await supabase
        .from('allowed_emails')
        .update({ registered_at: new Date().toISOString() })
        .eq('email', email);

      console.log('[Auth] Profile created:', newProfile);
      profileFetchingRef.current = null;
      return newProfile as UserProfile;

    } catch (err) {
      console.error('[Auth] checkAndCreateProfile error:', err);
      profileFetchingRef.current = null;
      return null;
    }
  }, []);

  // Helper function to handle user session and profile
  const handleUserSession = useCallback(async (
    authUser: User,
    mounted: { current: boolean },
    source: string
  ) => {
    console.log(`[Auth] handleUserSession from ${source}:`, authUser.email);

    setUser(authUser);
    setLoading(true);
    setError(null);

    const profileData = await checkAndCreateProfile(authUser);

    if (!mounted.current) return;

    if (profileData) {
      setProfile(profileData);
      setError(null);
      console.log('[Auth] Ready - user:', profileData.nama);
    } else {
      // Only set error if this was the first/only fetch attempt
      // (profileFetchingRef is null means we completed the fetch)
      if (profileFetchingRef.current === null) {
        setError('Email tidak terdaftar. Hubungi admin untuk mendapatkan akses.');
        console.log('[Auth] Email not allowed');
      }
    }

    setLoading(false);
  }, [checkAndCreateProfile]);

  useEffect(() => {
    if (isDemoMode) {
      console.log('[Auth] Demo mode - skipping auth');
      setLoading(false);
      return;
    }

    const mounted = { current: true };

    // Check if this is an OAuth callback (has code in URL or access_token in hash)
    const getOAuthParams = () => {
      const params = new URLSearchParams(window.location.search);
      const hash = window.location.hash;
      const code = params.get('code');
      const hasToken = hash.includes('access_token');
      return { code, hasToken, isCallback: !!(code || hasToken) };
    };

    const oauthParams = getOAuthParams();
    if (oauthParams.isCallback) {
      console.log('[Auth] Detected OAuth callback:', {
        hasCode: !!oauthParams.code,
        hasToken: oauthParams.hasToken,
        url: window.location.href
      });
    }

    // Handle OAuth code exchange explicitly if needed
    const handleOAuthCodeExchange = async () => {
      if (oauthParams.code) {
        console.log('[Auth] Attempting to exchange code for session...');
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(oauthParams.code);
          if (error) {
            console.error('[Auth] Code exchange error:', error);
            return null;
          }
          console.log('[Auth] Code exchange successful:', data.user?.email);
          return data.session;
        } catch (err) {
          console.error('[Auth] Code exchange exception:', err);
          return null;
        }
      }
      return null;
    };

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[Auth] Event:', event, session?.user?.email);

        if (!mounted.current) return;

        if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          setError(null);
          setLoading(false);
          initializedRef.current = false;
          profileFetchingRef.current = null;
          return;
        }

        // Handle INITIAL_SESSION (page load with existing session)
        // and SIGNED_IN (new login, including OAuth redirect)
        if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && session?.user) {
          // Skip if already initialized with same user
          if (initializedRef.current && user?.id === session.user.id) {
            console.log('[Auth] Already initialized, skipping duplicate');
            return;
          }

          initializedRef.current = true;
          await handleUserSession(session.user, mounted, event);
          return;
        }

        // Handle INITIAL_SESSION with no session
        if (event === 'INITIAL_SESSION' && !session) {
          // If this is an OAuth callback with code, try to exchange it manually
          if (oauthParams.code) {
            console.log('[Auth] INITIAL_SESSION with no session, but has code. Exchanging...');
            const exchangedSession = await handleOAuthCodeExchange();
            if (exchangedSession?.user && mounted.current) {
              initializedRef.current = true;
              await handleUserSession(exchangedSession.user, mounted, 'code-exchange');
              // Clean up URL by removing code parameter
              const cleanUrl = window.location.pathname;
              window.history.replaceState({}, '', cleanUrl);
              return;
            }
            // If exchange failed, fall through to error handling
            console.log('[Auth] Code exchange did not return session');
          }

          // If this is an OAuth callback (with token in hash), wait a bit for processing
          if (oauthParams.hasToken) {
            console.log('[Auth] OAuth callback with hash token, waiting...');
            return; // Keep loading=true, wait for SIGNED_IN
          }

          console.log('[Auth] No session on initial load');
          initializedRef.current = true;
          setLoading(false);
          return;
        }

        if (event === 'TOKEN_REFRESHED' && session?.user) {
          setUser(session.user);
        }
      }
    );

    // Fallback timeout - if OAuth callback doesn't complete within 5s, something went wrong
    const fallbackTimer = setTimeout(async () => {
      if (!initializedRef.current && mounted.current) {
        console.log('[Auth] Fallback: checking session manually after timeout');

        try {
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();

          if (!mounted.current || initializedRef.current) return;

          if (sessionError) {
            console.error('[Auth] Session error:', sessionError);
            setError('Gagal memuat sesi. Silakan coba lagi.');
            setLoading(false);
            return;
          }

          if (session?.user) {
            initializedRef.current = true;
            await handleUserSession(session.user, mounted, 'fallback');
          } else {
            console.log('[Auth] No session (fallback)');
            if (oauthParams.isCallback) {
              setError('Login gagal. Silakan coba lagi.');
            }
            setLoading(false);
          }
        } catch (err) {
          console.error('[Auth] Fallback error:', err);
          if (mounted.current) {
            setError('Terjadi kesalahan. Silakan coba lagi.');
            setLoading(false);
          }
        }
      }
    }, oauthParams.isCallback ? 5000 : 100); // Longer timeout for OAuth callbacks

    return () => {
      mounted.current = false;
      clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, [handleUserSession, user?.id]);

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
