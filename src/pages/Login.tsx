import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';

export default function Login() {
  const { signIn, user, profile, loading: authLoading, isDemoMode, error: authError } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authError) {
      setError(authError);
    }
  }, [authError]);

  useEffect(() => {
    if (user && profile && !authLoading) {
      navigate('/order', { replace: true });
    }
  }, [user, profile, authLoading, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-100 via-emerald-50 to-white dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-gray-500 dark:text-gray-400 font-medium">Loading...</div>
        </div>
      </div>
    );
  }

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);

    try {
      await signIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal');
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    // Demo mode - just show message
    setError('Demo mode: Google Sign In tidak tersedia. Setup Supabase untuk login.');
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-emerald-100 via-emerald-50 to-white dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* Header decoration */}
      <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-br from-emerald-500 to-emerald-400 dark:from-emerald-600 dark:to-emerald-500 rounded-b-[3rem]" />

      {/* Theme Toggle - Top Right */}
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 z-20 p-2 rounded-xl bg-white/20 text-white hover:bg-white/30 transition-all"
        title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
      >
        {theme === 'dark' ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
            />
          </svg>
        )}
      </button>

      <div className="flex-1 flex flex-col items-center justify-center px-6 relative z-10">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="w-20 h-20 bg-white dark:bg-gray-800 rounded-3xl shadow-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🥙</span>
          </div>
          <h1 className="text-3xl font-bold text-white drop-shadow-lg">AL BEWOK</h1>
          <p className="text-emerald-100 text-sm mt-1">Point of Sale</p>
        </div>

        {/* Card */}
        <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-6 animate-fade-in">
          {/* Demo Mode Notice */}
          {isDemoMode && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-700 rounded-2xl p-4 mb-6">
              <div className="text-amber-800 dark:text-amber-300 text-sm font-semibold mb-2 text-center">
                Mode Demo
              </div>
              <p className="text-amber-700 dark:text-amber-400 text-xs text-center">
                Supabase belum dikonfigurasi. Setup environment variables untuk mengaktifkan login.
              </p>
            </div>
          )}

          {/* Welcome Text */}
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Selamat Datang!</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Masuk dengan akun Google untuk melanjutkan
            </p>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 px-4 py-3 rounded-2xl text-sm font-medium mb-4">
              {error}
            </div>
          )}

          {/* Google Sign In Button */}
          <button
            onClick={isDemoMode ? handleDemoLogin : handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600
                       text-gray-700 dark:text-gray-200 font-semibold py-4 px-4 rounded-2xl
                       hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-gray-300 dark:hover:border-gray-500
                       transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            )}
            <span>{loading ? 'Memproses...' : 'Masuk dengan Google'}</span>
          </button>

          {/* Info */}
          <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-6">
            Hanya akun yang terdaftar yang bisa login.
            <br />
            Hubungi admin jika belum punya akses.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-6 relative z-10">
        <p className="text-gray-400 dark:text-gray-500 text-xs">
          AL Bewok Kebab • Rasa Nikmat, Harga Bersahabat
        </p>
      </div>
    </div>
  );
}
