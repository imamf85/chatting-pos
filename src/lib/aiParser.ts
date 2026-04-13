/**
 * AI Parser Service
 * Menggunakan LLM untuk menerjemahkan input karyawan ke format terstruktur
 */

const AI_BASE_URL = import.meta.env.VITE_AI_BASE_URL || 'https://ai.sumopod.com/v1';
const AI_API_KEY = import.meta.env.VITE_AI_API_KEY || '';
const AI_MODEL = import.meta.env.VITE_AI_MODEL || 'gpt-4o-mini';

// Check if AI is configured
export const isAIEnabled = (): boolean => {
  return !!AI_API_KEY;
};

// System prompt untuk parsing order kebab
const SYSTEM_PROMPT = `Kamu adalah asisten untuk POS Kebab AL Bewok. Tugasmu adalah menerjemahkan pesanan dari karyawan ke format JSON yang terstruktur.

Menu yang tersedia:
- Varian: original, signature, cheesy
- Ukuran: small, reguler, jumbo
- Daging: chicken, beef klasik, beef premium
- Kepedasan: tidak pedas, sedang, pedas
- Topping: telur (+3k), keju (+2k), beef (+6k), chicken (+5k)

Alias yang sering dipakai:
- sig/signature, ori/original, cheese/cheesy
- ayam = chicken, klasik/classic = beef klasik, premium = beef premium
- pedes/pedas, sedeng/sedang, gk pedes/ga pedes/nggak pedes/tdk pedes = tidak pedas
- small/kecil, reg/reguler, jumbo/besar/gede

PENTING:
1. Jika ada pola seperti "3 kebab, 1 pedas 2 tidak pedas" artinya TOTAL 3 dengan breakdown kepedasan
2. Jika tidak disebutkan, default: beef klasik, reguler, sedang
3. Deteksi nama customer dari "a.n.", "atas nama", "pesenan"
4. Jika varian tidak disebutkan, set varian = null

Output dalam format JSON array:
{
  "nama_customer": "nama atau kosong",
  "items": [
    {
      "varian": "signature" atau null,
      "ukuran": "jumbo",
      "daging": "beef klasik",
      "kepedasan": "pedas",
      "qty": 1,
      "toppings": [],
      "catatan": ""
    }
  ]
}

HANYA output JSON, tanpa penjelasan.`;

interface AIOrderItem {
  varian: string | null;
  ukuran: string;
  daging: string;
  kepedasan: string;
  qty: number;
  toppings: string[];
  catatan: string;
}

interface AIParseResult {
  nama_customer: string;
  items: AIOrderItem[];
}

/**
 * Parse order menggunakan AI
 */
export async function parseWithAI(input: string): Promise<AIParseResult | null> {
  if (!AI_API_KEY) {
    console.warn('AI API key not configured');
    return null;
  }

  try {
    const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: input },
        ],
        max_tokens: 1000,
        temperature: 0.1, // Low temperature for consistent parsing
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('AI API error:', error);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error('No content in AI response');
      return null;
    }

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }

    const parsed: AIParseResult = JSON.parse(jsonStr);
    return parsed;
  } catch (error) {
    console.error('AI parsing error:', error);
    return null;
  }
}

/**
 * Convert AI result to ParsedItem format
 */
export function convertAIResultToItems(aiResult: AIParseResult): {
  items: Array<{
    varian: 'original' | 'signature' | 'cheesy' | null;
    daging: 'chicken' | 'beef klasik' | 'beef premium';
    ukuran: 'small' | 'reguler' | 'jumbo';
    kepedasan: 'tidak pedas' | 'sedang' | 'pedas';
    toppings: string[];
    catatan: string;
    qty: number;
    missing: string[];
  }>;
  namaCustomer: string;
} {
  const items = aiResult.items.map((item) => {
    // Normalize varian
    let varian: 'original' | 'signature' | 'cheesy' | null = null;
    if (item.varian) {
      const v = item.varian.toLowerCase();
      if (v.includes('ori')) varian = 'original';
      else if (v.includes('sig')) varian = 'signature';
      else if (v.includes('chees')) varian = 'cheesy';
    }

    // Normalize daging
    let daging: 'chicken' | 'beef klasik' | 'beef premium' = 'beef klasik';
    const d = item.daging.toLowerCase();
    if (d.includes('chicken') || d.includes('ayam')) daging = 'chicken';
    else if (d.includes('premium')) daging = 'beef premium';
    else daging = 'beef klasik';

    // Normalize ukuran
    let ukuran: 'small' | 'reguler' | 'jumbo' = 'reguler';
    const u = item.ukuran.toLowerCase();
    if (u.includes('small') || u.includes('kecil')) ukuran = 'small';
    else if (u.includes('jumbo') || u.includes('besar')) ukuran = 'jumbo';
    else ukuran = 'reguler';

    // Normalize kepedasan
    let kepedasan: 'tidak pedas' | 'sedang' | 'pedas' = 'sedang';
    const k = item.kepedasan.toLowerCase();
    if (k.includes('tidak') || k.includes('gak') || k.includes('ga ') || k.includes('nggak')) {
      kepedasan = 'tidak pedas';
    } else if (k.includes('pedas') || k.includes('pedes')) {
      kepedasan = 'pedas';
    } else {
      kepedasan = 'sedang';
    }

    return {
      varian,
      daging,
      ukuran,
      kepedasan,
      toppings: item.toppings || [],
      catatan: item.catatan || '',
      qty: item.qty || 1,
      missing: varian ? [] : ['varian'],
    };
  });

  return {
    items,
    namaCustomer: aiResult.nama_customer || '',
  };
}
