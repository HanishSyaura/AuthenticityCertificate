## 1. Gambaran Keseluruhan Produk
**Sistem Pengesahan Keaslian Produk** adalah penyelesaian anti-pemalsuan premium yang direka untuk menyediakan pengesahan produk berasaskan NFC dengan CMS bersepadu untuk halaman pendaratan tersuai dan enjin sijil dinamik.

### Pernyataan Masalah
Produk tiruan (contohnya, dalam industri sarang burung) merosakkan reputasi jenama dan kepercayaan pengguna. Penyelesaian sedia ada sering kali kurang dari segi persembahan visual profesional dan pengurusan kandungan yang fleksibel.

### Sasaran Pengguna
- **Pengilang**: Memerlukan cara selamat untuk menjana pengecam unik dan mengurus kelompok produk.
- **Pengguna**: Memerlukan cara mudah tanpa aplikasi untuk mengesahkan keaslian melalui imbasan mudah alih (NFC/QR).
- **Admin**: Mengurus keseluruhan sistem, templat, dan susun atur.

## 2. Keupayaan Teras

### 2.1 Sistem Sijil
- **Sijil Kelompok (Batch)**: Satu sijil/NFC untuk keseluruhan kelompok pengeluaran.
- **Sijil Unit**: Sijil/NFC unik untuk setiap unit produk individu.
- **Format ID**: ID yang dijana secara rawak dan selamat (contoh: `BN-XXXXXXXXXX`) menggunakan `crypto.randomBytes()`.
- **Pengurusan Status**: Menjejaki sijil sebagai `VALID`, `REVOKED`, atau `SUSPICIOUS`.

### 2.2 CMS & Pembina Halaman Pendaratan (Seret & Lepas)
- **Jenis Editor**: Kedudukan bebas (bukan grid) menggunakan `react-rnd`.
- **Blok yang Disokong**:
  - **Teks**: Tajuk dan penerangan dinamik.
  - **Imej**: Foto produk dan penjenamaan.
  - **Video**: Video pengeluaran atau kandungan pemasaran.
  - **Sijil**: Blok sijil keaslian dinamik.
- **Dipacu JSON**: Keseluruhan susun atur disimpan dan dipaparkan sebagai JSON.

### 2.3 Pembina Templat Sijil
- **Hamparan Visual**: Muat naik latar belakang sijil profesional.
- **Medan Dinamik**: Letakkan medan (ID Sijil, Nama Produk, dll.) melalui koordinat X/Y.

### 2.4 Pengesanan & Penjejakan Penipuan
- **Penjejakan Imbasan**: Log IP, Ejen Pengguna, dan cap masa untuk setiap percubaan pengesahan.
- **Aktiviti Mencurigakan**: Kesan berbilang imbasan dalam jangka masa singkat atau dari lokasi geografi yang berbeza.

## 3. Peranan & Kebenaran Pengguna

| Peranan | Kebenaran |
|------|-------------|
| **Admin** | Akses penuh ke semua modul, pengurusan pengguna, dan tetapan sistem. |
| **Pengilang** | Cipta produk, jana kelompok, reka sijil, dan bina halaman CMS. |
| **Pengguna Awam** | Imbas NFC/QR, lihat hasil pengesahan, dan akses halaman pendaratan sijil. |

## 4. Aliran Pengguna

### Aliran Pengilang
1. **Cipta Produk**: Takrifkan nama produk dan kod asas.
2. **Jana Kelompok**: Tetapkan nombor kelompok dan kuantiti.
3. **Reka Sijil**: Muat naik latar belakang dan hampar medan dinamik.
4. **Bina Halaman CMS**: Gunakan editor seret dan lepas untuk mencipta halaman pendaratan produk.
5. **Keluarkan Sijil**: Jana ID unik dan tugaskannya kepada tag NFC fizikal.

### Aliran Pengguna
1. **Imbas NFC/QR**: Diarahkan ke URL unik (contoh: `verify.app/BN-12345`).
2. **Sahkan**: Sistem menyemak status dan merekod imbasan.
3. **Paparan**: Enjin paparan awam mengambil susun atur CMS dan data sijil.
4. **Lihat**: Pengguna melihat halaman pengesahan profesional dengan sijil keaslian produk.

## 5. Standard Reka Bentuk UI/UX
- **Tema**: Premium dan boleh dipercayai (Biru Gelap/Aksen Emas).
- **Responsif**: Diutamakan untuk mudah alih bagi enjin paparan awam.
- **Editor**: Panel sisi untuk penyuntingan blok, seret/saiz semula bebas dalam viewport utama.

## 6. Fasa Pembangunan (Urutan Ketat)

### Fasa 1: Asas Teras
- Pelaksanaan Sistem Sijil (Kelompok & Unit).
- Modul pengurusan Produk dan Kelompok.
- API pengesahan awam dan logik pengesahan asas.

### Fasa 2: CMS Asas
- Penyimpanan pangkalan data untuk halaman dan susun atur CMS.
- Pelaksanaan Paparan Awam menggunakan susun atur JSON (paparan statik).

### Fasa 3: Pembina Visual
- Editor CMS Seret & Lepas penuh (`react-rnd`).
- Pembina Templat Sijil Visual.
- Pengendalian fail dan media (Multer).

### Fasa 4: Analitik & Pengoptimuman
- Analitik imbasan dan penjejakan aktiviti mencurigakan.
- Pengoptimuman prestasi (pengindeksan, pemuatan malas).
- Pengukuhan keselamatan terakhir.
