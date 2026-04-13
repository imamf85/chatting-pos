import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useActiveLapak } from '../hooks/useActiveLapak';
import { useTheme } from '../hooks/useTheme';
import { supabase, isDemoMode } from '../lib/supabase';
import LapakSwitcher from '../components/LapakSwitcher';
import OrderChat from '../components/OrderChat';
import OrderCard from '../components/OrderCard';
import KembalianBox from '../components/KembalianBox';
import { printReceipt } from '../lib/print';
import bluetoothPrinter from '../lib/bluetoothPrinter';
import receiptFormatter from '../lib/receiptFormatter';
import type { ParsedItem, OrderItem, Transaksi } from '../types';

type PageState = 'chat' | 'confirmOrder' | 'selectPayment' | 'cashPayment' | 'completed';
type PaymentMethod = 'qris' | 'cash';

export default function Order() {
  const { profile, signOut } = useAuth();
  const { activeLapak, loading: lapakLoading } = useActiveLapak();
  const { theme, toggleTheme } = useTheme();

  const [pageState, setPageState] = useState<PageState>('chat');
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [namaCustomer, setNamaCustomer] = useState('');
  const [savedOrder, setSavedOrder] = useState<{
    items: OrderItem[];
    nama: string;
    total: number;
    txNumber: number;
    bayar: number;
    kembalian: number;
    transaksiId?: string;
    paymentMethod?: PaymentMethod;
  } | null>(null);

  // Bluetooth printer state
  const [printerConnected, setPrinterConnected] = useState(false);
  const [printerName, setPrinterName] = useState('');
  const [connectingPrinter, setConnectingPrinter] = useState(false);
  const [printing, setPrinting] = useState(false);

  // Demo mode tx number counter
  const demoTxCounter = useRef(1);

  // Check printer status periodically
  const checkPrinterStatus = useCallback(() => {
    if (bluetoothPrinter.isSupported()) {
      const info = bluetoothPrinter.getConnectionInfo();
      setPrinterConnected(info.isConnected);
      setPrinterName(info.deviceName);
    }
  }, []);

  useEffect(() => {
    checkPrinterStatus();
    const interval = setInterval(checkPrinterStatus, 2000);
    return () => clearInterval(interval);
  }, [checkPrinterStatus]);

  // Connect to Bluetooth printer
  const handleConnectPrinter = async () => {
    setConnectingPrinter(true);
    try {
      await bluetoothPrinter.connect();
      checkPrinterStatus();
    } catch (error) {
      console.error('Failed to connect printer:', error);
      alert('Gagal menghubungkan printer. Pastikan Bluetooth aktif.');
    } finally {
      setConnectingPrinter(false);
    }
  };

  // Disconnect printer
  const handleDisconnectPrinter = async () => {
    await bluetoothPrinter.disconnect();
    checkPrinterStatus();
  };

  const handleOrderParsed = (items: ParsedItem[], nama: string) => {
    setParsedItems(items);
    setNamaCustomer(nama);
    setPageState('confirmOrder');
  };

  const handleSaveOrder = async (items: OrderItem[], nama: string, total: number) => {
    if (!activeLapak) return;

    // Demo mode - simpan lokal saja
    if (isDemoMode) {
      const txNumber = demoTxCounter.current++;
      setSavedOrder({ items, nama, total, txNumber, bayar: 0, kembalian: 0 });
      setPageState('selectPayment');
      return;
    }

    try {
      // Get next tx_number - try RPC first, fallback to counting
      let txNumber = 1;
      try {
        const { data: txNumData } = await supabase.rpc('get_next_tx_number', {
          p_lapak_id: activeLapak.id,
        });
        txNumber = txNumData || 1;
      } catch {
        // Fallback: count today's transactions + 1
        const today = new Date().toISOString().split('T')[0];
        const { count } = await supabase
          .from('transaksi')
          .select('*', { count: 'exact', head: true })
          .eq('lapak_id', activeLapak.id)
          .gte('created_at', today);
        txNumber = (count || 0) + 1;
      }

      // Insert transaksi
      const { data: transaksiData, error: transaksiError } = await supabase
        .from('transaksi')
        .insert({
          lapak_id: activeLapak.id,
          tx_number: txNumber,
          nama_customer: nama,
          total: total,
          bayar: 0,
          kembalian: 0,
        })
        .select()
        .single();

      if (transaksiError) throw transaksiError;

      // Insert items
      const itemsToInsert = items.map((item) => ({
        transaksi_id: transaksiData.id,
        varian: item.varian,
        daging: item.daging,
        ukuran: item.ukuran,
        kepedasan: item.kepedasan,
        toppings: item.toppings,
        catatan: item.catatan,
        qty: item.qty,
        harga_satuan: item.harga_satuan,
        subtotal: item.subtotal,
      }));

      const { error: itemsError } = await supabase
        .from('transaksi_item')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // Save for payment state
      setSavedOrder({ items, nama, total, txNumber, bayar: 0, kembalian: 0, transaksiId: transaksiData.id });
      setPageState('selectPayment');
    } catch (error) {
      console.error('Error saving order:', error);
      alert('Gagal menyimpan order. Coba lagi.');
    }
  };

  const handleSelectQRIS = async () => {
    if (!savedOrder) return;

    // QRIS: bayar = total, kembalian = 0
    const updatedOrder = {
      ...savedOrder,
      bayar: savedOrder.total,
      kembalian: 0,
      paymentMethod: 'qris' as PaymentMethod
    };
    setSavedOrder(updatedOrder);

    // Update database if not demo mode
    if (!isDemoMode && savedOrder.transaksiId) {
      try {
        await supabase
          .from('transaksi')
          .update({ bayar: savedOrder.total, kembalian: 0 })
          .eq('id', savedOrder.transaksiId);
      } catch (error) {
        console.error('Error updating payment:', error);
      }
    }

    setPageState('completed');
  };

  const handleSelectCash = () => {
    if (!savedOrder) return;
    setSavedOrder({ ...savedOrder, paymentMethod: 'cash' as PaymentMethod });
    setPageState('cashPayment');
  };

  const handlePaymentComplete = async (bayar: number, kembalian: number) => {
    if (!savedOrder) return;

    // Update database if not demo mode
    if (!isDemoMode && savedOrder.transaksiId) {
      try {
        await supabase
          .from('transaksi')
          .update({ bayar, kembalian })
          .eq('id', savedOrder.transaksiId);
      } catch (error) {
        console.error('Error updating payment:', error);
      }
    }

    setSavedOrder({ ...savedOrder, bayar, kembalian });
    setPageState('completed');
  };

  // Print via Bluetooth or fallback to browser print
  const handlePrint = async (type: 'customer' | 'kitchen' = 'customer') => {
    if (!savedOrder) return;

    // Build transaksi object for receipt formatter
    const transaksi: Transaksi = {
      id: savedOrder.transaksiId || 'demo',
      lapak_id: activeLapak?.id || '',
      created_by: profile?.id || '',
      tx_number: savedOrder.txNumber,
      nama_customer: savedOrder.nama,
      total: savedOrder.total,
      bayar: savedOrder.bayar,
      kembalian: savedOrder.kembalian,
      created_at: new Date().toISOString(),
    };

    // Try Bluetooth print first
    if (printerConnected) {
      setPrinting(true);
      try {
        const receipt = type === 'kitchen'
          ? receiptFormatter.generateKitchenReceipt(transaksi, savedOrder.items, activeLapak?.nama)
          : receiptFormatter.generateCustomerReceipt(transaksi, savedOrder.items, activeLapak?.nama);

        await bluetoothPrinter.print(receipt);
      } catch (error) {
        console.error('Bluetooth print failed:', error);
        alert('Gagal print via Bluetooth. Coba lagi.');
      } finally {
        setPrinting(false);
      }
    } else {
      // Fallback to browser print
      printReceipt({
        txNumber: savedOrder.txNumber,
        namaCustomer: savedOrder.nama,
        items: savedOrder.items,
        total: savedOrder.total,
        bayar: savedOrder.bayar,
        kembalian: savedOrder.kembalian,
        createdAt: new Date(),
      });
    }
  };

  const handleNewOrder = () => {
    setParsedItems([]);
    setNamaCustomer('');
    setSavedOrder(null);
    setPageState('chat');
  };

  const handleCancelOrder = () => {
    setParsedItems([]);
    setNamaCustomer('');
    setPageState('chat');
  };

  if (lapakLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-gray-500 dark:text-gray-400">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Header - Compact for mobile */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex-shrink-0 safe-area-top">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-orange-500">AL BEWOK</h1>
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

            {/* Printer Status Button */}
            {bluetoothPrinter.isSupported() && (
              <button
                onClick={printerConnected ? handleDisconnectPrinter : handleConnectPrinter}
                disabled={connectingPrinter}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  printerConnected
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                title={printerConnected ? `Connected: ${printerName}` : 'Connect Printer'}
              >
                {connectingPrinter ? (
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                    />
                  </svg>
                )}
                {printerConnected && (
                  <span className="hidden sm:inline truncate max-w-[80px]">{printerName}</span>
                )}
              </button>
            )}

            <Link
              to="/rekap"
              className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-orange-500 transition-colors"
            >
              Rekap
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
        <div className="bg-gradient-to-r from-orange-500 to-orange-400 px-4 py-2 text-center flex-shrink-0">
          <span className="text-white text-sm font-medium">{activeLapak.nama}</span>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {pageState === 'chat' && (
          <OrderChat onOrderParsed={handleOrderParsed} />
        )}

        {pageState === 'confirmOrder' && (
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900">
            <OrderCard
              items={parsedItems}
              namaCustomer={namaCustomer}
              onSave={handleSaveOrder}
              onCancel={handleCancelOrder}
            />
          </div>
        )}

        {pageState === 'selectPayment' && savedOrder && (
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900">
            {/* Success Badge */}
            <div className="mb-6 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-4 text-center shadow-lg">
              <div className="text-white text-lg font-bold">Order Tersimpan!</div>
              <div className="text-green-100 text-sm mt-1">
                #TX-{String(savedOrder.txNumber).padStart(3, '0')}
                {savedOrder.nama && ` • ${savedOrder.nama}`}
              </div>
            </div>

            {/* Total */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6">
              <div className="text-center">
                <div className="text-gray-500 dark:text-gray-400 text-sm mb-1">Total Pembayaran</div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  Rp {(savedOrder.total * 1000).toLocaleString('id-ID')}
                </div>
              </div>
            </div>

            {/* Payment Method Selection */}
            <div className="space-y-3">
              <div className="text-gray-600 dark:text-gray-300 font-medium text-center mb-4">Pilih Metode Pembayaran</div>

              {/* QRIS Button */}
              <button
                onClick={handleSelectQRIS}
                className="w-full py-5 px-6 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-bold
                           rounded-2xl hover:from-purple-600 hover:to-indigo-600 transition-all active:scale-98
                           shadow-lg flex items-center justify-center gap-3"
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                  />
                </svg>
                QRIS
              </button>

              {/* Cash Button */}
              <button
                onClick={handleSelectCash}
                className="w-full py-5 px-6 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold
                           rounded-2xl hover:from-green-600 hover:to-emerald-600 transition-all active:scale-98
                           shadow-lg flex items-center justify-center gap-3"
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                CASH
              </button>
            </div>

            {/* Cancel Button */}
            <div className="mt-6">
              <button
                onClick={handleNewOrder}
                className="w-full py-3 px-4 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-medium
                           rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
              >
                Batalkan & Order Baru
              </button>
            </div>
          </div>
        )}

        {pageState === 'cashPayment' && savedOrder && (
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900">
            {/* Order Info Badge */}
            <div className="mb-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-3 text-center shadow-lg">
              <div className="text-white text-sm font-medium">
                #TX-{String(savedOrder.txNumber).padStart(3, '0')}
                {savedOrder.nama && ` • ${savedOrder.nama}`}
              </div>
            </div>

            <KembalianBox
              total={savedOrder.total}
              onPaymentComplete={handlePaymentComplete}
            />

            {/* Back Button */}
            <div className="mt-4">
              <button
                onClick={() => setPageState('selectPayment')}
                className="w-full py-3 px-4 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-medium
                           rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
              >
                Kembali ke Pilihan Pembayaran
              </button>
            </div>
          </div>
        )}

        {pageState === 'completed' && savedOrder && (
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900">
            {/* Completion Card */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden">
              <div className={`p-8 text-center ${
                savedOrder.paymentMethod === 'qris'
                  ? 'bg-gradient-to-r from-purple-500 to-indigo-500'
                  : 'bg-gradient-to-r from-green-500 to-emerald-500'
              }`}>
                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="text-white text-2xl font-bold">Selesai!</div>
                <div className="text-white/80 mt-1">
                  #TX-{String(savedOrder.txNumber).padStart(3, '0')}
                  {savedOrder.paymentMethod && (
                    <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-sm">
                      {savedOrder.paymentMethod === 'qris' ? 'QRIS' : 'CASH'}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex justify-between text-lg">
                  <span className="text-gray-500 dark:text-gray-400">Total</span>
                  <span className="font-bold text-gray-900 dark:text-white">Rp {(savedOrder.total * 1000).toLocaleString('id-ID')}</span>
                </div>
                {savedOrder.paymentMethod === 'cash' && (
                  <>
                    <div className="flex justify-between text-lg">
                      <span className="text-gray-500 dark:text-gray-400">Bayar</span>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Rp {(savedOrder.bayar * 1000).toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between text-lg">
                      <span className="text-gray-500 dark:text-gray-400">Kembali</span>
                      <span className="font-bold text-green-600 dark:text-green-400">Rp {(savedOrder.kembalian * 1000).toLocaleString('id-ID')}</span>
                    </div>
                  </>
                )}
                {savedOrder.paymentMethod === 'qris' && (
                  <div className="text-center py-2">
                    <span className="text-purple-600 dark:text-purple-400 font-medium">Pembayaran via QRIS</span>
                  </div>
                )}
              </div>
            </div>

            {/* Print buttons */}
            <div className="mt-6 space-y-3">
              {printerConnected && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handlePrint('customer')}
                    disabled={printing}
                    className="py-3 px-4 bg-white dark:bg-gray-800 border-2 border-green-200 dark:border-green-700 text-green-700 dark:text-green-400 font-semibold
                               rounded-2xl hover:bg-green-50 dark:hover:bg-green-900/20 transition-all active:scale-95 shadow-sm
                               disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {printing ? (
                      <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                        />
                      </svg>
                    )}
                    Struk
                  </button>
                  <button
                    onClick={() => handlePrint('kitchen')}
                    disabled={printing}
                    className="py-3 px-4 bg-white dark:bg-gray-800 border-2 border-orange-200 dark:border-orange-700 text-orange-700 dark:text-orange-400 font-semibold
                               rounded-2xl hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all active:scale-95 shadow-sm
                               disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {printing ? (
                      <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        />
                      </svg>
                    )}
                    Dapur
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {!printerConnected && (
                  <button
                    onClick={() => handlePrint('customer')}
                    className="py-4 px-4 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold
                               rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all active:scale-95 shadow-sm"
                  >
                    Print
                  </button>
                )}
                <button
                  onClick={handleNewOrder}
                  className={`py-4 px-4 bg-orange-500 text-white font-semibold
                             rounded-2xl hover:bg-orange-600 transition-all active:scale-95 shadow-lg
                             ${printerConnected ? 'col-span-2' : ''}`}
                >
                  + Order Baru
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
