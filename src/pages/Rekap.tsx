import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useActiveLapak } from '../hooks/useActiveLapak';
import LapakSwitcher from '../components/LapakSwitcher';
import RekapDashboard from '../components/RekapDashboard';

export default function Rekap() {
  const { profile, signOut } = useAuth();
  const { activeLapak, loading: lapakLoading } = useActiveLapak();

  if (lapakLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-orange-600">AL BEWOK</h1>
            <LapakSwitcher />
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/order"
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Order
            </Link>
            <button
              onClick={signOut}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Current lapak info for karyawan */}
      {profile?.role === 'karyawan' && activeLapak && (
        <div className="bg-orange-50 px-4 py-2 text-center text-sm text-orange-700">
          {activeLapak.nama}
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 max-w-lg mx-auto w-full overflow-y-auto">
        <RekapDashboard />
      </main>
    </div>
  );
}
