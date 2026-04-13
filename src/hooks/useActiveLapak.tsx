import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import { supabase, isDemoMode } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { Lapak } from '../types';

// Demo lapak data
const DEMO_LAPAKS: Lapak[] = [
  { id: '11111111-1111-1111-1111-111111111111', nama: 'Lapak Timur', alamat: 'Jl. Raya Timur No. 1' },
  { id: '22222222-2222-2222-2222-222222222222', nama: 'Lapak Barat', alamat: 'Jl. Raya Barat No. 2' },
];

interface ActiveLapakContextType {
  activeLapak: Lapak | null;
  setActiveLapak: (lapak: Lapak) => void;
  availableLapaks: Lapak[];
  loading: boolean;
}

const ActiveLapakContext = createContext<ActiveLapakContextType | undefined>(
  undefined
);

export function ActiveLapakProvider({ children }: { children: ReactNode }) {
  const { profile, loading: authLoading } = useAuth();
  const [activeLapak, setActiveLapakState] = useState<Lapak | null>(null);
  const [availableLapaks, setAvailableLapaks] = useState<Lapak[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    async function fetchLapaks() {
      setLoading(true);

      if (isDemoMode) {
        // Demo mode - gunakan data dummy
        if (profile?.role === 'owner') {
          setAvailableLapaks(DEMO_LAPAKS);
          if (!activeLapak) {
            setActiveLapakState(DEMO_LAPAKS[0]);
          }
        } else if (profile?.role === 'karyawan') {
          const lapak = DEMO_LAPAKS.find(l => l.id === profile.lapak_id) || DEMO_LAPAKS[0];
          setAvailableLapaks([lapak]);
          setActiveLapakState(lapak);
        }
        setLoading(false);
        return;
      }

      if (profile?.role === 'owner') {
        // Owner dapat akses semua lapak
        const { data, error } = await supabase
          .from('lapak')
          .select('*')
          .order('nama');

        if (!error && data) {
          setAvailableLapaks(data);
          // Set default ke lapak pertama jika belum ada active
          if (!activeLapak && data.length > 0) {
            setActiveLapakState(data[0]);
          }
        }
      } else if (profile?.role === 'karyawan' && profile.lapak_id) {
        // Karyawan hanya dapat akses lapaknya sendiri
        const { data, error } = await supabase
          .from('lapak')
          .select('*')
          .eq('id', profile.lapak_id)
          .single();

        if (!error && data) {
          setAvailableLapaks([data]);
          setActiveLapakState(data);
        }
      }

      setLoading(false);
    }

    fetchLapaks();
  }, [profile, authLoading]);

  const setActiveLapak = (lapak: Lapak) => {
    // Karyawan tidak bisa ganti lapak
    if (profile?.role === 'karyawan') return;
    setActiveLapakState(lapak);
  };

  return (
    <ActiveLapakContext.Provider
      value={{ activeLapak, setActiveLapak, availableLapaks, loading }}
    >
      {children}
    </ActiveLapakContext.Provider>
  );
}

export function useActiveLapak() {
  const context = useContext(ActiveLapakContext);
  if (context === undefined) {
    throw new Error('useActiveLapak must be used within an ActiveLapakProvider');
  }
  return context;
}
