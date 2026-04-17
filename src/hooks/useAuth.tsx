import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
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

// Sentinel value to indicate fetch was skipped (not an error)
const FETCH_SKIPPED = Symbol('FETCH_SKIPPED');

// Cache keys
const CACHE_KEY_PROFILE = 'albewok_profile';
const CACHE_KEY_USER_ID = 'albewok_user_id';

// Helper to get cached profile
function getCachedProfile(): { userId: string; profile: UserProfile } | null {
  try {
    const userId = localStorage.getItem(CACHE_KEY_USER_ID);
    const profileStr = localStorage.getItem(CACHE_KEY_PROFILE);
    if (userId && profileStr) {
      return { userId, profile: JSON.parse(profileStr) };
    }
  } catch {
    // Ignore cache errors
  }
  return null;
}

// Helper to set cached profile
function setCachedProfile(userId: string, profile: UserProfile) {
  try {
    localStorage.setItem(CACHE_KEY_USER_ID, userId);
    localStorage.setItem(CACHE_KEY_PROFILE, JSON.stringify(profile));
  } catch {
    // Ignore cache errors
  }
}

// Helper to clear cached profile
function clearCachedProfile() {
  try {
    localStorage.removeItem(CACHE_KEY_USER_ID);
    localStorage.removeItem(CACHE_KEY_PROFILE);
  } catch {
    // Ignore cache errors
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track which user we're currently fetching profile for
  const fetchingForUserRef = useRef<string | null>(null);
  // Track which user's profile has been successfully fetched
  const profileFetchedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (isDemoMode) {
      console.log('[Auth] Demo mode - skipping auth');
      setLoading(false);
      return;
    }

    let isCancelled = false;

    // Check for OAuth error in URL
    const urlParams = new URLSearchParams(window.location.search);
    const oauthError = urlParams.get('error');
    const oauthErrorDescription = urlParams.get('error_description');

    if (oauthError) {
      console.error('[Auth] OAuth error:', oauthErrorDescription || oauthError);
      setError(`Login gagal: ${oauthErrorDescription || oauthError}`);
      setLoading(false);
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    console.log('[Auth] Initializing...', window.location.pathname);

    // Try to load from cache first for instant UI
    const cached = getCachedProfile();
    if (cached) {
      console.log('[Auth] Found cached profile for:', cached.profile.nama);
      // We'll verify this in background after getSession
    }

    // Helper: wait for a bit
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Function to fetch/create profile with retry
    const fetchProfile = async (authUser: User, retryCount = 0): Promise<UserProfile | typeof FETCH_SKIPPED | null> => {
      const email = authUser.email?.toLowerCase();
      if (!email) {
        console.error('[Auth] No email in user');
        return null;
      }

      // Skip if profile already fetched for this user
      if (profileFetchedForRef.current === authUser.id) {
        console.log('[Auth] Profile already fetched for this user, skipping');
        return FETCH_SKIPPED;
      }

      // Skip if already fetching for this user (but allow retries)
      if (fetchingForUserRef.current === authUser.id && retryCount === 0) {
        console.log('[Auth] Already fetching for this user, skipping');
        return FETCH_SKIPPED;
      }

      fetchingForUserRef.current = authUser.id;
      console.log('[Auth] Fetching profile for:', email, retryCount > 0 ? `(retry ${retryCount})` : '');

      try {
        // 1. Check allowed_emails
        console.log('[Auth] Querying allowed_emails...');

        const allowedPromise = supabase
          .from('allowed_emails')
          .select('*')
          .eq('email', email)
          .single();

        // Add timeout to prevent hanging forever
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Query timeout after 10s')), 10000)
        );

        const result = await Promise.race([
          allowedPromise,
          timeoutPromise
        ]) as { data: { nama: string; role: string; lapak_id: string | null } | null; error: { message?: string } | null };

        const allowed = result.data;
        const allowedErr = result.error;

        console.log('[Auth] allowed_emails result:', { allowed, error: allowedErr });

        if (allowedErr) {
          const errMsg = (allowedErr as Error).message || String(allowedErr);
          // Check if it's a lock error - retry if so
          if (errMsg.includes('Lock') && retryCount < 3) {
            console.log('[Auth] Lock error, retrying in 500ms...');
            await delay(500);
            return fetchProfile(authUser, retryCount + 1);
          }
          console.error('[Auth] allowed_emails error:', errMsg);
          fetchingForUserRef.current = null;
          return null;
        }

        if (!allowed) {
          console.error('[Auth] Email not in allowed list');
          fetchingForUserRef.current = null;
          return null;
        }

        console.log('[Auth] Email allowed:', allowed.nama);

        // 2. Check existing profile
        const { data: existing } = await supabase
          .from('user_profile')
          .select('*')
          .eq('id', authUser.id)
          .single();

        if (existing) {
          console.log('[Auth] Profile exists');
          fetchingForUserRef.current = null;
          return existing as UserProfile;
        }

        // 3. Create new profile
        console.log('[Auth] Creating profile...');
        const { data: newProfile, error: insertErr } = await supabase
          .from('user_profile')
          .insert({
            id: authUser.id,
            nama: allowed.nama,
            role: allowed.role,
            lapak_id: allowed.lapak_id,
          })
          .select()
          .single();

        if (insertErr) {
          console.error('[Auth] Insert error:', insertErr.message);
          fetchingForUserRef.current = null;
          return null;
        }

        // 4. Update registered_at
        await supabase
          .from('allowed_emails')
          .update({ registered_at: new Date().toISOString() })
          .eq('email', email);

        console.log('[Auth] Profile created');
        fetchingForUserRef.current = null;
        return newProfile as UserProfile;

      } catch (err) {
        console.error('[Auth] fetchProfile error:', err);
        fetchingForUserRef.current = null;
        return null;
      }
    };

    // Handle user session
    const handleSession = async (authUser: User | null, source: string) => {
      console.log('[Auth] handleSession from', source, authUser?.email || 'no user');

      if (!authUser) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setUser(authUser);

      const profileData = await fetchProfile(authUser);

      if (isCancelled) {
        console.log('[Auth] Cancelled, ignoring result');
        return;
      }

      // If fetch was skipped, don't update any state
      if (profileData === FETCH_SKIPPED) {
        console.log('[Auth] Fetch skipped, keeping current state');
        setLoading(false);
        return;
      }

      if (profileData) {
        setProfile(profileData);
        setError(null);
        profileFetchedForRef.current = authUser.id;
        setCachedProfile(authUser.id, profileData);
        console.log('[Auth] Ready:', profileData.nama);
      } else {
        setProfile(null);
        setError('Email tidak terdaftar. Hubungi admin untuk mendapatkan akses.');
        clearCachedProfile();
      }

      setLoading(false);
    };

    // Set up auth listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[Auth] Event:', event, session?.user?.email || 'no session');

        if (isCancelled) return;

        if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          setError(null);
          setLoading(false);
          fetchingForUserRef.current = null;
          profileFetchedForRef.current = null;
          clearCachedProfile();
          return;
        }

        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          if (session?.user) {
            await handleSession(session.user, event);
          } else {
            // No session
            setLoading(false);
          }
          return;
        }

        if (event === 'TOKEN_REFRESHED' && session?.user) {
          setUser(session.user);
        }
      }
    );

    // Immediately check for existing session (don't wait for event)
    // This speeds up the initial load significantly
    const initSession = async () => {
      console.log('[Auth] Checking existing session...');

      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (isCancelled) return;

        if (sessionError) {
          console.error('[Auth] getSession error:', sessionError);
          setLoading(false);
          return;
        }

        if (session?.user) {
          // Check if we have a valid cache for this user
          if (cached && cached.userId === session.user.id) {
            console.log('[Auth] Using cached profile, verifying in background...');
            setUser(session.user);
            setProfile(cached.profile);
            profileFetchedForRef.current = session.user.id;
            setLoading(false);

            // Verify in background (don't await)
            handleSession(session.user, 'CACHE_VERIFY').catch(console.error);
          } else {
            // No valid cache, fetch normally
            await handleSession(session.user, 'INIT');
          }
        } else {
          // No session
          console.log('[Auth] No existing session');
          clearCachedProfile();
          setLoading(false);
        }
      } catch (err) {
        console.error('[Auth] initSession error:', err);
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    initSession();

    return () => {
      isCancelled = true;
      subscription.unsubscribe();
    };
  }, []); // Empty dependency array - only run once on mount

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
      console.error('[Auth] signIn error:', err);
      setLoading(false);
      throw err;
    }
  };

  const signOut = async () => {
    // Reset refs and cache
    fetchingForUserRef.current = null;
    profileFetchedForRef.current = null;
    clearCachedProfile();

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
