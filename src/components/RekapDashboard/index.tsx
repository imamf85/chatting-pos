import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useActiveLapak } from '../../hooks/useActiveLapak';
import type { Transaksi, TransaksiItem } from '../../types';
import { VARIAN_LABELS, UKURAN_LABELS } from '../../lib/menu';

interface TransaksiWithItems extends Transaksi {
  transaksi_item: TransaksiItem[];
}

export default function RekapDashboard() {
  const { activeLapak } = useActiveLapak();
  const [transaksis, setTransaksis] = useState<TransaksiWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeLapak) return;

    async function fetchRekap() {
      setLoading(true);

      // Get today's date in local timezone
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

      const { data, error } = await supabase
        .from('transaksi')
        .select(`
          *,
          transaksi_item (*)
        `)
        .eq('lapak_id', activeLapak!.id)
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setTransaksis(data as TransaksiWithItems[]);
      }

      setLoading(false);
    }

    fetchRekap();
  }, [activeLapak]);

  // Calculate stats
  const totalOmzet = transaksis.reduce((sum, t) => sum + t.total, 0);
  const totalKebab = transaksis.reduce(
    (sum, t) => sum + t.transaksi_item.reduce((s, i) => s + i.qty, 0),
    0
  );
  const avgPerTransaksi = transaksis.length > 0 ? totalOmzet / transaksis.length : 0;

  // Menu terlaris
  const menuCount: Record<string, number> = {};
  transaksis.forEach((t) => {
    t.transaksi_item.forEach((item) => {
      const key = `${item.varian}-${item.ukuran}`;
      menuCount[key] = (menuCount[key] || 0) + item.qty;
    });
  });
  const topMenus = Object.entries(menuCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  const formatRupiah = (ribuan: number) => {
    return `Rp ${(ribuan * 1000).toLocaleString('id-ID')}`;
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-gray-500 dark:text-gray-400">Memuat data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Lapak name */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{activeLapak?.nama}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Rekap Hari Ini - {new Date().toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Omzet</div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatRupiah(totalOmzet)}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">Kebab Terjual</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{totalKebab} pcs</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">Transaksi</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{transaksis.length}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">Rata-rata/TX</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatRupiah(Math.round(avgPerTransaksi))}
          </div>
        </div>
      </div>

      {/* Menu Terlaris */}
      {topMenus.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Menu Terlaris</h3>
          <div className="space-y-2">
            {topMenus.map(([key, count], index) => {
              const [varian, ukuran] = key.split('-');
              return (
                <div key={key} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-400 dark:text-gray-500">
                      #{index + 1}
                    </span>
                    <span className="text-gray-900 dark:text-gray-200">
                      {VARIAN_LABELS[varian as keyof typeof VARIAN_LABELS]} {UKURAN_LABELS[ukuran as keyof typeof UKURAN_LABELS]}
                    </span>
                  </div>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{count}x</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Riwayat Transaksi */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">Riwayat Transaksi</h3>
        </div>

        {transaksis.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            Belum ada transaksi hari ini
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {transaksis.map((tx) => (
              <div key={tx.id} className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">
                      #TX-{String(tx.tx_number).padStart(3, '0')}
                    </span>
                    {tx.nama_customer && (
                      <span className="text-gray-500 dark:text-gray-400 ml-2">
                        a.n. {tx.nama_customer}
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {formatTime(tx.created_at)}
                  </span>
                </div>

                <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {tx.transaksi_item.map((item, i) => (
                    <span key={item.id}>
                      {i > 0 && ', '}
                      {item.qty}x {VARIAN_LABELS[item.varian as keyof typeof VARIAN_LABELS]} {UKURAN_LABELS[item.ukuran as keyof typeof UKURAN_LABELS]}
                    </span>
                  ))}
                </div>

                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    Bayar: {formatRupiah(tx.bayar)} | Kembali: {formatRupiah(tx.kembalian)}
                  </span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatRupiah(tx.total)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
