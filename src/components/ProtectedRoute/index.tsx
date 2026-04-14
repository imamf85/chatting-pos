import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import type { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
}

const LOADING_TIMEOUT_MS = 15000; // 15 seconds

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, profile, loading, error } = useAuth();
  const navigate = useNavigate();
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  // Timeout for loading state
  useEffect(() => {
    if (loading) {
      setLoadingTimeout(false);
      const timer = setTimeout(() => {
        setLoadingTimeout(true);
      }, LOADING_TIMEOUT_MS);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  // Redirect to login if not authenticated and not loading
  useEffect(() => {
    if (!loading && !user) {
      navigate('/login', { replace: true });
    }
  }, [user, loading, navigate]);

  // Handle retry
  const handleRetry = () => {
    window.location.reload();
  };

  // Show error state (only for actual errors, not timeout during normal load)
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="text-gray-700 dark:text-gray-300 font-medium">
            {error}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleRetry}
              className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
            >
              Coba Lagi
            </button>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="px-6 py-3 bg-emerald-500 text-white font-medium rounded-xl hover:bg-emerald-600 transition-all"
            >
              Ke Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show timeout state
  if (loadingTimeout && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-gray-700 dark:text-gray-300 font-medium">
            Koneksi lambat. Masih mencoba...
          </div>
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="flex gap-3 mt-2">
            <button
              onClick={handleRetry}
              className="px-6 py-3 bg-emerald-500 text-white font-medium rounded-xl hover:bg-emerald-600 transition-all"
            >
              Refresh
            </button>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
            >
              Ke Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state
  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-gray-500 dark:text-gray-400">Memuat...</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
