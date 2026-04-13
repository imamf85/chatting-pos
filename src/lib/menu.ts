// Data menu & harga - SOURCE OF TRUTH
// Semua harga dalam RIBUAN RUPIAH (Rp 15.000 = 15)

import type { Daging, Ukuran, Varian } from '../types';

export const HARGA: Record<Varian, Record<Daging, Record<Ukuran, number>>> = {
  original: {
    chicken: { small: 10, reguler: 14, jumbo: 16 },
    'beef klasik': { small: 10, reguler: 14, jumbo: 16 },
    'beef premium': { small: 13, reguler: 16, jumbo: 19 },
  },
  signature: {
    chicken: { small: 11, reguler: 15, jumbo: 17 },
    'beef klasik': { small: 11, reguler: 15, jumbo: 17 },
    'beef premium': { small: 14, reguler: 17, jumbo: 20 },
  },
  cheesy: {
    chicken: { small: 11, reguler: 15, jumbo: 17 },
    'beef klasik': { small: 11, reguler: 15, jumbo: 17 },
    'beef premium': { small: 14, reguler: 17, jumbo: 20 },
  },
};

export const TOPPING_HARGA: Record<string, number> = {
  telur: 3,
  keju: 2,
  beef: 6,
  chicken: 5,
};

export const DEFAULT_DAGING: Daging = 'beef klasik';
export const DEFAULT_UKURAN: Ukuran = 'reguler';
export const DEFAULT_KEPEDASAN = 'sedang' as const;

// Helper to calculate item price
export function calculateItemPrice(
  varian: Varian,
  daging: Daging,
  ukuran: Ukuran,
  toppings: string[]
): number {
  const basePrice = HARGA[varian][daging][ukuran];
  const toppingPrice = toppings.reduce((sum, t) => {
    const normalizedTopping = t.toLowerCase().trim();
    return sum + (TOPPING_HARGA[normalizedTopping] || 0);
  }, 0);
  return basePrice + toppingPrice;
}

// Available options for UI
export const VARIAN_OPTIONS: Varian[] = ['original', 'signature', 'cheesy'];
export const DAGING_OPTIONS: Daging[] = ['chicken', 'beef klasik', 'beef premium'];
export const UKURAN_OPTIONS: Ukuran[] = ['small', 'reguler', 'jumbo'];
export const KEPEDASAN_OPTIONS = ['tidak pedas', 'sedang', 'pedas'] as const;
export const TOPPING_OPTIONS = Object.keys(TOPPING_HARGA);

// Display labels
export const VARIAN_LABELS: Record<Varian, string> = {
  original: 'Original',
  signature: 'Signature',
  cheesy: 'Cheesy',
};

export const DAGING_LABELS: Record<Daging, string> = {
  chicken: 'Chicken',
  'beef klasik': 'Beef Klasik',
  'beef premium': 'Beef Premium',
};

export const UKURAN_LABELS: Record<Ukuran, string> = {
  small: 'Small',
  reguler: 'Reguler',
  jumbo: 'Jumbo',
};
