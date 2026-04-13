import { useState } from 'react';
import type { OrderItem, ParsedItem, Varian } from '../../types';
import { calculateItemPrice, VARIAN_LABELS, DAGING_LABELS, UKURAN_LABELS } from '../../lib/menu';

interface OrderCardProps {
  items: ParsedItem[];
  namaCustomer: string;
  onSave: (items: OrderItem[], namaCustomer: string, total: number) => void;
  onCancel: () => void;
}

export default function OrderCard({
  items,
  namaCustomer: initialNama,
  onSave,
  onCancel,
}: OrderCardProps) {
  const [nama, setNama] = useState(initialNama);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editCatatan, setEditCatatan] = useState('');
  const [saving, setSaving] = useState(false);

  // Convert ParsedItem to OrderItem with prices
  const orderItems: OrderItem[] = items.map((item) => {
    const varian = item.varian as Varian;
    const hargaSatuan = calculateItemPrice(varian, item.daging, item.ukuran, item.toppings);
    return {
      varian,
      daging: item.daging,
      ukuran: item.ukuran,
      kepedasan: item.kepedasan,
      toppings: item.toppings,
      catatan: item.catatan,
      qty: item.qty,
      harga_satuan: hargaSatuan,
      subtotal: hargaSatuan * item.qty,
    };
  });

  const total = orderItems.reduce((sum, item) => sum + item.subtotal, 0);

  const handleSaveCatatan = () => {
    setEditingIndex(null);
  };

  const formatRupiah = (ribuan: number) => {
    return `Rp ${(ribuan * 1000).toLocaleString('id-ID')}`;
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(orderItems, nama, total);
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
      {/* Header with customer name */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-400 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="text-orange-100 text-sm">a.n.</span>
          <input
            type="text"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="Nama customer"
            className="flex-1 bg-white/20 backdrop-blur text-white placeholder-orange-200
                       border-0 rounded-xl px-3 py-2 text-base font-medium
                       focus:outline-none focus:ring-2 focus:ring-white/50"
          />
        </div>
      </div>

      {/* Items */}
      <div className="divide-y divide-gray-100">
        {orderItems.map((item, index) => (
          <div key={index} className="p-4">
            <div className="flex justify-between items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 text-base">
                  {VARIAN_LABELS[item.varian]} {UKURAN_LABELS[item.ukuran]}
                </div>
                <div className="text-sm text-gray-500 mt-0.5">
                  {DAGING_LABELS[item.daging]} • {item.kepedasan.charAt(0).toUpperCase() + item.kepedasan.slice(1)}
                </div>
                {item.toppings.length > 0 && (
                  <div className="text-sm text-orange-500 font-medium mt-1">
                    + {item.toppings.join(', ')}
                  </div>
                )}

                {/* Catatan */}
                {editingIndex === index ? (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={editCatatan}
                      onChange={(e) => setEditCatatan(e.target.value)}
                      placeholder="Tambah catatan..."
                      autoFocus
                      className="flex-1 text-sm px-3 py-2 bg-gray-100 border-0 rounded-xl
                                 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <button
                      onClick={handleSaveCatatan}
                      className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-xl"
                    >
                      OK
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEditingIndex(index);
                      setEditCatatan(item.catatan);
                    }}
                    className="mt-2 text-xs text-gray-400 hover:text-orange-500 transition-colors"
                  >
                    {item.catatan || '+ Tambah catatan'}
                  </button>
                )}
              </div>

              <div className="text-right flex-shrink-0">
                <div className="text-xs text-gray-400">
                  {item.qty}x {formatRupiah(item.harga_satuan)}
                </div>
                <div className="font-bold text-gray-900 text-lg">
                  {formatRupiah(item.subtotal)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="bg-gray-50 px-5 py-4 border-t border-gray-100">
        <div className="flex justify-between items-center">
          <span className="text-gray-500 font-medium">Total</span>
          <span className="text-2xl font-bold text-orange-500">
            {formatRupiah(total)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 grid grid-cols-2 gap-3">
        <button
          onClick={onCancel}
          disabled={saving}
          className="py-4 px-4 bg-gray-100 text-gray-600 font-semibold
                     rounded-2xl hover:bg-gray-200 transition-all active:scale-95"
        >
          Batal
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="py-4 px-4 bg-orange-500 text-white font-semibold
                     rounded-2xl hover:bg-orange-600 transition-all active:scale-95 shadow-lg
                     disabled:opacity-50"
        >
          {saving ? 'Menyimpan...' : 'Simpan'}
        </button>
      </div>
    </div>
  );
}
