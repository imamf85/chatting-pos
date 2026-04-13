import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';

export default function Login() {
  const { signIn, user, loading: authLoading, isDemoMode } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user && !authLoading) {
      navigate('/order', { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Show loading while checking auth or redirecting
  if (authLoading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-100 via-orange-50 to-white dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-gray-500 dark:text-gray-400 font-medium">Loading...</div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (role: 'owner' | 'karyawan') => {
    setLoading(true);
    try {
      await signIn(role === 'karyawan' ? 'karyawan@demo.com' : 'owner@demo.com', 'demo');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-orange-100 via-orange-50 to-white dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* Header decoration */}
      <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-br from-orange-500 to-orange-400 dark:from-orange-600 dark:to-orange-500 rounded-b-[3rem]" />

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
          <p className="text-orange-100 text-sm mt-1">Point of Sale</p>
        </div>

        {/* Card */}
        <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-6 animate-fade-in">
          {/* Demo Mode Notice */}
          {isDemoMode && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-700 rounded-2xl p-4 mb-6">
              <div className="text-amber-800 dark:text-amber-300 text-sm font-semibold mb-3 text-center">
                Mode Demo
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleDemoLogin('owner')}
                  disabled={loading}
                  className="py-3 px-4 bg-orange-500 text-white text-sm font-semibold rounded-xl
                             hover:bg-orange-600 transition-all active:scale-95 disabled:opacity-50"
                >
                  Login Owner
                </button>
                <button
                  onClick={() => handleDemoLogin('karyawan')}
                  disabled={loading}
                  className="py-3 px-4 bg-gray-600 text-white text-sm font-semibold rounded-xl
                             hover:bg-gray-700 transition-all active:scale-95 disabled:opacity-50"
                >
                  Login Karyawan
                </button>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@albewok.com"
                required
                className="w-full px-4 py-4 bg-gray-100 dark:bg-gray-700 border-0 rounded-2xl
                           focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white dark:focus:bg-gray-600
                           text-base font-medium text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-all"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-4 bg-gray-100 dark:bg-gray-700 border-0 rounded-2xl
                           focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white dark:focus:bg-gray-600
                           text-base font-medium text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-all"
              />
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 px-4 py-3 rounded-2xl text-sm font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-400 text-white font-bold
                         py-4 px-4 rounded-2xl transition-all hover:shadow-lg
                         disabled:opacity-50 disabled:cursor-not-allowed active:scale-95
                         text-base shadow-lg"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Masuk...
                </span>
              ) : (
                'Masuk'
              )}
            </button>
          </form>
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
