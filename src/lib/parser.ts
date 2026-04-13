/**
 * Parser untuk mengubah teks order bebas menjadi array ParsedItem[]
 * Ini adalah JANTUNG aplikasi - handle dengan hati-hati
 */

import type { Daging, Kepedasan, ParsedItem, ParseResult, Ukuran, Varian } from '../types';
import { DEFAULT_DAGING, DEFAULT_KEPEDASAN, DEFAULT_UKURAN } from './menu';

// Alias mapping untuk normalisasi teks
const KEPEDASAN_ALIASES: Record<string, Kepedasan> = {
  sedang: 'sedang',
  sedeng: 'sedang',
  pedas: 'pedas',
  pedes: 'pedas',
  pedess: 'pedas',
  'tidak pedas': 'tidak pedas',
  'gk pedes': 'tidak pedas',
  'ga pedes': 'tidak pedas',
  'ga pedas': 'tidak pedas',
  'gak pedes': 'tidak pedas',
  'gak pedas': 'tidak pedas',
  'tidak pedes': 'tidak pedas',
  'tdk pedes': 'tidak pedas',
  'tdk pedas': 'tidak pedas',
  'enggak pedas': 'tidak pedas',
  'enggak pedes': 'tidak pedas',
  'g pedes': 'tidak pedas',
  'g pedas': 'tidak pedas',
};

const VARIAN_ALIASES: Record<string, Varian> = {
  original: 'original',
  ori: 'original',
  signature: 'signature',
  sig: 'signature',
  cheesy: 'cheesy',
  cheese: 'cheesy',
  chesy: 'cheesy',
};

// Used for reference - actual detection done in detectDaging
const _DAGING_ALIASES: Record<string, Daging> = {
  chicken: 'chicken',
  ayam: 'chicken',
  'beef klasik': 'beef klasik',
  klasik: 'beef klasik',
  classic: 'beef klasik',
  'beef premium': 'beef premium',
  premium: 'beef premium',
};
void _DAGING_ALIASES; // Silence unused warning

const UKURAN_ALIASES: Record<string, Ukuran> = {
  small: 'small',
  kecil: 'small',
  reguler: 'reguler',
  regular: 'reguler',
  reg: 'reguler',
  jumbo: 'jumbo',
  besar: 'jumbo',
  gede: 'jumbo',
};

// Keywords yang dipakai menu (untuk filter nama customer)
const MENU_KEYWORDS = [
  'original', 'ori', 'signature', 'sig', 'cheesy', 'cheese',
  'chicken', 'ayam', 'beef', 'klasik', 'classic', 'premium',
  'small', 'kecil', 'reguler', 'regular', 'jumbo', 'besar',
  'pedas', 'pedes', 'sedang', 'sedeng',
];

/**
 * Strip header WA seperti "PESENAN A.N RICKY :"
 */
function stripHeader(text: string): { cleanText: string; detectedName: string } {
  let cleanText = text;
  let detectedName = '';

  // Pattern untuk header
  const headerPatterns = [
    /pesenan\s+a\.?n\.?\s*:?\s*([a-zA-Z]+)\s*:?/i,
    /order\s+a\.?n\.?\s*:?\s*([a-zA-Z]+)\s*:?/i,
    /atas\s+nama\s+([a-zA-Z]+)\s*:?/i,
    /\ba\.?n\.?\s*:?\s*([a-zA-Z]+)\s*:?/i,
  ];

  for (const pattern of headerPatterns) {
    const match = cleanText.match(pattern);
    if (match) {
      const potentialName = match[1].toLowerCase();
      // Jangan ambil kalau namanya adalah keyword menu
      if (!MENU_KEYWORDS.includes(potentialName)) {
        detectedName = match[1];
      }
      // Hapus header dari teks
      cleanText = cleanText.replace(match[0], '').trim();
      break;
    }
  }

  return { cleanText, detectedName };
}

/**
 * Split teks menjadi baris-baris item
 * Separator: newline, bullet *, •, - di awal baris
 * JANGAN split berdasarkan & (dipakai untuk kepedasan)
 */
function splitLines(text: string): string[] {
  // Normalize line separators
  let normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  // Split by bullet points
  normalized = normalized
    .replace(/[*•]/g, '\n')
    .replace(/^-\s+/gm, '\n');

  // Split dan filter empty lines
  return normalized
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

/**
 * Normalize teks - lowercase dan ganti alias
 */
function normalizeText(text: string): string {
  let normalized = text.toLowerCase().trim();

  // Hapus kata "semua" (konteks: "pedas semua")
  normalized = normalized.replace(/\bsemua\b/gi, '').trim();

  return normalized;
}

/**
 * Detect varian dari teks
 */
function detectVarian(text: string): Varian | null {
  const normalized = normalizeText(text);

  for (const [alias, varian] of Object.entries(VARIAN_ALIASES)) {
    if (normalized.includes(alias)) {
      return varian;
    }
  }
  return null;
}

/**
 * Detect daging dari teks
 */
function detectDaging(text: string): Daging {
  const normalized = normalizeText(text);

  // Check multi-word first
  if (normalized.includes('beef premium') || normalized.includes('premium')) {
    return 'beef premium';
  }
  if (normalized.includes('beef klasik') || normalized.includes('klasik') || normalized.includes('classic')) {
    return 'beef klasik';
  }
  if (normalized.includes('chicken') || normalized.includes('ayam')) {
    return 'chicken';
  }

  return DEFAULT_DAGING;
}

/**
 * Detect ukuran dari teks
 */
function detectUkuran(text: string): Ukuran {
  const normalized = normalizeText(text);

  for (const [alias, ukuran] of Object.entries(UKURAN_ALIASES)) {
    if (normalized.includes(alias)) {
      return ukuran;
    }
  }
  return DEFAULT_UKURAN;
}

/**
 * Detect kepedasan dari teks
 */
function detectKepedasan(text: string): Kepedasan {
  const normalized = normalizeText(text);

  // Check multi-word phrases first (untuk "tidak pedas" dan variasinya)
  for (const [alias, kepedasan] of Object.entries(KEPEDASAN_ALIASES)) {
    if (alias.includes(' ')) {
      if (normalized.includes(alias)) {
        return kepedasan;
      }
    }
  }

  // Check single words
  for (const [alias, kepedasan] of Object.entries(KEPEDASAN_ALIASES)) {
    if (!alias.includes(' ')) {
      // Use word boundary untuk single words
      const regex = new RegExp(`\\b${alias}\\b`, 'i');
      if (regex.test(normalized)) {
        return kepedasan;
      }
    }
  }

  return DEFAULT_KEPEDASAN;
}

/**
 * Detect qty dari teks
 * Ambil angka PERTAMA yang muncul sebelum atau tepat setelah nama varian
 */
function detectQty(text: string): number {
  const normalized = normalizeText(text);

  // Pattern: angka di awal atau sebelum/sesudah varian
  const qtyPattern = /^(\d+)\s*[x×]?\s*\w+|\b(\d+)\s*[x×]?\s*(?:ori|sig|cheese|original|signature|cheesy)|(?:ori|sig|cheese|original|signature|cheesy)\s*[x×]?\s*(\d+)/i;
  const match = normalized.match(qtyPattern);

  if (match) {
    const qty = parseInt(match[1] || match[2] || match[3], 10);
    if (!isNaN(qty) && qty > 0 && qty <= 99) {
      return qty;
    }
  }

  // Fallback: ambil angka pertama
  const firstNumber = normalized.match(/^(\d+)|\b(\d+)\b/);
  if (firstNumber) {
    const qty = parseInt(firstNumber[1] || firstNumber[2], 10);
    if (!isNaN(qty) && qty > 0 && qty <= 99) {
      return qty;
    }
  }

  return 1;
}

/**
 * Detect toppings dari teks
 */
function detectToppings(text: string): string[] {
  const normalized = normalizeText(text);
  const toppings: string[] = [];

  const toppingKeywords = ['telur', 'keju', 'beef', 'chicken'];

  for (const topping of toppingKeywords) {
    // Pattern: tambah/plus/+ topping atau topping di akhir
    const pattern = new RegExp(`(?:tambah|plus|\\+)\\s*${topping}|${topping}\\s*(?:tambah|extra)`, 'i');
    if (pattern.test(normalized)) {
      toppings.push(topping);
    }
  }

  return toppings;
}

/**
 * Detect catatan khusus
 */
function detectCatatan(text: string): string {
  const normalized = normalizeText(text);
  const catatanParts: string[] = [];

  // Pattern untuk catatan
  const patterns = [
    /gak\s+pake\s+(\w+)/gi,
    /tanpa\s+(\w+)/gi,
    /no\s+(\w+)/gi,
    /ga\s+pake\s+(\w+)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(normalized)) !== null) {
      catatanParts.push(`tanpa ${match[1]}`);
    }
  }

  return catatanParts.join(', ');
}

/**
 * Expand kepedasan dari pattern "8 sedang & 6 pedas"
 * Returns array of qty-kepedasan pairs
 */
function expandKepedasan(text: string): Array<{ qty: number; kepedasan: Kepedasan }> | null {
  const normalized = normalizeText(text);

  // Pattern: [qty] [kepedasan] (&|dan|,) [qty] [kepedasan]
  const expandPattern = /(\d+)\s*(sedang|sedeng|pedas|pedes|tidak\s+pedas|gk\s+pedes|ga\s+pedes|tdk\s+pedas)\s*[&,]\s*(\d+)\s*(sedang|sedeng|pedas|pedes|tidak\s+pedas|gk\s+pedes|ga\s+pedes|tdk\s+pedas)/i;

  const match = normalized.match(expandPattern);
  if (match) {
    const qty1 = parseInt(match[1], 10);
    const kep1 = KEPEDASAN_ALIASES[match[2].toLowerCase()] || DEFAULT_KEPEDASAN;
    const qty2 = parseInt(match[3], 10);
    const kep2 = KEPEDASAN_ALIASES[match[4].toLowerCase()] || DEFAULT_KEPEDASAN;

    return [
      { qty: qty1, kepedasan: kep1 },
      { qty: qty2, kepedasan: kep2 },
    ];
  }

  // Also check for pattern with "dan"
  const danPattern = /(\d+)\s*(sedang|sedeng|pedas|pedes|tidak\s+pedas|gk\s+pedes|ga\s+pedes|tdk\s+pedas)\s+dan\s+(\d+)\s*(sedang|sedeng|pedas|pedes|tidak\s+pedas|gk\s+pedes|ga\s+pedes|tdk\s+pedas)/i;
  const danMatch = normalized.match(danPattern);
  if (danMatch) {
    const qty1 = parseInt(danMatch[1], 10);
    const kep1 = KEPEDASAN_ALIASES[danMatch[2].toLowerCase()] || DEFAULT_KEPEDASAN;
    const qty2 = parseInt(danMatch[3], 10);
    const kep2 = KEPEDASAN_ALIASES[danMatch[4].toLowerCase()] || DEFAULT_KEPEDASAN;

    return [
      { qty: qty1, kepedasan: kep1 },
      { qty: qty2, kepedasan: kep2 },
    ];
  }

  return null;
}

/**
 * Parse satu baris menjadi ParsedItem atau array ParsedItem
 */
function parseLine(line: string): ParsedItem[] {
  const items: ParsedItem[] = [];

  // Check for expanded kepedasan first
  const expanded = expandKepedasan(line);
  if (expanded) {
    // Extract common properties
    const varian = detectVarian(line);
    const daging = detectDaging(line);
    const ukuran = detectUkuran(line);
    const toppings = detectToppings(line);
    const catatan = detectCatatan(line);

    for (const { qty, kepedasan } of expanded) {
      items.push({
        varian,
        daging,
        ukuran,
        kepedasan,
        toppings,
        catatan,
        qty,
        missing: varian ? [] : ['varian'],
      });
    }
  } else {
    // Normal parsing
    const varian = detectVarian(line);
    const daging = detectDaging(line);
    const ukuran = detectUkuran(line);
    const kepedasan = detectKepedasan(line);
    const toppings = detectToppings(line);
    const catatan = detectCatatan(line);
    const qty = detectQty(line);

    items.push({
      varian,
      daging,
      ukuran,
      kepedasan,
      toppings,
      catatan,
      qty,
      missing: varian ? [] : ['varian'],
    });
  }

  return items;
}

/**
 * Check if a line is only qty + kepedasan (breakdown line)
 * e.g., "1 pedes", "2 nggak pedes", "3 sedang"
 */
function isBreakdownLine(line: string): boolean {
  const normalized = normalizeText(line);

  // Pattern: hanya angka + kepedasan (dengan variasi)
  const breakdownPattern = /^\d+\s*(pedes|pedas|sedang|sedeng|tidak\s*pedas|gk\s*pedes|ga\s*pedes|gak\s*pedes|nggak\s*pedes|enggak\s*pedes|tdk\s*pedes|g\s*pedes)$/i;

  return breakdownPattern.test(normalized);
}

/**
 * Parse breakdown line to get qty and kepedasan
 */
function parseBreakdownLine(line: string): { qty: number; kepedasan: Kepedasan } | null {
  const normalized = normalizeText(line);

  const match = normalized.match(/^(\d+)\s*(.+)$/);
  if (!match) return null;

  const qty = parseInt(match[1], 10);
  const kepText = match[2].trim();

  // Find kepedasan
  for (const [alias, kepedasan] of Object.entries(KEPEDASAN_ALIASES)) {
    if (kepText.includes(alias) || alias.includes(kepText)) {
      return { qty, kepedasan };
    }
  }

  // Check for common variations
  if (kepText.includes('nggak') || kepText.includes('enggak')) {
    return { qty, kepedasan: 'tidak pedas' };
  }

  return null;
}

/**
 * Main parser function
 */
export function parseOrder(rawText: string): ParseResult {
  if (!rawText || !rawText.trim()) {
    return {
      items: [],
      namaCustomer: '',
      hasMissingVarian: false,
    };
  }

  // Step 1: Strip header dan detect nama
  const { cleanText, detectedName } = stripHeader(rawText);

  // Step 2: Split menjadi baris
  const lines = splitLines(cleanText);

  // Step 3: Parse dengan context awareness untuk multi-line patterns
  const items: ParsedItem[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const parsedItems = parseLine(line);

    // Check if this is a header line followed by breakdown lines
    if (parsedItems.length === 1 && parsedItems[0].varian !== null) {
      const headerItem = parsedItems[0];
      const breakdowns: Array<{ qty: number; kepedasan: Kepedasan }> = [];

      // Look ahead for breakdown lines
      let j = i + 1;
      while (j < lines.length && isBreakdownLine(lines[j])) {
        const breakdown = parseBreakdownLine(lines[j]);
        if (breakdown) {
          breakdowns.push(breakdown);
        }
        j++;
      }

      // Check if breakdowns sum equals header qty
      if (breakdowns.length > 0) {
        const breakdownTotal = breakdowns.reduce((sum, b) => sum + b.qty, 0);

        if (breakdownTotal === headerItem.qty) {
          // Valid breakdown pattern - create items from breakdowns
          for (const { qty, kepedasan } of breakdowns) {
            items.push({
              ...headerItem,
              qty,
              kepedasan,
            });
          }
          i = j; // Skip processed breakdown lines
          continue;
        }
      }
    }

    // Normal processing - add items as-is
    items.push(...parsedItems);
    i++;
  }

  // Step 4: Check if any item missing varian
  const hasMissingVarian = items.some(item => item.varian === null);

  return {
    items,
    namaCustomer: detectedName,
    hasMissingVarian,
  };
}

/**
 * Apply varian ke semua item yang missing
 */
export function applyMissingVarian(items: ParsedItem[], varian: Varian): ParsedItem[] {
  return items.map(item => {
    if (item.varian === null) {
      return {
        ...item,
        varian,
        missing: item.missing.filter(m => m !== 'varian'),
      };
    }
    return item;
  });
}

/**
 * Format item untuk display
 */
export function formatItemDescription(item: ParsedItem): string {
  const parts: string[] = [];

  if (item.varian) {
    parts.push(item.varian.charAt(0).toUpperCase() + item.varian.slice(1));
  }
  parts.push(item.ukuran.charAt(0).toUpperCase() + item.ukuran.slice(1));

  if (item.daging === 'chicken') {
    parts.push('Chicken');
  } else if (item.daging === 'beef premium') {
    parts.push('Beef Premium');
  } else {
    parts.push('Beef Klasik');
  }

  return parts.join(' ');
}
