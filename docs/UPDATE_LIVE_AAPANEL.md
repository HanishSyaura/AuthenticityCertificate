# Update Live (aaPanel) — Copy/Paste Runbook

Dokumen ini untuk update **backend + frontend** setiap kali anda buat perubahan dalam repo.

## ⚠️ PENTING — JANGAN PADAM UPLOADS ⚠️

**Punca fail gambar/video hilang selepas update:**

- `git clean -fd` atau `git reset --hard` akan DELETE semua fail yang **tidak di-track git** dan **tidak ada dalam .gitignore**
- Fail upload user (`uploads/media/*`) TIDAK BOLEH di-commit
- Sebelum ini `uploads/` TIDAK ADA dalam `.gitignore` → setiap kali clean, uploads terpadam!

**Kini sudah diperbaiki:**
- ✅  `uploads/` sudah ditambah ke `.gitignore`
- ✅  `git clean -fd` TIDAK AKAN padam `uploads/` lagi (memandangkan ia di-ignore)
- ✅  SCRIPT AUDIT: `node scripts/audit-media-assets.js` (senaraikan media mana ada/hilang)

**Tetapi paling SELAMAT untuk PRODUCTION:**
Pindahkan uploads ke FOLDER LUAR projek (contoh):
```
UPLOADS_ROOT=/www/wwwroot/nfc.cert.demo.clbgroups.com/uploads
```
Tetapkan dalam `.env` backend dan restart PM2.
Dengan ini, walaupun anda delete keseluruhan folder `app`, uploads user tidak terjejas.

---

Asumsi:

- Project folder: `/www/wwwroot/nfc.cert.demo.clbgroups.com/app`
- **Disyorkan:** Uploads shared folder: `/www/wwwroot/nfc.cert.demo.clbgroups.com/uploads` (set dalam `.env` → `UPLOADS_ROOT=/path/to/shared-uploads`)
- Branch deploy: `demo`
- Backend jalan guna PM2 process name: `nfccertdemo-api` (ubah ikut PM2 actual name)
- Backend port internal: `5015`
- Nginx serve frontend build dari `frontend/dist`

> Nota keselamatan: Jangan commit `.env`. `.env` hanya di server.

***

## A) Update standard (paling biasa) — copy & paste

Paste satu blok ini dalam SSH:

```bash
cd /www/wwwroot/nfc.cert.demo.clbgroups.com/app || exit 1

# ============== PRE-DEPLOY: PROTECT UPLOADS ==============
echo "== 0) Pre-check: backup uploads (safety) =="
# Jika UPLOADS_ROOT tak set luar folder, backup uploads dir dlm projek
if [ -d "uploads/media" ]; then
  BACKUP_DIR="../_uploads_backup_$(date +%Y%m%d_%H%M%S)"
  echo "   Copying uploads/ to $BACKUP_DIR ..."
  cp -a uploads "$BACKUP_DIR" 2>/dev/null || true
  echo "   Uploads backup size: $(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1 || echo 'N/A')"
else
  echo "   (upload dir dalam projek tiada / guna path luar projek - OK)"
fi

echo "== 1) Clean frontend build files =="
git restore frontend/dist 2>/dev/null || true
# PENTING: -e uploads -e logs = exclude uploads & logs drpd clean
git clean -fd frontend/dist 2>/dev/null || true

echo "== 2) Check local changes =="
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ERROR: Local tracked changes detected."
  git status --short
  exit 1
fi

echo "== 3) Pull latest code =="
git fetch origin
git checkout demo
git pull --ff-only origin demo

echo "== 4) Confirm version =="
git log -1 --oneline

echo "== 5) Backend dependencies =="
npm ci || npm install

echo "== 6) Prisma check =="
npx prisma validate || exit 1
npx prisma generate || exit 1
npx prisma db push || exit 1

echo "== 7) Restart backend =="
pm2 restart nfccertdemo-api --update-env
sleep 2

echo "== 8) Frontend build =="
cd frontend || exit 1

npm ci || npm install

if [ ! -f ".env.production" ]; then
  echo "VITE_API_BASE_URL=" > .env.production
fi

rm -rf dist
npm run build || exit 1

cd ..

echo "== 9) Health check =="
curl -fsS http://127.0.0.1:5015/health
echo

echo "== 10) PM2 status =="
pm2 status nfccertdemo-api

# ============== POST-DEPLOY: VERIFY UPLOADS ==============
echo "== 11) Media asset audit (uploaded files check) =="
if [ -f "scripts/audit-media-assets.js" ]; then
  node scripts/audit-media-assets.js 2>&1 | head -n 80
else
  echo "   (audit script not found - OK for legacy deploy)"
fi

echo "== DEPLOYMENT DONE =="
echo ""
echo "Uploads backup (jika ada): $BACKUP_DIR"
echo "Untuk view full audit report: ls -la media-audit-report-*.json"
```

Lepas run, test di browser:

- `https://nfc.cert.demo.clbgroups.com/health`
- `https://nfc.cert.demo.clbgroups.com/admin/login`
- `https://nfc.cert.demo.clbgroups.com/verify/<CERTIFICATE_ID>`

Kalau UI masih “sama” (masih nampak page EPC lama):

- Pastikan step `rm -rf dist` + `npm run build` memang jalan tanpa error.
- Confirm file build baru wujud:
  - `ls -la frontend/dist/index.html`
  - `ls -la frontend/dist/assets/`
- Buat hard refresh browser (Ctrl+F5) atau buka Incognito.

***

## B) Kalau `git pull` fail (local changes / conflict)

1. Check apa yang berubah:

```bash
cd /www/wwwroot/nfc.cert.demo.clbgroups.com/app
git status
```

2. **SEBELUM reset/clean — BACKUP UPLOADS DULU:**

```bash
# Backup uploads (jika masih dalam folder projek)
if [ -d "uploads/media" ]; then
  BACKUP_DIR="../_uploads_backup_$(date +%Y%m%d_%H%M%S)"
  echo "Backing up uploads to $BACKUP_DIR ..."
  cp -a uploads "$BACKUP_DIR"
  echo "Backup size: $(du -sh "$BACKUP_DIR" | cut -f1)"
fi
echo "Done. Uploads selamat."
```

3. Kalau hanya file build/frontend yang tak patut ada, reset clean:

```bash
# ⚠️ PENTING: -e uploads -e logs supaya TIDAK PADAM uploads & logs
git reset --hard
git clean -fd -e uploads -e logs
git pull
```

***

## C) Bila frontend berubah sahaja

```bash
set -e
cd /www/wwwroot/nfc.cert.demo.clbgroups.com/app
git fetch origin
git checkout demo
git pull origin demo
cd frontend
npm ci || npm install
rm -rf dist
npm run build
```

***

## D) Bila backend berubah sahaja

```bash
cd /www/wwwroot/nfc.cert.demo.clbgroups.com/app
git fetch origin
git checkout demo
git pull origin demo
npm ci || npm install
npx prisma generate
echo "== Sync DB schema (Prisma) =="
npx prisma db push
pm2 restart nfccertdemo-api
curl -s http://127.0.0.1:5015/health
echo
```

***

## E) Troubleshooting cepat

- Check PM2 log:

```bash
pm2 logs nfccertdemo-api --lines 200
```

- Check Nginx error log:

```bash
tail -n 200 /www/wwwlogs/nfc.cert.demo.clbgroups.com.error.log
```

- Kalau `502 Bad Gateway`:
  - Pastikan backend hidup: `pm2 status nfccertdemo-api`
  - Pastikan port: `curl -s http://127.0.0.1:5015/health`
- Kalau route admin refresh jadi 404:
  - Pastikan Nginx ada `try_files $uri $uri/ /index.html;` untuk `location /`

***

## F) Bila ada perubahan Prisma schema (tanpa migrations)

Kadang-kadang update code menambah field baru dalam Prisma schema, tetapi repo anda belum ada folder `prisma/migrations`.

Untuk kes ini, anda perlu apply perubahan DB secara manual (MySQL), kemudian barulah jalankan:

- `npx prisma generate`
- restart PM2

Jika `npx prisma generate` gagal dengan error `P1012 missing an opposite relation field`, itu bermaksud Prisma schema di server belum lengkap / belum ikut versi repo.

Contoh error yang pernah berlaku:

- `Product.certificateTemplate` missing opposite field pada `CertificateTemplate`
- `MediaAsset.organization` missing opposite field pada `Organization`

Hotfix cepat (edit `prisma/schema.prisma` di server):

```prisma
model CertificateTemplate {
  // ...
  products Product[]
}

model Organization {
  // ...
  mediaAssets MediaAsset[]
}
```

Lepas save:

```bash
npx prisma validate
npx prisma generate
pm2 restart nfccertdemo-api
```

Contoh (Part Product Management — tambah `origin`, `description`, `certificateTemplateId` pada table `Product`):

```sql
ALTER TABLE Product
  ADD COLUMN origin VARCHAR(191) NULL,
  ADD COLUMN description TEXT NULL,
  ADD COLUMN certificateTemplateId INT NULL;

ALTER TABLE Product
  ADD INDEX idx_Product_certificateTemplateId (certificateTemplateId);

ALTER TABLE Product
  ADD CONSTRAINT Product_certificateTemplateId_fkey
  FOREIGN KEY (certificateTemplateId)
  REFERENCES CertificateTemplate(id)
  ON DELETE SET NULL
  ON UPDATE CASCADE;
```

Contoh (Media Library — tambah table `MediaAsset`):

```sql
CREATE TABLE MediaAsset (
  id INT NOT NULL AUTO_INCREMENT,
  organizationId INT NOT NULL,
  originalName VARCHAR(255) NOT NULL,
  fileName VARCHAR(255) NOT NULL,
  mimeType VARCHAR(191) NOT NULL,
  sizeBytes INT NOT NULL,
  url TEXT NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deletedAt DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY MediaAsset_org_fileName_unique (organizationId, fileName),
  KEY MediaAsset_organizationId_idx (organizationId),
  KEY MediaAsset_createdAt_idx (createdAt),
  CONSTRAINT MediaAsset_organizationId_fkey FOREIGN KEY (organizationId) REFERENCES Organization(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
```

cara update semua (full clean deploy)

```Shell
set -e
cd /www/wwwroot/nfc.cert.demo.clbgroups.com/app

# ==========================================
# STEP -1 (PALING PENTING): BACKUP UPLOADS
# ==========================================
echo "== [SAFETY] Backup uploads before deploy =="
if [ -d "uploads/media" ]; then
  BACKUP_DIR="../_uploads_backup_$(date +%Y%m%d_%H%M%S)"
  echo "   Copying uploads/ to $BACKUP_DIR ..."
  cp -a uploads "$BACKUP_DIR"
  echo "   Backup size: $(du -sh "$BACKUP_DIR" | cut -f1)"
else
  echo "   (guna path luar projek - OK, tiada backup dlm projek)"
fi

echo "== Clean local changes =="
# ⚠️ PENTING: -e uploads -e logs EXCLUDE uploads dan logs drpd di-delete
git reset --hard
git clean -fd -e uploads -e logs

echo "== Pull demo =="
git fetch origin
git checkout demo
git reset --hard origin/demo
git log -1 --oneline

echo "== Backend deps + prisma =="
npm ci || npm install
npx prisma generate
npx prisma migrate deploy

echo "== Frontend build =="
cd frontend
rm -rf dist
npm ci || npm install
npm run build
cd ..

echo "== Restart (API) =="
pm2 restart nfccertdemo-api || true
sleep 2

echo "== Health & Media check =="
curl -sS http://127.0.0.1:5015/health
echo ""
if [ -f "scripts/audit-media-assets.js" ]; then
  node scripts/audit-media-assets.js 2>&1 | head -n 60
fi

echo "== DONE =="
echo "Uploads backup: $BACKUP_DIR"
```

Update Video file

A) Ambil filename MP4 terbaru

```Shell
ls -t /www/wwwroot/nfc.cert.demo.clbgroups.com/app/uploads/media/1/*.mp4 2>/dev/null | head -n 5
```

Copy yang paling atas (itu paling baru).

B) Check status DB untuk filename tu Ganti NEW\.mp4 :

```Shell
cd /www/wwwroot/nfc.cert.demo.clbgroups.com/app
node - <<'NODE'
require('dotenv').config();
const prisma = require('./src/config/prisma');
(async () => {
  const fileName = 'NEW.mp4';
  const row = await prisma.mediaAsset.findFirst({ where: { fileName } });
  console.log(row?.id, row?.processingStatus, row?.processingError, row?.processingJobId, row?.posterUrl, row?.sizeBytes, row?.processedAt);
  await prisma.$disconnect();
})().catch((e)=>{ console.error(e); process.exit(1); });
NODE
```

C) Bila status dah ready , verify format iPhone (720p + yuv420p) Guna path penuh file:

```Shell
FILE="/www/wwwroot/nfc.cert.demo.clbgroups.com/app/uploads/media/1/NEW.mp4"
ffprobe -v error -show_streams -select_streams v:0 -of json "$FILE" | head -n 50
```

Target:

- width: 1280 , height: 720
- pix\_fmt: yuv420p

Kalau kau nak check “semua yang masih processing”, run:

```Shell
cd /www/wwwroot/nfc.cert.demo.clbgroups.com/app
node - <<'NODE'
require('dotenv').config();
const prisma = require('./src/config/prisma');
(async () => {
  const rows = await prisma.mediaAsset.findMany({
    where: { processingStatus: 'processing', deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 20
  });
  console.log(rows.map(r => ({ id: r.id, fileName: r.fileName, jobId: r.processingJobId, createdAt: r.createdAt })));
  await prisma.$disconnect();
})().catch((e)=>{ console.error(e); process.exit(1); });
NODE
```

***

## G) DISYORKAN — Pindahkan Uploads ke Luar Folder Projek (1x setup)

Ini cara PALING SELAMAT. Selepas setup ni, walaupun anda delete keseluruhan folder `app`, gambar/video user TIDAK AKAN terjejas.

```bash
cd /www/wwwroot/nfc.cert.demo.clbgroups.com/app

# 1) Hentikan backend dahulu (elak upload baru berlangsung semasa migrate)
pm2 stop nfccertdemo-api || true

# 2) Buat shared folder di LUAR folder app
SHARED_DIR="/www/wwwroot/nfc.cert.demo.clbgroups.com/uploads"
mkdir -p "$SHARED_DIR"
echo "Created shared dir: $SHARED_DIR"

# 3) Copy SEMUA uploads sedia ada ke shared dir (jika ada)
if [ -d "uploads/media" ]; then
  echo "Copying existing uploads to shared dir ..."
  cp -a uploads/. "$SHARED_DIR"/
  echo "Done. Shared dir usage: $(du -sh "$SHARED_DIR" | cut -f1)"
  # Verify copy sama
  OLD_COUNT=$(find uploads/media -type f 2>/dev/null | wc -l)
  NEW_COUNT=$(find "$SHARED_DIR/media" -type f 2>/dev/null | wc -l)
  echo "Old files: $OLD_COUNT  ->  New files: $NEW_COUNT"
  if [ "$OLD_COUNT" != "$NEW_COUNT" ]; then
    echo "⚠️  COUNT MISMATCH — check manually before proceeding!"
    exit 1
  fi
fi

# 4) Kemaskini .env backend (UPLOADS_ROOT = path penuh shared folder)
#    — jgn padam line lama, hanya comment & tambah baru
if grep -q "^UPLOADS_ROOT=" .env 2>/dev/null; then
  sed -i.bak "s|^UPLOADS_ROOT=.*|# UPLOADS_ROOT=./uploads  (migrated ke shared dir)\nUPLOADS_ROOT=$SHARED_DIR|" .env
else
  echo "UPLOADS_ROOT=$SHARED_DIR" >> .env
fi
echo ".env updated. Verifying:"
grep "^UPLOADS_ROOT=" .env || echo "(not found — please add manually)"

# 5) Kemaskini Nginx config (untuk static serve uploads)
#    Edit dalam aaPanel -> Website -> Config. Update path alias:
#
#    FROM (old):
#      alias /www/wwwroot/nfc.cert.demo.clbgroups.com/app/uploads/;
#
#    TO (new):
#      alias /www/wwwroot/nfc.cert.demo.clbgroups.com/uploads/;
#
#    Lokasi sama untuk block /uploads/ dan /public/uploads/
#    Save config -> Reload Nginx

# 6) Audit verify pada new location
cd /www/wwwroot/nfc.cert.demo.clbgroups.com/app
if [ -f "scripts/audit-media-assets.js" ]; then
  echo ""
  echo "Running media audit on NEW location ..."
  node scripts/audit-media-assets.js 2>&1 | head -n 60
fi

# 7) Restart backend
pm2 restart nfccertdemo-api || pm2 start src/index.js --name nfccertdemo-api
sleep 2
curl -s http://127.0.0.1:5015/health
echo ""

# 8) (Optional, verify takda issue untuk 2-3 hari)
#    Jika semua OK, boleh delete old uploads dalan projek:
#    rm -rf /www/wwwroot/nfc.cert.demo.clbgroups.com/app/uploads
#    (TAPI JANGAN delete dulu sebelum confirm semua gambar OK di website!)

echo ""
echo "Migration step 1-7 done. Please test gambar on website manually."
echo "If OK for 2-3 days, you may run:  rm -rf /www/wwwroot/nfc.cert.demo.clbgroups.com/app/uploads"
```

***

## H) TROUBLESHOOTING — Gambar Hilang / Terpadam Selepas Update

### Simptom:
- Dalam CMS/Product, tempat gambar sepatutnya papar tapi kosong (broken image icon)
- Inspector panel shows URL tapi file tiada di disk (seperti screenshot anda)

### Punca (sudah diperbaiki dalam codebase ini):
1. `uploads/` tidak ada dalam `.gitignore`
2. Runbook menggunakan `git clean -fd` tanpa exclude
3. Hasilnya: SEMUA fail upload user terdelete setiap kali update!

---

## JIKA TIADA BACKUP LANGSUNG (Situasi Anda)

⚠️ **PENTING:** Fail yang terdelete oleh `git clean -fd` TIDAK BOLEH dipulihkan oleh app Node/Prisma. Ia memerlukan **filesystem-level undelete tool** (seperti `extundelete` / `testdisk` / `photorec` pada Linux) dan ini perlu dilakukan OLEH SERVER ADMIN sebelum disk ditulis lagi. Prosedurnya berisiko dan hanya pakar server yang patut buat.

Oleh itu, **recovery praktikal untuk anda** (tanpa low-level filesystem recovery) adalah seperti berikut:

---

### Recovery Checklist: Step-by-Step (Tiada Backup)

#### **Langkah 0 — Commit dan deploy code fix TERKINI DULU**
Pastikan deploy code yang ada `.gitignore uploads/` dan runbook selamat — supaya masalah TIDAK BERULANG untuk upload baru selepas ni.

---

#### **Langkah 1 — Generate SENARAI KEHILANGAN yang TERPERINCI**
Script ini akan:
- Baca SEMUA record dari table `MediaAsset` (semua gambar/video yang pernah uploaded)
- Check sama ada fail fizikal wujud di disk (jika tidak, masukkan dalam list hilang)
- **SCAN SEMUA TABLE DB** untuk jumpa **DIMANA media itu DIPAKAI** (CMS page mana, Product mana, Certificate template mana, Logo/Favicon mana, etc)
- Output 2 fail: `CSV` (buka Excel/Google Sheets) dan `MARKDOWN CHECKLIST` (Notion/Trello)

```bash
cd /www/wwwroot/nfc.cert.demo.clbgroups.com/app
node scripts/generate-missing-media-checklist.js
```

Output:
```
missing-media-checklist-YYYYMMDD_HHMMSS.csv      <-- buka Excel / Google Sheets
missing-media-checklist-YYYYMMDD_HHMMSS.md       <-- Markdown checklist
```

Buka fail CSV — ia mempunyai **18 column** termasuk:
- `No`, `MediaAsset ID`, `Org Name`, `Category` (Image/Video/PDF/etc), `MIME Type`,
- `Original Filename` (nama fail asal semasa user upload — ini membantu anda cari source asal)
- `URL in DB`, `Expected Disk Path`, `Uploaded Date`,
- **`Where Used in System`** (INI PALING PENTING — tunjuk page mana yang guna gambar ni:
  `CmsVersion(page layout)`, `CertificateTemplate`, `OrganizationSetting LOGO`,
  `CmsPage OG Image`, `EpcBatchDocument`, `ProductSupportingCertificate`, etc)
- 3 column untuk anda update progress: `Status`, `New URL After Reupload`, `Remarks`

---

#### **Langkah 2 — Isi Checklist & Track Progress**
Salin CSV ke Google Sheet / Excel, kemudian untuk setiap row (setiap media yang hilang):

1. **Identify apa gambar/video tu** — guna `Original Filename` + `Category` + `Uploaded Date`
2. **Cari source asal file**:
   - Desktop PC owner yang upload
   - WhatsApp / Telegram / email yang hantar fail tu
   - Google Drive / Dropbox shared folder
   - Snapshot Facebook / Instagram / website preview lain
3. **Isi column `Status`**: `Not Started` → `Source Found` → `Reuploaded` → `Relinked` → `Verified`
4. **Priority**: Restore ikut kategori critical dulu:
   - Priority 1 🔥: `OrganizationSetting LOGO / FAVICON` (branding app)
   - Priority 2 🔥: **CertificateTemplate** (background sijil, template design)
   - Priority 3 🔥: `CmsVersion/page layout` untuk pages yang live & **public** (landing page product)
   - Priority 4: `OG Image` (social share preview)
   - Priority 5: EPC documents, supporting certificates, product images yg kurang popular

---

#### **Langkah 3 — Re-upload & Relink (Proses Paling Penting)**
Untuk setiap media dalam checklist:

##### **Sub-step 3a: Upload semula ke Media Library / CMS Builder**
- Log in ke Admin Panel
- Buka page `Landing Page Design` atau page yang break
- Click block gambar yang broken → Inspector → **Choose File** → upload source file yang dijumpai
- Atau upload dari Media Library terus (jika ada)

##### **Sub-step 3b: RELINK — pastikan URL BARU menggantikan URL LAMA**
Ini step yang PALING MUDAH TERLEPAS. Bila anda upload semula gambar, ia generate **fileName BARU** dan **URL BARU** (contoh: `/uploads/media/1/1767859934-a1b2c3d4e5f6.jpg`). Semua page yang rujuk URL LAMA masih akan broken.

Cara relink:
- **Cara paling senang**: terus edit Block yang broken dalam CMS Builder, guna Choose File baru. Designer akan save JSON dengan URL baru automatically.
- **Jika banyak block guna gambar yang sama (seperti logo)**: Edit di `Admin Panel > Settings > Branding` (upload logo baru & save).
- **CertificateTemplate**: Buka Certificate Template Builder, upload background baru dan save.

##### **Sub-step 3c: VERIFY**
Setiap kali selepas save/publish CMS:
1. Buka Incognito browser → access public URL page tersebut
2. Pastikan SEMUA gambar muncul tiada broken icon
3. Check video autoplay & poster image
4. Dalam Google Sheet, update column:
   - `New URL After Reupload`: paste URL gambar baru
   - `Status`: `Verified`
   - `Remarks`: apa-apa nota khas (contoh: "gambar ganti resolusi lebih rendah dari asal")

---

#### **Langkah 4 — Run Audit Semula Selepas Selesai**
Selepas semua (atau kebanyakan) media dah reupload & relink:
```bash
cd /www/wwwroot/nfc.cert.demo.clbgroups.com/app
node scripts/audit-media-assets.js
```
Pastikan bilangan `Missing` semakin berkurangan.

---

### PENCEGAHAN MASA DEPAN: WAJIB SETUP AUTO-BACKUP UPLOADS

**Script auto-backup (baruuuu!)** dah siap:

```bash
cd /www/wwwroot/nfc.cert.demo.clbgroups.com/app

# Backup cara copy (default - ringkas, tiada compressor diperlukan)
node scripts/backup-uploads.js

# Backup cara tar.gz (lebih jimat storage)
node scripts/backup-uploads.js --tar --keep=30

# Backup cara zip
node scripts/backup-uploads.js --zip --keep=14
```

**Output**: Fail disimpan ke `UPLOADS_BACKUP_DIR` (jika set dalam .env) atau secara default:
`/www/wwwroot/nfc.cert.demo.clbgroups.com/_uploads_backups/uploads_backup_YYYYMMDD_HHMMSS/`

**Fungsi script ni:**
- Auto buat folder backup dengan timestamp
- Compress option (`--tar` / `--zip`) untuk jimat storage
- Auto-delete backup lama (retention policy: `--keep=14` = simpan last 14 shj)
- Write log ke `_backup-log.txt`

**Setup CRON harian (aaPanel):**
1. Log in aaPanel → **Cron** → **Add Cron Job**
2. Execute cycle: `Every day` (pilih waktu 2:00 pagi)
3. Script content:
   ```bash
   cd /www/wwwroot/nfc.cert.demo.clbgroups.com/app && /usr/bin/node scripts/backup-uploads.js --tar --keep=30
   ```
4. Save. Sekarang backup uploads akan run AUTOMATIK setiap malam 2 pagi, simpan 30 hari.

---

### ⚙️ Scripts Usage Reference (Ringkas)

| Script | Bila Guna | Command | Output Utama |
|--------|-----------|---------|-------------|
| `scripts/audit-media-assets.js` | Quick check uploads OK / missing, sebelum & lepas deploy, selepas restore | `node scripts/audit-media-assets.js` | Console summary + `media-audit-report-*.json` |
| `scripts/generate-missing-media-checklist.js` | Bila discover missing banyak & perlu reupload satu per satu | `node scripts/generate-missing-media-checklist.js` | `missing-media-checklist-*.csv` + `*.md` + SCAN "where used" |
| `scripts/backup-uploads.js` | Manual backup, atau setup cron harian | `node scripts/backup-uploads.js --tar --keep=14` | Folder `_uploads_backups/uploads_backup_*` |

---

### Long-term safety checklist (SELEPAS restore):
- ✅  `uploads/` wujud dalam `.gitignore` (dah fix)
- ✅  `UPLOADS_ROOT` dalam `.env` tunjuk PATH LUAR FOLDER PROJEK (disyorkan — run section G)
- ✅  Semua runbook ada backup uploads sebelum `git reset/clean` (dah fix)
- ✅  `git clean` sentiasa guna `-e uploads -e logs` (dah fix)
- ✅  **CRON BACKUP UPLOADS HARIAN** telah setup (rujuk Section I / scripts/backup-uploads.js) — INI PALING PENTING untuk masa depan
- ✅  Sebelum buat apa-apa deployment besar, backup uploads DULU walaupun cron dah ada

