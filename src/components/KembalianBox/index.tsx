import { useState, useMemo } from 'react';

interface KembalianBoxProps {
  total: number; // dalam ribuan
  onPaymentComplete: (bayar: number, kembalian: number) => void;
}

export default function KembalianBox({ total, onPaymentComplete }: KembalianBoxProps) {
  const [bayar, setBayar] = useState<number | ''>('');
  const [customInput, setCustomInput] = useState('');

  // Filter nominal yang relevan (>= total)
  const relevantNominals = useMemo(() => {
    // Always show some options, prioritize ones >= total
    const allNominals = [10, 20, 50, 100, 150, 200, 500];
    return allNominals.filter(n => n >= total - 10).slice(0, 6);
  }, [total]);

  const kembalian = typeof bayar === 'number' ? bayar - total : 0;

  const handleNominalClick = (nominal: number) => {
    setBayar(nominal);
    setCustomInput('');
  };

  const handleCustomChange = (value: string) => {
    setCustomInput(value);
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setBayar(parsed);
    } else {
      setBayar('');
    }
  };

  const handleConfirm = () => {
    if (typeof bayar === 'number' && bayar >= total) {
      onPaymentComplete(bayar, kembalian);
    }
  };

  const formatRupiah = (ribuan: number) => {
    return `Rp ${(ribuan * 1000).toLocaleString('id-ID')}`;
  };

  const formatShort = (ribuan: number) => {
    if (ribuan >= 1000) {
      return `${ribuan / 1000}jt`;
    }
    if (ribuan >= 100) {
      return `${ribuan}rb`;
    }
    return `${ribuan}k`;
  };

  // Status styling
  const getStatusStyle = () => {
    if (typeof bayar !== 'number') {
      return {
        bg: 'bg-gray-100',
        text: 'text-gray-500',
        message: 'Pilih nominal pembayaran',
      };
    }
    if (kembalian > 0) {
      return {
        bg: 'bg-gradient-to-r from-green-500 to-emerald-500',
        text: 'text-white',
        message: `Kembalian ${formatRupiah(kembalian)}`,
      };
    }
    if (kembalian === 0) {
      return {
        bg: 'bg-gradient-to-r from-amber-400 to-orange-400',
        text: 'text-white',
        message: 'Uang pas!',
      };
    }
    return {
      bg: 'bg-gradient-to-r from-red-500 to-rose-500',
      text: 'text-white',
      message: `Kurang ${formatRupiah(Math.abs(kembalian))}`,
    };
  };

  const status = getStatusStyle();

  return (
    <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 px-5 py-4 border-b border-gray-100">
        <div className="flex justify-between items-center">
          <span className="text-gray-500 font-medium">Total Bayar</span>
          <span className="text-2xl font-bold text-orange-500">
            {formatRupiah(total)}
          </span>
        </div>
      </div>

      {/* Quick Nominals */}
      <div className="p-4">
        <div className="text-sm text-gray-500 mb-3 font-medium">Pilih nominal:</div>
        <div className="grid grid-cols-3 gap-2">
          {relevantNominals.map((nominal) => (
            <button
              key={nominal}
              onClick={() => handleNominalClick(nominal)}
              className={`py-4 px-2 rounded-2xl font-semibold text-base transition-all active:scale-95 ${
                bayar === nominal
                  ? 'bg-orange-500 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {formatShort(nominal)}
            </button>
          ))}
        </div>

        {/* Custom input */}
        <div className="mt-4">
          <input
            type="number"
            inputMode="numeric"
            value={customInput}
            onChange={(e) => handleCustomChange(e.target.value)}
            placeholder="Atau ketik nominal lain (ribu)..."
            className="w-full px-4 py-4 bg-gray-100 border-0 rounded-2xl
                       focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white
                       text-base font-medium placeholder-gray-400 transition-all"
          />
        </div>
      </div>

      {/* Kembalian Status */}
      <div className={`px-5 py-5 ${status.bg}`}>
        <div className={`text-center font-bold text-xl ${status.text}`}>
          {status.message}
        </div>
      </div>

      {/* Confirm Button */}
      {typeof bayar === 'number' && bayar >= total && (
        <div className="p-4 bg-gray-50">
          <button
            onClick={handleConfirm}
            className="w-full py-4 px-4 bg-green-500 text-white font-bold text-lg
                       rounded-2xl hover:bg-green-600 transition-all active:scale-95 shadow-lg"
          >
            ✓ Selesai
          </button>
        </div>
      )}
    </div>
  );
}
