# CLAUDE.md — AL Bewok POS

Dokumen ini adalah panduan lengkap untuk Claude Code dalam mengembangkan aplikasi POS AL Bewok. Baca seluruh dokumen sebelum menulis satu baris kode pun.

---

## Konteks bisnis

**AL Bewok** adalah usaha kebab dengan **2 lapak** di lokasi berbeda. Setiap lapak dijaga 1 karyawan.

### Struktur tim

| Role | Jumlah | Akses |
|---|---|---|
| Owner | 3 orang | Semua lapak — POS + rekap |
| Karyawan | 2 orang | Lapaknya sendiri saja — POS + rekap |

**Total user: 5 akun.** Setiap orang punya akun sendiri (username + password).

### Masalah utama yang dipecahkan

- Tidak ada pencatatan order yang terstruktur — karyawan selama ini mencatat via chat WA pribadi
- Karyawan rata-rata tidak melek teknologi — UI harus sesimpel mungkin
- Pemilik tidak punya visibilitas omzet harian yang akurat di kedua lapak

**Filosofi UX utama:** Input order harus semudah mengetik di WhatsApp. Karyawan tidak boleh dipaksa belajar UI baru yang kompleks.

---

## Arsitektur aplikasi

### Tech stack

```
Frontend  : React + Vite + TypeScript
Styling   : Tailwind CSS
Backend   : Supabase (auth, database, realtime)
Print     : Browser Print API (window.print) — target printer thermal 58mm/80mm
Hosting   : Vercel
```

### Struktur halaman

```
/login              → Login semua user (username + password)
/order              → Halaman POS — input order via chat
/rekap              → Rekap harian per lapak
```

### Routing & akses per role

```
Karyawan setelah login:
  → langsung ke /order (lapaknya sendiri, tidak bisa ganti)
  → bisa navigasi ke /rekap (hanya data lapaknya)
  → tidak ada lapak switcher

Owner setelah login:
  → ke /order dengan lapak switcher di topbar
  → bisa navigasi ke /rekap dengan lapak switcher yang sama
  → bisa ganti lapak kapan saja tanpa logout
```

### Struktur folder

```
src/
  components/
    OrderChat/        → Komponen chat input + order card
    KembalianBox/     → Kalkulator kembalian
    RekapDashboard/   → Dashboard rekap per lapak
    LapakSwitcher/    → Dropdown ganti lapak (owner only)
    ProtectedRoute/   → Guard route berdasarkan role
  lib/
    parser.ts         → AI parser — JANGAN disentuh tanpa baca bagian Parser dulu
    menu.ts           → Data menu & harga — source of truth
    supabase.ts       → Supabase client
    auth.ts           → Helper auth & session
  pages/
    Login.tsx
    Order.tsx
    Rekap.tsx
  types/
    index.ts          → Semua TypeScript types
  hooks/
    useAuth.ts        → Current user, role, lapak_id aktif
    useActiveLapak.ts → Lapak yang sedang dipilih (owner bisa switch)
```

---

## Database schema (Supabase)

```sql
-- Lapak (cabang/outlet) — seed 2 lapak saat setup
create table lapak (
  id uuid primary key default gen_random_uuid(),
  nama text not null,           -- misal: 'Lapak Timur', 'Lapak Barat'
  alamat text,
  created_at timestamptz default now()
);

-- User profiles — extend Supabase auth.users
-- Role dan lapak ditentukan di sini, bukan di auth
create table user_profile (
  id uuid primary key references auth.users(id) on delete cascade,
  nama text not null,
  role text not null check (role in ('owner', 'karyawan')),
  lapak_id uuid references lapak(id),  -- NULL kalau owner (bisa akses semua)
  created_at timestamptz default now()
);

-- Transaksi (1 transaksi = 1 customer)
create table transaksi (
  id uuid primary key default gen_random_uuid(),
  lapak_id uuid references lapak(id) not null,
  created_by uuid references auth.users(id),  -- siapa yang input
  tx_number int not null,          -- nomor urut per lapak per hari: #TX-001
  nama_customer text,              -- nullable
  total integer not null,          -- dalam RIBUAN. Rp 47.000 → 47
  bayar integer default 0,
  kembalian integer default 0,
  created_at timestamptz default now()
);

-- Index untuk tx_number per lapak per hari
create index idx_transaksi_lapak_date on transaksi(lapak_id, (created_at::date));

-- Item dalam tiap transaksi
create table transaksi_item (
  id uuid primary key default gen_random_uuid(),
  transaksi_id uuid references transaksi(id) on delete cascade,
  varian text not null check (varian in ('original','signature','cheesy')),
  daging text not null check (daging in ('chicken','beef klasik','beef premium')),
  ukuran text not null check (ukuran in ('small','reguler','jumbo')),
  kepedasan text not null check (kepedasan in ('tidak pedas','sedang','pedas')),
  toppings text[] default '{}',
  catatan text default '',
  qty integer not null default 1,
  harga_satuan integer not null,
  subtotal integer not null
);
```

### Row Level Security (RLS)

RLS **wajib diaktifkan** di semua tabel. Policy yang harus dibuat:

```sql
-- transaksi: karyawan hanya bisa baca/tulis lapak sendiri
-- owner bisa baca/tulis semua lapak

create policy "karyawan_own_lapak" on transaksi
  using (
    lapak_id = (select lapak_id from user_profile where id = auth.uid())
    or
    (select role from user_profile where id = auth.uid()) = 'owner'
  );

-- Berlaku sama untuk transaksi_item (via transaksi_id join)
```

**Catatan penting soal angka:** Semua harga disimpan dalam **ribuan rupiah** sebagai integer. Rp 15.000 disimpan sebagai `15`. Ini menghindari floating point. Saat display, kalikan 1000.

---

## Data menu (source of truth)

File: `src/lib/menu.ts`

```typescript
export const HARGA: Record<string, Record<string, Record<string, number>>> = {
  original: {
    chicken:       { small: 10, reguler: 14, jumbo: 16 },
    'beef klasik': { small: 10, reguler: 14, jumbo: 16 },
    'beef premium':{ small: 13, reguler: 16, jumbo: 19 },
  },
  signature: {
    chicken:       { small: 11, reguler: 15, jumbo: 17 },
    'beef klasik': { small: 11, reguler: 15, jumbo: 17 },
    'beef premium':{ small: 14, reguler: 17, jumbo: 20 },
  },
  cheesy: {
    chicken:       { small: 11, reguler: 15, jumbo: 17 },
    'beef klasik': { small: 11, reguler: 15, jumbo: 17 },
    'beef premium':{ small: 14, reguler: 17, jumbo: 20 },
  },
};

export const TOPPING_HARGA: Record<string, number> = {
  telur: 3,
  keju:  2,
  beef:  6,
  chicken: 5,
};

export const DEFAULT_DAGING = 'beef klasik';
export const DEFAULT_UKURAN = 'reguler';
export const DEFAULT_KEPEDASAN = 'sedang';
```

---

## Parser — logika & aturan (PALING PENTING)

File: `src/lib/parser.ts`

Parser adalah jantung aplikasi. Tugasnya: mengubah teks bebas menjadi array `ParsedItem[]`.

### Alur parser

```
Input teks mentah
  → stripHeader()       — buang "PESENAN A.N RICKY :" dll
  → splitLines()        — pisah per baris/bullet
  → per baris:
      normalizeText()   — normalisasi alias & typo
      expandKepedasan() — handle "8 sedang & 6 pedas" → 2 item
      detectVarian/Daging/Ukuran/Kepedasan/Qty/Toppings/Note()
  → validasi missing fields
  → return ParsedItem[]
```

### `normalizeText()` — alias yang WAJIB dikenali

```typescript
// Kepedasan
'sedeng'           → 'sedang'
'pedes', 'pedess'  → 'pedas'
'gk pedes', 'ga pedes', 'ga pedas', 'tidak pedes',
'tdk pedes', 'tdk pedas', 'enggak pedas'  → 'tidak pedas'

// Varian
'sig'   → 'signature'
'ori'   → 'original'
'cheese'→ 'cheesy'

// Daging
'ayam'    → 'chicken'
'klasik'  → 'beef klasik'
'classic' → 'beef klasik'   // ← karyawan sering nulis ini
'premium' → 'beef premium'

// Lain-lain
'semua'   → dihapus (konteks: "pedas semua")
'gak pake X', 'tanpa X', 'no X' → catatan per item
```

### `stripHeader()` — buang header WA

Pattern yang harus dibuang dari awal teks:
- `PESENAN A.N RICKY :`
- `pesenan an faisal:`
- `order a.n budi`
- `atas nama siti`

Setelah strip header, sisa teks baru di-split per baris.

### `splitLines()` — separator yang valid

Pisah baris berdasarkan: newline `\n`, bullet `*`, `•`, tanda `-` di awal baris.

**JANGAN** split berdasarkan `&` — itu dipakai sebagai pemisah kepedasan dalam 1 item.

### `expandKepedasan()` — KASUS KHUSUS TERPENTING

Input: `"8 sedang & 6 pedas"` dalam 1 chunk dengan varian/ukuran yang sama.

Logika: cari pattern `[qty] [kepedasan] (&|dan|,) [qty] [kepedasan]` dalam 1 baris. Kalau ketemu, pecah jadi 2 item terpisah dengan varian/daging/ukuran yang diwarisi dari konteks baris.

Output:
```
[
  { qty: 8, kepedasan: 'sedang', varian: 'signature', ... },
  { qty: 6, kepedasan: 'pedas',  varian: 'signature', ... },
]
```

### `detectNama()` — auto-detect nama customer

Scan teks mentah (sebelum normalize) dengan pattern:
```
/pesenan\s+a\.?n\.?\s*:?\s*([A-Za-z]+)/i
/order\s+a\.?n\.?\s*:?\s*([A-Za-z]+)/i
/atas\s+nama\s+([A-Za-z]+)/i
/\ba\.?n\.?\s*:?\s*([A-Za-z]+)/i
```

Kalau hasil match adalah keyword menu (original, cheesy, dll), abaikan.

### Default values

| Field | Default | Kapan berlaku |
|---|---|---|
| `daging` | `'beef klasik'` | Tidak disebutkan |
| `ukuran` | `'reguler'` | Tidak disebutkan |
| `kepedasan` | `'sedang'` | Tidak disebutkan |
| `qty` | `1` | Tidak ada angka |
| `varian` | ❌ wajib ada | Selalu tanya balik kalau tidak ada |

### Aturan qty

Ambil angka **pertama** yang muncul sebelum atau tepat setelah nama varian. Abaikan angka yang muncul di akhir kalimat setelah kata non-angka (misal: `"...bombay 1"` — angka `1` ini ambigu, lebih aman diabaikan).

### Tanya balik (clarification flow)

Satu-satunya field yang memicu tanya balik adalah **varian**. Tidak ada field lain yang tanya balik — pakai default saja.

Contoh response tanya balik:
> "Ada 2 item yang variannya belum jelas. Original, Signature, atau Cheesy?"

Setelah user reply, apply varian tersebut ke semua item yang missing.

---

## TypeScript types

```typescript
// src/types/index.ts

export type Varian = 'original' | 'signature' | 'cheesy';
export type Daging = 'chicken' | 'beef klasik' | 'beef premium';
export type Ukuran = 'small' | 'reguler' | 'jumbo';
export type Kepedasan = 'tidak pedas' | 'sedang' | 'pedas';
export type Role = 'owner' | 'karyawan';

export interface Lapak {
  id: string;
  nama: string;
  alamat?: string;
}

export interface UserProfile {
  id: string;
  nama: string;
  role: Role;
  lapak_id: string | null;  // null = owner (bisa akses semua)
}

export interface ParsedItem {
  varian: Varian | null;
  daging: Daging;
  ukuran: Ukuran;
  kepedasan: Kepedasan;
  toppings: string[];
  catatan: string;
  qty: number;
  missing: string[];
}

export interface OrderItem extends ParsedItem {
  varian: Varian;
  harga_satuan: number;     // dalam ribuan
  subtotal: number;         // dalam ribuan
}

export interface Transaksi {
  id: string;
  lapak_id: string;
  created_by: string;
  tx_number: number;
  nama_customer: string;
  items: OrderItem[];
  total: number;            // dalam ribuan
  bayar: number;
  kembalian: number;
  created_at: string;
}
```

### Hooks

```typescript
// src/hooks/useAuth.ts
// Mengembalikan current user + profile
const { user, profile, loading } = useAuth();
// user: Supabase User | null
// profile: UserProfile | null
// loading: boolean

// src/hooks/useActiveLapak.ts
// Mengelola lapak yang sedang aktif di-view
const { activeLapak, setActiveLapak, availableLapaks } = useActiveLapak();
// Untuk karyawan: activeLapak selalu lapaknya sendiri, setActiveLapak no-op
// Untuk owner: activeLapak bisa diganti, availableLapaks = semua lapak
```

---

## Komponen utama

### `<OrderChat />`

Komponen halaman utama karyawan. State machine sederhana:

```
idle → user ketik → parsing → 
  if missing varian → state: waitingClarification
  if complete → state: showOrderCard
```

State `waitingClarification` menyimpan item-item yang sudah di-parse tapi belum punya varian. Ketika user reply, apply varian lalu lanjut ke `showOrderCard`.

### `<OrderCard />`

Ditampilkan setelah parsing sukses. Berisi:
- Field **a.n.** — auto-filled dari `detectNama()`, bisa di-tap untuk edit inline
- List item — setiap item punya tombol pensil untuk catatan
- Total harga
- Tombol **Simpan order** dan **Batalkan**

Setelah Simpan → ganti tombol dengan `<KembalianBox />` + badge tersimpan + tombol Print struk.

### `<KembalianBox />`

Props: `total: number` (dalam ribuan)

Tampilkan:
- Grid nominal cepat — pilih nominal uang kertas yang relevan (>= total), maks 8 tombol
- Input manual untuk nominal custom
- Hasil kembalian: hijau (ada kembalian), kuning/amber (pas), merah (kurang)

Nominal cepat yang disarankan: 5, 10, 20, 50, 100, 200, 500, 1000 (ribuan). Filter: tampilkan yang paling dekat dengan total ke atas.

### `<RekapDashboard />`

Diakses oleh karyawan dan owner. Data diambil dari Supabase, filter `lapak_id = activeLapak.id` dan `created_at::date = today`.

Tampilkan:
- Nama lapak yang sedang dilihat (penting untuk owner yang bisa switch)
- Total omzet hari ini
- Total kebab terjual
- Rata-rata per transaksi
- Menu terlaris (top 4, sorted by qty)
- Riwayat transaksi (newest first) — tampilkan nama customer, items, total, bayar, kembalian

Owner yang ingin lihat lapak lain cukup ganti via `LapakSwitcher` di topbar — tidak perlu halaman terpisah.

---

## Fitur print struk

Gunakan `window.open()` untuk buka tab baru dengan HTML struk, lalu `window.print()`.

Format struk thermal (lebar 32 karakter, font monospace):

```
        AL BEWOK KEBAB
   Rasa Nikmat, Harga Bersahabat
--------------------------------
No  : #TX-001
Tgl : 13/04/2026  14:35
A.n.: Ricky
--------------------------------
Kebab Signature Jumbo
  Beef Klasik - Pedas
1xRp17k              Rp 17k
--------------------------------
TOTAL           Rp 17.000
BAYAR           Rp 20.000
KEMBALIAN        Rp 3.000
--------------------------------

     Terima kasih sudah jajan!
      Sering-sering ya :)
```

CSS print:
```css
@media print {
  @page { margin: 0; size: 58mm auto; }
  body { font-family: 'Courier New', monospace; font-size: 11px; }
}
```

---

## Auth, roles & multi-lapak

### Login flow

Semua user login via halaman `/login` dengan **username + password** menggunakan Supabase Auth.

Setelah login, fetch `user_profile` untuk tahu role dan lapak:

```typescript
// src/lib/auth.ts
export async function getProfileAfterLogin(userId: string): Promise<UserProfile> {
  const { data } = await supabase
    .from('user_profile')
    .select('*')
    .eq('id', userId)
    .single();
  return data;
}
```

### Redirect setelah login

```
if role === 'karyawan' → /order (lapak_id dari profile, tidak bisa ganti)
if role === 'owner'    → /order (dengan lapak switcher, default lapak pertama)
```

### LapakSwitcher — owner only

Komponen dropdown di topbar, **hanya muncul kalau role = owner**.

```tsx
// Tampil di topbar sebelah kanan, hanya untuk owner
<LapakSwitcher
  lapaks={availableLapaks}
  active={activeLapak}
  onChange={setActiveLapak}
/>
```

Saat owner ganti lapak via switcher:
- State `activeLapak` di-update di `useActiveLapak` hook
- Halaman `/order` dan `/rekap` re-fetch data dengan `lapak_id` baru
- Tidak ada logout, tidak ada page reload

### ProtectedRoute

```tsx
// Semua route kecuali /login dibungkus ProtectedRoute
<ProtectedRoute>
  <Order />
</ProtectedRoute>

// ProtectedRoute cek: ada session? ada profile? kalau tidak → redirect /login
```

### Permission matrix lengkap

| Aksi | Karyawan | Owner |
|---|---|---|
| Login | ✅ | ✅ |
| Input order | Lapaknya saja | Semua lapak (via switcher) |
| Lihat rekap harian | Lapaknya saja | Semua lapak (via switcher) |
| Ganti lapak aktif | ❌ (tidak ada switcher) | ✅ |
| Lihat data lapak lain | ❌ (RLS block di DB) | ✅ |
| Manajemen user/lapak | ❌ | Backlog |

### Seed data awal

Buat file `supabase/seed.sql` untuk setup awal:

```sql
-- 2 lapak
insert into lapak (id, nama, alamat) values
  ('uuid-lapak-1', 'Lapak Timur', 'Alamat lapak timur'),
  ('uuid-lapak-2', 'Lapak Barat', 'Alamat lapak barat');

-- User dibuat via Supabase Auth dashboard atau script
-- Setelah user dibuat, insert profile:
-- 3 owner (lapak_id = null)
-- 2 karyawan (lapak_id sesuai lapaknya)
```

---

## UX rules yang tidak boleh dilanggar

1. **Tidak ada loading spinner panjang** — parsing harus < 1 detik (semua client-side)
2. **Konfirmasi sebelum simpan** — selalu tampilkan order card dulu, jangan auto-save
3. **Tanya balik hanya untuk varian** — field lain pakai default, jangan tanya
4. **Satu input = satu customer** — jangan gabung order beda customer
5. **Nama customer opsional** — tidak boleh block simpan kalau nama kosong
6. **Kembalian muncul otomatis** setelah simpan — tidak perlu navigasi ke halaman lain
7. **Mobile-first** — semua touch target minimum 44px, font minimum 13px
8. **Offline-tolerant** — kalau koneksi putus, simpan ke localStorage dulu, sync saat online

---

## Alias & variasi bahasa yang sudah diketahui

Daftar ini dikumpulkan dari penggunaan nyata. Update terus seiring pilot:

| Input karyawan | Interpretasi |
|---|---|
| `sig` | signature |
| `ori` | original |
| `cheese` | cheesy |
| `classic`, `klasik` | beef klasik |
| `ayam` | chicken |
| `premium` | beef premium |
| `sedeng` | sedang |
| `pedes`, `pedess` | pedas |
| `gk pedes`, `ga pedes` | tidak pedas |
| `tdk pedes`, `tdk pedas` | tidak pedas |
| `semua` | (diabaikan — konteks "pedas semua") |
| `gak pake X` | catatan: tanpa X |
| `tanpa X` | catatan: tanpa X |
| `8 sedang & 6 pedas` | 2 item terpisah |
| `PESENAN A.N RICKY :` | header → detect nama "Ricky", strip |

---

## Hal yang belum diimplementasi (backlog)

- [ ] Dashboard gabungan semua lapak untuk owner (summary side-by-side)
- [ ] Export rekap ke Excel/PDF
- [ ] Push notification ke owner kalau omzet > target
- [ ] Stok bahan baku (kelanjutan dari data order)
- [ ] Edit/hapus transaksi yang sudah tersimpan
- [ ] Manajemen user & lapak oleh owner (tambah/nonaktifkan akun)
- [ ] Dark mode

---

## Cara run development

```bash
npm install
cp .env.example .env.local   # isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY
npm run dev
```

Supabase local development:
```bash
npx supabase init
npx supabase start
npx supabase db reset        # apply migrations
```

---

## Hal yang harus selalu dicek sebelum commit

- [ ] Semua angka harga dalam **ribuan** — tidak ada yang pakai Rp penuh di database
- [ ] Parser tidak pecah untuk input: `"sig 2 pedas"`, `"PESENAN A.N BUDI: ori jumbo 3 sedang & 2 tdk pedas"`, `"cheesy small chicken tidak pedas"`
- [ ] RLS aktif dan karyawan tidak bisa baca data lapak lain (test dengan akun karyawan)
- [ ] LapakSwitcher tidak muncul di UI karyawan sama sekali
- [ ] Owner bisa switch lapak dan data berubah tanpa logout
- [ ] Touch target semua tombol >= 44px di mobile
- [ ] Tidak ada `console.log` yang tertinggal
- [ ] Transaksi tersimpan dengan `lapak_id` yang benar di Supabase
