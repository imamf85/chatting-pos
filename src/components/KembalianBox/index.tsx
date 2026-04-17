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
    // Remove non-numeric characters for cleaner input
    const cleanValue = value.replace(/\D/g, '');
    setCustomInput(cleanValue);

    const parsed = parseInt(cleanValue, 10);
    if (!isNaN(parsed) && parsed > 0) {
      // User inputs full rupiah (e.g., 50000), convert to ribuan for internal use
      setBayar(Math.floor(parsed / 1000));
    } else {
      setBayar('');
    }
  };

  // Format input display with thousand separators
  const formatInputDisplay = (value: string) => {
    if (!value) return '';
    const num = parseInt(value, 10);
    if (isNaN(num)) return value;
    return num.toLocaleString('id-ID');
  };

  const handleConfirm = () => {
    if (typeof bayar === 'number' && bayar >= total) {
      onPaymentComplete(bayar, kembalian);
    }
  };

  const formatRupiah = (ribuan: number) => {
    return `Rp ${(ribuan * 1000).toLocaleString('id-ID')}`;
  };

  // Format nominal button (show full rupiah without "Rp" prefix)
  const formatNominal = (ribuan: number) => {
    return (ribuan * 1000).toLocaleString('id-ID');
  };

  // Status styling
  const getStatusStyle = () => {
    if (typeof bayar !== 'number') {
      return {
        bg: 'bg-gray-100 dark:bg-gray-700',
        text: 'text-gray-500 dark:text-gray-400',
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
        bg: 'bg-gradient-to-r from-amber-400 to-emerald-400',
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
    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 dark:bg-gray-900/50 px-5 py-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <span className="text-gray-500 dark:text-gray-400 font-medium">Total Bayar</span>
          <span className="text-2xl font-bold text-emerald-500">
            {formatRupiah(total)}
          </span>
        </div>
      </div>

      {/* Quick Nominals */}
      <div className="p-4">
        <div className="text-sm text-gray-500 dark:text-gray-400 mb-3 font-medium">Pilih nominal:</div>
        <div className="grid grid-cols-3 gap-2">
          {relevantNominals.map((nominal) => (
            <button
              key={nominal}
              onClick={() => handleNominalClick(nominal)}
              className={`py-4 px-2 rounded-2xl font-semibold text-base transition-all active:scale-95 ${
                bayar === nominal
                  ? 'bg-emerald-500 text-white shadow-lg'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {formatNominal(nominal)}
            </button>
          ))}
        </div>

        {/* Custom input */}
        <div className="mt-4">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 font-medium">Rp</span>
            <input
              type="text"
              inputMode="numeric"
              value={formatInputDisplay(customInput)}
              onChange={(e) => handleCustomChange(e.target.value)}
              placeholder="Ketik nominal lain..."
              className="w-full pl-12 pr-4 py-4 bg-gray-100 dark:bg-gray-700 border-0 rounded-2xl
                         focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-gray-600
                         text-base font-medium text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-all"
            />
          </div>
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
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50">
          <button
            onClick={handleConfirm}
            className="w-full py-4 px-4 bg-green-500 text-white font-bold text-lg
                       rounded-2xl hover:bg-green-600 transition-all active:scale-95 shadow-lg"
          >
            Selesai
          </button>
        </div>
      )}
    </div>
  );
}
