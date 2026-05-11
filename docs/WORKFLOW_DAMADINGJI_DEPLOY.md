# Workflow Commit & Deploy (Branch `damadingji`)

Dokumen ini untuk rujukan bila nak:
1) commit & push perubahan ke branch `damadingji` (local), dan  
2) pull & redeploy versi baru di server aaPanel.

## Perkara Penting
- Di Windows PowerShell, kalau `npm` blocked (Execution Policy), guna `npm.cmd`.
- Backend guna Prisma. Lepas ubah [schema.prisma](file:///c:/Users/USER/Desktop/Damadingji_NFC/prisma/schema.prisma), pastikan Prisma client digenerate semula.
- Deploy server: biasanya perlukan `npm install`, `prisma generate`, build frontend, kemudian restart app.

## A) Local (Windows) — Commit & Push ke `damadingji`

### 1) Pastikan branch & sync dari remote
Di root project:
```powershell
cd c:\Users\USER\Desktop\Damadingji_NFC

git fetch
git checkout damadingji
git pull origin damadingji
```

### 2) Semak perubahan yang akan dicommit
```powershell
git status
git diff --stat
```

Kalau nak semak detail:
```powershell
git diff
```

### 3) Install deps & generate Prisma client (backend)
```powershell
npm.cmd install
npm.cmd run prisma:generate
```

### 4) Lint/Test/Build (frontend)
```powershell
cd frontend
npm.cmd install
npm.cmd run lint
npm.cmd run test
npm.cmd run build
cd ..
```

### 5) Stage fail yang berubah
Pilih salah satu:

**Option 1 (semua perubahan)**
```powershell
git add -A
```

**Option 2 (pilih fail tertentu)**
```powershell
git add `
  frontend/src/pages/admin/AdminEpc.jsx `
  frontend/src/store/useEpcStore.js `
  prisma/schema.prisma `
  src/config/dbPatches.js `
  src/modules/epc/epc.controller.js `
  src/modules/epc/epc.service.js
```

### 6) Commit
```powershell
git commit -m "Update EPC generation + UI modal + batch stats"
```

### 7) Push ke remote
```powershell
git push origin damadingji
```

## B) Server (aaPanel) — Pull & Redeploy Versi Baru

> Nota: Path project dan cara run app mungkin berbeza ikut setup aaPanel (Node Project / PM2 / systemd). Guna langkah yang sepadan.

### 1) SSH masuk server & pergi ke folder project
Contoh (tukar ikut server sebenar):
```bash
cd /www/wwwroot/<project-folder>
```

### 2) Checkout & pull branch `damadingji`
```bash
git fetch
git checkout damadingji
git pull origin damadingji
```

### 3) Backend install + Prisma generate
Di root project:
```bash
npm install
npx prisma generate
```

### 4) Frontend install + build
```bash
cd frontend
npm install
npm run build
cd ..
```

### 5) Restart app (pilih ikut cara app run)

#### Option A: aaPanel “Node Project”
- aaPanel → Node Project → pilih project → klik **Restart**.

#### Option B: PM2
```bash
pm2 list
pm2 restart <name_or_id>
pm2 logs <name_or_id> --lines 200
```

#### Option C: systemd
```bash
sudo systemctl restart <service-name>
sudo systemctl status <service-name> --no-pager
```

## C) Post-Deploy Smoke Check
- Buka admin EPC page.
- Confirm:
  - Generate EPC guna modal (corp code, qty, remark).
  - Batch name auto format `B-DDMMYYYY000001`.
  - Table list ada `Qty Generated`, `Qty Activated`, `Qty Inactive`.

Kalau ada error berkaitan table/column DB:
- Pastikan app start dan menjalankan patch DB (rujuk [dbPatches.js](file:///c:/Users/USER/Desktop/Damadingji_NFC/src/config/dbPatches.js)).

## D) Quick Rollback (Jika Deploy Bermasalah)
```bash
cd /www/wwwroot/<project-folder>
git log --oneline -n 20
git reset --hard <commit-hash-sebelum>

npm install
npx prisma generate
cd frontend && npm install && npm run build && cd ..

# restart ikut setup (aaPanel/pm2/systemd)
```

