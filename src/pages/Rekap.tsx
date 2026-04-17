import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useActiveLapak } from '../hooks/useActiveLapak';
import { useTheme } from '../hooks/useTheme';
import LapakSwitcher from '../components/LapakSwitcher';
import RekapDashboard from '../components/RekapDashboard';

export default function Rekap() {
  const { profile, signOut } = useAuth();
  const { activeLapak, loading: lapakLoading } = useActiveLapak();
  const { theme, toggleTheme } = useTheme();

  if (lapakLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-gray-500 dark:text-gray-400">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="hidden sm:block text-lg font-bold text-emerald-600">AL BEWOK</h1>
            {profile?.role === 'owner' && <LapakSwitcher />}
          </div>

          <div className="flex items-center gap-1">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
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

            <Link
              to="/order"
              className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-emerald-500 transition-colors"
            >
              Order
            </Link>
            <button
              onClick={signOut}
              className="px-3 py-2 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Current lapak info for karyawan */}
      {profile?.role === 'karyawan' && activeLapak && (
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-400 px-4 py-2 text-center flex-shrink-0">
          <span className="text-white text-sm font-medium">{activeLapak.nama}</span>
        </div>
      )}

      {/* Main Content - Scrollable */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 max-w-lg mx-auto w-full pb-8">
          <RekapDashboard />
        </div>
      </main>
    </div>
  );
}
