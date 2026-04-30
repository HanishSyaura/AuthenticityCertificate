# Update Live (aaPanel) — Copy/Paste Runbook

Dokumen ini untuk update **backend + frontend** setiap kali anda buat perubahan dalam repo.

Asumsi:

- Project folder: `/www/wwwroot/wmscertauth.clbgroups.com`
- Backend jalan guna PM2 process name: `wmscertauth-api`
- Backend port internal: `5000`
- Nginx serve frontend build dari `frontend/dist`

> Nota keselamatan: Jangan commit `.env`. `.env` hanya di server.

***

## A) Update standard (paling biasa) — copy & paste

Paste satu blok ini dalam SSH:

```bash
set -e

cd /www/wwwroot/wmscertauth.clbgroups.com

echo "== 1) Pull latest code =="
git pull

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
pm2 restart wmscertauth-api

echo "== 4) Frontend deps + build =="
cd frontend
npm ci || npm install

if [ ! -f ".env.production" ]; then
  echo "VITE_API_BASE_URL=https://wmscertauth.clbgroups.com/api" > .env.production
fi

npm run build

echo "== 5) Quick checks =="
curl -s http://127.0.0.1:5000/health
echo
pm2 status wmscertauth-api
```

Lepas run, test di browser:

- `https://wmscertauth.clbgroups.com/health`
- `https://wmscertauth.clbgroups.com/admin/dashboard`
- `https://wmscertauth.clbgroups.com/verify/<CERTIFICATE_ID>`

***

## B) Kalau `git pull` fail (local changes / conflict)

1. Check apa yang berubah:

```bash
cd /www/wwwroot/wmscertauth.clbgroups.com
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
cd /www/wwwroot/wmscertauth.clbgroups.com
git pull
cd frontend
npm ci || npm install
npm run build
```

***

## D) Bila backend berubah sahaja

```bash
cd /www/wwwroot/wmscertauth.clbgroups.com
git pull
npm ci || npm install
npx prisma generate
pm2 restart wmscertauth-api
curl -s http://127.0.0.1:5000/health
echo
```

***

## E) Troubleshooting cepat

- Check PM2 log:

```bash
pm2 logs wmscertauth-api --lines 200
```

- Check Nginx error log:

```bash
tail -n 200 /www/wwwlogs/wmscertauth.clbgroups.com.error.log
```

- Kalau `502 Bad Gateway`:
  - Pastikan backend hidup: `pm2 status wmscertauth-api`
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
pm2 restart wmscertauth-api
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
cd /www/wwwroot/wmscertauth.clbgroups.com

rm -rf frontend/dist
git reset --hard
git pull origin main

npm install

cd frontend
rm -rf node_modules package-lock.json
npm install
npm run build

cd ..
npx prisma generate
pm2 restart wmscertauth-api

curl -s http://127.0.0.1:5000/health
echo
```

login credentials:
