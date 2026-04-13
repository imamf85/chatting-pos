import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useActiveLapak } from '../hooks/useActiveLapak';
import { supabase, isDemoMode } from '../lib/supabase';
import LapakSwitcher from '../components/LapakSwitcher';
import OrderChat from '../components/OrderChat';
import OrderCard from '../components/OrderCard';
import KembalianBox from '../components/KembalianBox';
import { printReceipt } from '../lib/print';
import type { ParsedItem, OrderItem } from '../types';

type PageState = 'chat' | 'confirmOrder' | 'payment' | 'completed';

export default function Order() {
  const { profile, signOut } = useAuth();
  const { activeLapak, loading: lapakLoading } = useActiveLapak();

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
  } | null>(null);

  // Demo mode tx number counter
  const demoTxCounter = useRef(1);

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
      setPageState('payment');
      return;
    }

    try {
      // Get next tx_number
      const { data: txNumData } = await supabase.rpc('get_next_tx_number', {
        p_lapak_id: activeLapak.id,
      });
      const txNumber = txNumData || 1;

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
      setSavedOrder({ items, nama, total, txNumber, bayar: 0, kembalian: 0 });
      setPageState('payment');
    } catch (error) {
      console.error('Error saving order:', error);
      alert('Gagal menyimpan order. Coba lagi.');
    }
  };

  const handlePaymentComplete = async (bayar: number, kembalian: number) => {
    if (!savedOrder) return;
    setSavedOrder({ ...savedOrder, bayar, kembalian });
    setPageState('completed');
  };

  const handlePrint = () => {
    if (!savedOrder) return;

    printReceipt({
      txNumber: savedOrder.txNumber,
      namaCustomer: savedOrder.nama,
      items: savedOrder.items,
      total: savedOrder.total,
      bayar: savedOrder.bayar,
      kembalian: savedOrder.kembalian,
      createdAt: new Date(),
    });
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
      <div className="min-h-screen flex items-center justify-center bg-orange-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Header - Compact for mobile */}
      <header className="bg-white border-b border-gray-200 px-4 py-2 flex-shrink-0 safe-area-top">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-orange-500">AL BEWOK</h1>
            {profile?.role === 'owner' && <LapakSwitcher />}
          </div>

          <div className="flex items-center">
            <Link
              to="/rekap"
              className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-orange-500 transition-colors"
            >
              Rekap
            </Link>
            <button
              onClick={signOut}
              className="px-3 py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
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
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            <OrderCard
              items={parsedItems}
              namaCustomer={namaCustomer}
              onSave={handleSaveOrder}
              onCancel={handleCancelOrder}
            />
          </div>
        )}

        {pageState === 'payment' && savedOrder && (
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            {/* Success Badge */}
            <div className="mb-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-4 text-center shadow-lg">
              <div className="text-white text-lg font-bold">Order Tersimpan!</div>
              <div className="text-green-100 text-sm mt-1">
                #TX-{String(savedOrder.txNumber).padStart(3, '0')}
                {savedOrder.nama && ` • ${savedOrder.nama}`}
              </div>
            </div>

            <KembalianBox
              total={savedOrder.total}
              onPaymentComplete={handlePaymentComplete}
            />

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                onClick={handlePrint}
                className="py-4 px-4 bg-white border-2 border-gray-200 text-gray-700 font-semibold
                           rounded-2xl hover:bg-gray-50 transition-all active:scale-95 shadow-sm"
              >
                🖨️ Print
              </button>
              <button
                onClick={handleNewOrder}
                className="py-4 px-4 bg-orange-500 text-white font-semibold
                           rounded-2xl hover:bg-orange-600 transition-all active:scale-95 shadow-lg"
              >
                + Order Baru
              </button>
            </div>
          </div>
        )}

        {pageState === 'completed' && savedOrder && (
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            {/* Completion Card */}
            <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-8 text-center">
                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="text-white text-2xl font-bold">Selesai!</div>
                <div className="text-green-100 mt-1">
                  #TX-{String(savedOrder.txNumber).padStart(3, '0')}
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex justify-between text-lg">
                  <span className="text-gray-500">Total</span>
                  <span className="font-bold text-gray-900">Rp {(savedOrder.total * 1000).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-lg">
                  <span className="text-gray-500">Bayar</span>
                  <span className="font-medium text-gray-700">Rp {(savedOrder.bayar * 1000).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-lg">
                  <span className="text-gray-500">Kembali</span>
                  <span className="font-bold text-green-600">Rp {(savedOrder.kembalian * 1000).toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                onClick={handlePrint}
                className="py-4 px-4 bg-white border-2 border-gray-200 text-gray-700 font-semibold
                           rounded-2xl hover:bg-gray-50 transition-all active:scale-95 shadow-sm"
              >
                🖨️ Print
              </button>
              <button
                onClick={handleNewOrder}
                className="py-4 px-4 bg-orange-500 text-white font-semibold
                           rounded-2xl hover:bg-orange-600 transition-all active:scale-95 shadow-lg"
              >
                + Order Baru
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
