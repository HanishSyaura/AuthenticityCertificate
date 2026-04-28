# Deploy ke aaPanel (Production)

Dokumen ini cover deploy **backend (Node/Express + Prisma + MySQL)** dan **frontend (Vite static)** ke server aaPanel, termasuk setup domain, SSL, reverse proxy, env vars, DB migration, update/rollback, dan troubleshooting.

## Ringkasan architecture

- Frontend: static files dari `frontend/dist` diserve oleh Nginx
- Backend API: Node process (`node src/index.js`) on port dalaman (contoh `5000`)
- Nginx reverse proxy: route tertentu (contoh `/public`, `/auth`, `/cms`, dll) akan forward ke backend
- DB: MySQL (Prisma datasource `mysql`)
- Redis: optional (untuk BullMQ queue + webhook delivery async)

## Prasyarat

- Server Linux dengan aaPanel (Nginx)
- Domain + DNS A record ke IP server
- MySQL running (aaPanel database)
- Node.js runtime tersedia di server (Node 18/20 LTS)
- Akses SSH (recommended) atau File Manager aaPanel

## Struktur projek

- Backend root: `src/` + `package.json`
- Frontend: `frontend/` (Vite) + output build `frontend/dist/`
- Prisma schema: `prisma/schema.prisma`

## Apa yang patut ada dalam folder backend (untuk upload ke server)

Folder backend ialah folder yang akan anda run `npm install` dan `node src/index.js`.

Wajib ada:

- `package.json`
- `package-lock.json` (disyorkan, untuk `npm ci`)
- `src/` (backend code)
- `prisma/schema.prisma`

Optional tapi biasa diperlukan:

- `prisma/migrations/` (kalau anda guna Prisma migrations yang committed)
- `docs/` (kalau nak simpan dokumentasi deploy bersama code)

Jangan upload (akan dibuat/generated di server):

- `node_modules/`
- `.env` (buat di server sahaja)
- `logs/` (kalau ada)
- apa-apa test/smoke scripts (kalau anda nak deployment clean)

Dalam repo ini, bahagian backend adalah semua content di root project kecuali folder `frontend/`.

## Env variables (backend)

Buat file `.env` di root backend.

Contoh minimum:

- `PORT=5000`
- `JWT_SECRET=...` (wajib, panjang & random)
- `DATABASE_URL=mysql://USER:PASSWORD@127.0.0.1:3306/DBNAME`
- `REDIS_URL=redis://127.0.0.1:6379` (optional)

Recommended untuk production:

- `CORS_ORIGIN=https://wmscertauth.clbgroups.com` (lock frontend origin; boleh letak multiple dengan comma)

Disyorkan:

- `NODE_ENV=production`

## Env variables (frontend)

Frontend sekarang guna `VITE_API_BASE_URL`.

- Kalau frontend dan backend berada pada domain yang sama (disyorkan):
  - Set `VITE_API_BASE_URL=` (kosong) dan gunakan Nginx proxy untuk `/public`, `/auth`, `/cms`, dll.
- Kalau backend domain berbeza (contoh `api.domain.com`):
  - Set `VITE_API_BASE_URL=https://api.domain.com`

## Step 0 — Decide topology (pilih 1)

**Option A (disyorkan): single domain**

- `https://domain.com/` serve frontend
- Nginx proxy route API ke backend port `5000`

**Option B: split domain**

- `https://domain.com/` serve frontend
- `https://api.domain.com/` serve backend
- Perlu CORS config (sekarang backend `cors()` allow all)

## Step 1 — Setup site dalam aaPanel

1) aaPanel → Website → Add site
- Domain: `domain.com`
- Web server: Nginx

2) Enable SSL
- aaPanel → SSL → Let’s Encrypt

## Step 2 — Setup MySQL

1) aaPanel → Database → Add database
- DB name: contoh `auth_cert`
- User + password strong

2) Pastikan DB boleh connect dari server:
- Host: `127.0.0.1`
- Port: `3306`

3) Set `DATABASE_URL` dalam `.env` backend

## Step 3 — Upload code

Disyorkan:
- Backend di: `/www/wwwroot/domain.com/api`
- Frontend di: `/www/wwwroot/domain.com/frontend`

Cara upload:
- Git clone (best) atau upload zip + unzip

## Step 4 — Install backend dependencies

Masuk folder backend:

- `cd /www/wwwroot/domain.com/api`
- `npm ci` (atau `npm install`)
- `npx prisma generate`

### Prisma migrations

Repo ini mungkin belum ada folder `prisma/migrations`.

Untuk initial deployment:
- Jalankan `npx prisma migrate dev --name init`

Untuk deployment seterusnya (bila `migrations/` sudah wujud dan committed):
- Jalankan `npx prisma migrate deploy`

## Step 5 — Run backend (PM2)

Option:

- Guna PM2 (recommended)
- Atau guna aaPanel Node Project Manager

PM2 example:

- `npm i -g pm2`
- `pm2 start src/index.js --name auth-cert-api`
- `pm2 save`
- Setup startup:
  - `pm2 startup` dan ikut arahan output

Verify:

- `curl http://127.0.0.1:5000/health`

## Step 6 — Build frontend

Masuk folder frontend:

- `cd /www/wwwroot/domain.com/frontend`
- `npm ci`

Set env build:

- Buat `frontend/.env.production`:
  - `VITE_API_BASE_URL=`

Build:

- `npm run build`

Output berada di:

- `/www/wwwroot/domain.com/frontend/dist`

## Step 7 — Nginx config (single domain)

Dalam aaPanel → Website → domain.com → Config

### Serve frontend SPA + proxy API

Contoh Nginx (adjust path ikut folder sebenar):

- Root web:
  - `root /www/wwwroot/domain.com/frontend/dist;`

- SPA fallback:
  - `try_files $uri $uri/ /index.html;`

- Proxy ke backend (port 5000) untuk route API:

Routes backend yang perlu diproxy (at minimum):

- `/public/`
- `/api/v1/public/`
- `/auth/`
- `/cms/`
- `/analytics/`
- `/certificates/`
- `/products/`
- `/users/`
- `/audit/`
- `/organizations/`
- `/bulk/`
- `/fraud/`
- `/integrations/`

Example snippet:

```
location ^~ /public/ { proxy_pass http://127.0.0.1:5000; }
location ^~ /api/v1/public/ { proxy_pass http://127.0.0.1:5000; }
location ^~ /auth/ { proxy_pass http://127.0.0.1:5000; }
location ^~ /cms/ { proxy_pass http://127.0.0.1:5000; }
location ^~ /analytics/ { proxy_pass http://127.0.0.1:5000; }
location ^~ /certificates/ { proxy_pass http://127.0.0.1:5000; }
location ^~ /products/ { proxy_pass http://127.0.0.1:5000; }
location ^~ /users/ { proxy_pass http://127.0.0.1:5000; }
location ^~ /audit/ { proxy_pass http://127.0.0.1:5000; }
location ^~ /organizations/ { proxy_pass http://127.0.0.1:5000; }
location ^~ /bulk/ { proxy_pass http://127.0.0.1:5000; }
location ^~ /fraud/ { proxy_pass http://127.0.0.1:5000; }
location ^~ /integrations/ { proxy_pass http://127.0.0.1:5000; }
```

Untuk proxy header penting:

```
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

## Step 8 — Validate production

- Open `https://domain.com/verify/BN-TEST-123`
- Health check:
  - `https://domain.com/health` (kalau diproxy) atau direct `http://127.0.0.1:5000/health`

## Step 9 — Update flow (live enhancement)

Setiap kali update code:

1) Pull code baru
- `git pull`

2) Backend update
- `npm ci`
- `npx prisma generate`
- `npx prisma migrate deploy` (kalau migrations ada)
- `pm2 restart auth-cert-api`

3) Frontend update
- `cd frontend`
- `npm ci`
- `npm run build`

4) Smoke tests (server)
- `node smoke-phase10.js`
- `node smoke-phase11.js`
- `node smoke-phase12.js`

Rujuk juga runbook copy/paste:

- `docs/UPDATE_LIVE_AAPANEL.md`

## Rollback cepat

- PM2:
  - `pm2 logs auth-cert-api`
  - `pm2 restart auth-cert-api`

- Jika guna git:
  - checkout tag/commit sebelum
  - rebuild frontend
  - restart backend

## Troubleshooting

- **502 Bad Gateway**: backend down / port salah / firewall
- **404 on refresh**: SPA fallback tak betul (`try_files ... /index.html`)
- **Prisma error**: DATABASE_URL salah / user permission / migrate belum run
- **Queue/webhook delay**: Redis tak setup → fallback mode in-memory
- **Rate limit**: check header `x-forwarded-for` dan Nginx proxy headers
