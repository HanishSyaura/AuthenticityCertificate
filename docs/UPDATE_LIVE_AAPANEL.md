# Update Live (aaPanel) — Copy/Paste Runbook

Dokumen ini untuk update **backend + frontend** setiap kali anda buat perubahan dalam repo.

Asumsi:

- Project folder: `/www/wwwroot/birdnestauth.clbgroups.com`
- Branch deploy: `damadingji`
- Backend jalan guna PM2 process name: `birdnestauth-api` (ubah ikut PM2 actual name)
- Backend port internal: `5000`
- Nginx serve frontend build dari `frontend/dist`

> Nota keselamatan: Jangan commit `.env`. `.env` hanya di server.

***

## A) Update standard (paling biasa) — copy & paste

Paste satu blok ini dalam SSH:

```bash
set -e

cd /www/wwwroot/birdnestauth.clbgroups.com

echo "== 1) Pull latest code =="
git fetch origin
git checkout damadingji
git pull origin damadingji

echo "== 1b) Confirm branch + commit =="
git rev-parse --abbrev-ref HEAD
git log -1 --oneline

echo "== 2) Backend deps + Prisma =="
npm ci || npm install
npx prisma generate

if [ -d "prisma/migrations" ] && [ "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  echo "== 2b) Apply migrations =="
  npx prisma migrate deploy
else
  echo "== Skip migrate deploy (no prisma/migrations) =="
fi

echo "== 3) Restart backend =="
pm2 restart birdnestauth-api

echo "== 4) Frontend deps + build =="
cd frontend
npm ci || npm install

if [ ! -f ".env.production" ]; then
  echo "VITE_API_BASE_URL=https://birdnestauth.clbgroups.com/api" > .env.production
fi

rm -rf dist
npm run build

echo "== 5) Quick checks =="
curl -s http://127.0.0.1:5000/health
echo
pm2 status birdnestauth-api
```

Lepas run, test di browser:

- `https://birdnestauth.clbgroups.com/health`
- `https://birdnestauth.clbgroups.com/admin/epc`
- `https://birdnestauth.clbgroups.com/verify/<CERTIFICATE_ID>`

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
cd /www/wwwroot/birdnestauth.clbgroups.com
git status
```

1. Kalau hanya file build/frontend yang tak patut ada, reset clean:

```bash
git reset --hard
git clean -fd
git pull
```

***

## C) Bila frontend berubah sahaja

```bash
set -e
cd /www/wwwroot/birdnestauth.clbgroups.com
git fetch origin
git checkout damadingji
git pull origin damadingji
cd frontend
npm ci || npm install
rm -rf dist
npm run build
```

***

## D) Bila backend berubah sahaja

```bash
cd /www/wwwroot/birdnestauth.clbgroups.com
git fetch origin
git checkout damadingji
git pull origin damadingji
npm ci || npm install
npx prisma generate
pm2 restart birdnestauth-api
curl -s http://127.0.0.1:5000/health
echo
```

***

## E) Troubleshooting cepat

- Check PM2 log:

```bash
pm2 logs birdnestauth-api --lines 200
```

- Check Nginx error log:

```bash
tail -n 200 /www/wwwlogs/birdnestauth.clbgroups.com.error.log
```

- Kalau `502 Bad Gateway`:
  - Pastikan backend hidup: `pm2 status birdnestauth-api`
  - Pastikan port: `curl -s http://127.0.0.1:5000/health`
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
pm2 restart birdnestauth-api
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

cara update semua:

```Shell
set -e

cd /www/wwwroot/birdnestauth.clbgroups.com/AuthenticityCertificate

echo "== Clean local changes =="
git reset --hard
git clean -fd

echo "== Pull damadingji =="
git fetch origin
git checkout damadingji
git reset --hard origin/damadingji
git log -1 --oneline

echo "== Backend deps + prisma =="
npm ci || npm install
npx prisma generate

echo "== Frontend build =="
cd frontend
rm -rf dist
npm ci || npm install
npm run build
cd ..

echo "== Restart (API + worker) =="
pm2 restart birdnestauth-api || true
pm2 restart birdnestauth-worker || true
pm2 restart all

echo "== Health check =="
curl -s http://127.0.0.1:5000/health
echo
```

Update Video file

A) Ambil filename MP4 terbaru

```Shell
ls -t /www/wwwroot/birdnestauth.clbgroups.com/_uploads/media/1/*.
mp4 2>/dev/null | head -n 5
```

Copy yang paling atas (itu paling baru).

B) Check status DB untuk filename tu Ganti NEW\.mp4 :

```Shell
cd /www/wwwroot/birdnestauth.clbgroups.com/AuthenticityCertificate
node - <<'NODE'
require('dotenv').config();
const prisma = require('./src/config/prisma');
(async () => {
  const fileName = 'NEW.mp4';
  const row = await prisma.mediaAsset.findFirst({ where: { 
  fileName } });
  console.log(row?.id, row?.processingStatus, row?.
  processingError, row?.processingJobId, row?.posterUrl, row?.
  sizeBytes, row?.processedAt);
  await prisma.$disconnect();
})().catch((e)=>{ console.error(e); process.exit(1); });
NODE
```

C) Bila status dah ready , verify format iPhone (720p + yuv420p) Guna path penuh file:

```Shell
FILE="/www/wwwroot/birdnestauth.clbgroups.com/_uploads/media/1/
NEW.mp4"
ffprobe -v error -show_streams -select_streams v:0 -of json 
"$FILE" | head -n 50
```

Target:

- width: 1280 , height: 720
- pix\_fmt: yuv420p

Kalau kau nak check “semua yang masih processing”, run:

```Shell
cd /www/wwwroot/birdnestauth.clbgroups.com/AuthenticityCertificate
node - <<'NODE'
require('dotenv').config();
const prisma = require('./src/config/prisma');
(async () => {
  const rows = await prisma.mediaAsset.findMany({
    where: { processingStatus: 'processing', deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 20
  });
  console.log(rows.map(r => ({ id: r.id, fileName: r.fileName, 
  jobId: r.processingJobId, createdAt: r.createdAt })));
  await prisma.$disconnect();
})().catch((e)=>{ console.error(e); process.exit(1); });
NODE
```

