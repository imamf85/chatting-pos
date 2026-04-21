// Core domain types

export type Varian = 'original' | 'signature' | 'cheesy';
export type Daging = 'chicken' | 'beef klasik' | 'beef premium';
export type Ukuran = 'small' | 'reguler' | 'jumbo';
export type Kepedasan = 'tidak pedas' | 'sedang' | 'pedas';
export type Role = 'owner' | 'karyawan';
export type PaymentMethod = 'qris' | 'cash';

export interface Lapak {
  id: string;
  nama: string;
  alamat?: string;
  created_at?: string;
}

export interface UserProfile {
  id: string;
  nama: string;
  role: Role;
  lapak_id: string | null; // null = owner (bisa akses semua)
  created_at?: string;
}

export interface ParsedItem {
  varian: Varian | null;
  daging: Daging;
  ukuran: Ukuran;
  kepedasan: Kepedasan;
  toppings: string[];
  catatan: string;
  qty: number;
  missing: string[]; // field yang belum terisi
}

export interface OrderItem extends Omit<ParsedItem, 'varian' | 'missing'> {
  varian: Varian;
  harga_satuan: number; // dalam ribuan
  subtotal: number; // dalam ribuan
}

export interface Transaksi {
  id: string;
  lapak_id: string;
  created_by: string;
  tx_number: number;
  nama_customer: string;
  total: number; // dalam ribuan
  bayar: number;
  kembalian: number;
  payment_method: PaymentMethod | null;
  created_at: string;
}

export interface TransaksiWithItems extends Transaksi {
  items: OrderItem[];
}

export interface TransaksiItem {
  id: string;
  transaksi_id: string;
  varian: Varian;
  daging: Daging;
  ukuran: Ukuran;
  kepedasan: Kepedasan;
  toppings: string[];
  catatan: string;
  qty: number;
  harga_satuan: number;
  subtotal: number;
}

// Parser result
export interface ParseResult {
  items: ParsedItem[];
  namaCustomer: string;
  hasMissingVarian: boolean;
}
