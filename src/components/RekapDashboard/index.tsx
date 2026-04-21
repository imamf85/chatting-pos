import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useActiveLapak } from '../../hooks/useActiveLapak';
import { useAuth } from '../../hooks/useAuth';
import type { Transaksi, TransaksiItem } from '../../types';
import { VARIAN_LABELS, UKURAN_LABELS, DAGING_LABELS } from '../../lib/menu';

interface TransaksiWithItems extends Transaksi {
  transaksi_item: TransaksiItem[];
}

// Helper to format date for input[type="date"]
function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Helper to format date for display
function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

export default function RekapDashboard() {
  const { activeLapak } = useActiveLapak();
  const { profile } = useAuth();
  const [transaksis, setTransaksis] = useState<TransaksiWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);

  const isOwner = profile?.role === 'owner';
  const isToday = formatDateForInput(selectedDate) === formatDateForInput(new Date());

  useEffect(() => {
    if (!activeLapak) return;

    async function fetchRekap() {
      setLoading(true);

      // Use selected date
      const targetDate = new Date(selectedDate);
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999)).toISOString();

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
  }, [activeLapak, selectedDate]);

  // Handle date change
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value + 'T00:00:00');
    setSelectedDate(newDate);
  };

  // Quick date navigation
  const goToPreviousDay = () => {
    const prevDay = new Date(selectedDate);
    prevDay.setDate(prevDay.getDate() - 1);
    setSelectedDate(prevDay);
  };

  const goToNextDay = () => {
    const nextDay = new Date(selectedDate);
    nextDay.setDate(nextDay.getDate() + 1);
    // Don't allow future dates
    if (nextDay <= new Date()) {
      setSelectedDate(nextDay);
    }
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  // Toggle expanded transaction
  const toggleExpanded = (txId: string) => {
    setExpandedTxId(expandedTxId === txId ? null : txId);
  };

  // Format kepedasan for display
  const formatKepedasan = (kepedasan: string) => {
    return kepedasan.charAt(0).toUpperCase() + kepedasan.slice(1);
  };

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
      {/* Lapak name & Date */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{activeLapak?.nama}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {isToday ? 'Rekap Hari Ini' : 'Rekap'} - {formatDateDisplay(selectedDate)}
        </p>
      </div>

      {/* Date Picker - Owner Only */}
      {isOwner && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between gap-2">
            {/* Previous Day Button */}
            <button
              onClick={goToPreviousDay}
              className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300
                         hover:bg-gray-200 dark:hover:bg-gray-600 transition-all active:scale-95"
              title="Hari sebelumnya"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Date Input */}
            <div className="flex-1 flex items-center justify-center gap-2">
              <input
                type="date"
                value={formatDateForInput(selectedDate)}
                onChange={handleDateChange}
                max={formatDateForInput(new Date())}
                className="px-3 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-center
                           text-gray-900 dark:text-gray-100 font-medium
                           focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {!isToday && (
                <button
                  onClick={goToToday}
                  className="px-3 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400
                             bg-emerald-50 dark:bg-emerald-900/30 rounded-xl
                             hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all"
                >
                  Hari Ini
                </button>
              )}
            </div>

            {/* Next Day Button */}
            <button
              onClick={goToNextDay}
              disabled={isToday}
              className={`p-2 rounded-xl transition-all active:scale-95 ${
                isToday
                  ? 'bg-gray-50 dark:bg-gray-800 text-gray-300 dark:text-gray-600 cursor-not-allowed'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              title="Hari berikutnya"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}

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
            {isToday ? 'Belum ada transaksi hari ini' : 'Tidak ada transaksi pada tanggal ini'}
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {transaksis.map((tx) => {
              const isExpanded = expandedTxId === tx.id;
              return (
                <div key={tx.id}>
                  {/* Transaction Header - Clickable */}
                  <button
                    onClick={() => toggleExpanded(tx.id)}
                    className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        {/* Expand/Collapse Icon */}
                        <svg
                          className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="font-medium text-gray-900 dark:text-white">
                          #TX-{String(tx.tx_number).padStart(3, '0')}
                        </span>
                        {tx.nama_customer && (
                          <span className="text-gray-500 dark:text-gray-400">
                            a.n. {tx.nama_customer}
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {formatTime(tx.created_at)}
                      </span>
                    </div>

                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-2 ml-6">
                      {tx.transaksi_item.map((item, i) => (
                        <span key={item.id}>
                          {i > 0 && ', '}
                          {item.qty}x {VARIAN_LABELS[item.varian as keyof typeof VARIAN_LABELS]} {UKURAN_LABELS[item.ukuran as keyof typeof UKURAN_LABELS]}
                        </span>
                      ))}
                    </div>

                    <div className="flex justify-between items-center text-sm ml-6">
                      <span className="text-gray-500 dark:text-gray-400">
                        Bayar: {formatRupiah(tx.bayar)} | Kembali: {formatRupiah(tx.kembalian)}
                      </span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatRupiah(tx.total)}
                      </span>
                    </div>
                  </button>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div className="px-4 pb-4 bg-gray-50 dark:bg-gray-900/50">
                      <div className="ml-6 space-y-3">
                        {tx.transaksi_item.map((item) => (
                          <div
                            key={item.id}
                            className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700"
                          >
                            {/* Item Header */}
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <span className="font-medium text-gray-900 dark:text-white">
                                  {item.qty}x {VARIAN_LABELS[item.varian as keyof typeof VARIAN_LABELS]} {UKURAN_LABELS[item.ukuran as keyof typeof UKURAN_LABELS]}
                                </span>
                              </div>
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                {formatRupiah(item.subtotal)}
                              </span>
                            </div>

                            {/* Item Details */}
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-gray-400 dark:text-gray-500">Daging:</span>
                                <span className="ml-1 text-gray-700 dark:text-gray-300">
                                  {DAGING_LABELS[item.daging as keyof typeof DAGING_LABELS]}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-400 dark:text-gray-500">Kepedasan:</span>
                                <span className="ml-1 text-gray-700 dark:text-gray-300">
                                  {formatKepedasan(item.kepedasan)}
                                </span>
                              </div>
                              {item.toppings && item.toppings.length > 0 && (
                                <div className="col-span-2">
                                  <span className="text-gray-400 dark:text-gray-500">Topping:</span>
                                  <span className="ml-1 text-emerald-600 dark:text-emerald-400">
                                    +{item.toppings.join(', ')}
                                  </span>
                                </div>
                              )}
                              {item.catatan && (
                                <div className="col-span-2">
                                  <span className="text-gray-400 dark:text-gray-500">Catatan:</span>
                                  <span className="ml-1 text-gray-700 dark:text-gray-300 italic">
                                    {item.catatan}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Price per unit */}
                            <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500">
                              @{formatRupiah(item.harga_satuan)}/pcs
                            </div>
                          </div>
                        ))}

                        {/* Payment Summary in expanded view */}
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 border border-emerald-200 dark:border-emerald-800">
                          <div className="grid grid-cols-3 gap-2 text-sm">
                            <div className="text-center">
                              <div className="text-gray-500 dark:text-gray-400">Total</div>
                              <div className="font-bold text-gray-900 dark:text-white">{formatRupiah(tx.total)}</div>
                            </div>
                            <div className="text-center">
                              <div className="text-gray-500 dark:text-gray-400">Bayar</div>
                              <div className="font-bold text-gray-900 dark:text-white">{formatRupiah(tx.bayar)}</div>
                            </div>
                            <div className="text-center">
                              <div className="text-gray-500 dark:text-gray-400">Kembali</div>
                              <div className="font-bold text-emerald-600 dark:text-emerald-400">{formatRupiah(tx.kembalian)}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
