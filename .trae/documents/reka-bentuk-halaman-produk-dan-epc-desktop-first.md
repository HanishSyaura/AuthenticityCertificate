# Spesifikasi Reka Bentuk Halaman (Desktop-first)

## Global Styles
- Layout: Desktop-first, grid 12-kolum; kandungan maksimum 1200px lebar (center), padding 24px.
- Warna: Latar #0B1220, kad #111B2E, teks utama #E6EDF7, aksen #4F8CFF, status berjaya #22C55E, amaran #F59E0B, ralat #EF4444.
- Tipografi: Inter/system; H1 24/32, H2 18/26, body 14/22, label 12/18.
- Komponen: Butang (primary/secondary/danger), input dengan fokus ring (#4F8CFF 2px), jadual dengan header sticky.
- Interaksi: Hover kad +2px shadow; transition 150ms ease.

## 1) Halaman Log Masuk
### Meta Information
- Title: "Log Masuk"
- Description: "Akses modul pengurusan produk dan EPC."

### Page Structure
- Centered card (420px) di tengah skrin.

### Sections & Components
- Logo/Nama sistem (atas)
- Borang: Email/Username, Password
- Butang: "Log Masuk"
- State: loading (disable butang), error message (inline bawah borang)

### Responsive
- <640px: card full-width dengan margin 16px.

## 2) Halaman Pengurusan Product (/products)
### Meta Information
- Title: "Pengurusan Product"
- Description: "Tambah dan urus product (SKU, nama, kod produk, kategori, status, remark)."

### Layout
- Struktur dashboard: sidebar kiri (240px) + kawasan kandungan kanan.
- Kandungan kanan guna grid + kad.

### Sections & Components
1. Top bar
   - Tajuk halaman
   - Butang primary: "Add Product"
2. Panel carian & tapisan (kad)
   - Search input: SKU / nama / kod produk
   - Dropdown: kategori
   - Dropdown: status
   - Butang: "Reset"
3. Jadual Product (kad)
   - Kolum: SKU, Nama, Kod Produk, Kategori, Status, Remark, Tindakan
   - Tindakan: "Edit" (modal/drawer)
   - Pagination (bawah kanan)
4. Add/Edit Product (modal atau drawer kanan)
   - Medan wajib: SKU, nama, kod produk, kategori, status
   - Medan pilihan: remark
   - Butang: "Simpan" / "Batal"
   - Validasi: required, uniqueness SKU (papar mesej jika konflik)

### Responsive
- <1024px: sidebar jadi top-nav; jadual boleh scroll mendatar.

## 3) Halaman Jana & Senarai EPC (/epc)
### Meta Information
- Title: "Jana EPC"
- Description: "Jana EPC batch menggunakan corp prefix + running number dan lihat senarai EPC dijana."

### Layout
- Dua lajur (desktop): kiri borang jana, kanan ringkasan & sejarah.
- Lajur kiri ~40%, kanan ~60%.

### Sections & Components
1. Borang Jana EPC (kad kiri)
   - Input: corp code (prefix)
   - Pemilih product + SKU (dropdown carian; hanya product status aktif jika berkenaan)
   - Input: batch name
   - Input number: batch qty
   - Textarea: remark
   - Butang primary: "Generate EPC"
   - Validasi: batch qty > 0, semua medan wajib kecuali remark
2. Ringkasan batch terbaharu (kad kanan atas)
   - Papar: corp prefix, product/SKU, batch name, qty, remark, masa dijana
   - CTA: "Lihat dalam senarai" (scroll ke bawah)
3. Senarai EPC Dijana (kad kanan bawah)
   - Tabs ringkas: "Batch" / "EPC" (optional UI untuk tukar paparan tanpa tambah fungsi baharu)
   - Paparan Batch: jadual batch (nama, qty, tarikh)
   - Paparan EPC: jadual EPC (epc_code, batch_name, tarikh)
   - Search: epc_code atau batch_name
   - Pagination
4. State & notifikasi
   - Loading semasa generate
   - Toast: berjaya (papar bilangan EPC dijana), ralat (contoh: corp prefix tidak sah / konflik)

### Responsive
- <1024px: jadi satu lajur (borang di atas, senarai di bawah).
