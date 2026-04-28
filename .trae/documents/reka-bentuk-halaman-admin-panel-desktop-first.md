# Spesifikasi Reka Bentuk Halaman (Desktop-first) — Admin Panel (Data Live)

## Global Styles (Design Tokens)
- Layout: Desktop-first, max-width 1280px (content), grid 12 kolum; sidebar fixed + content scroll.
- Warna: background #0B1220; surface #111B2E; border #24314D; text utama #E6EDF7; text sekunder #A9B7D0; accent #4F8CFF; danger #FF5A6A; success #25C27A.
- Tipografi: 14px base; heading 24/20/16; monospace untuk ID (optional).
- Komponen:
  - Button: primary (accent), secondary (surface), danger.
  - Input: border halus + focus ring accent.
  - Table: header sticky, zebra ringan, hover row.
- Interaksi: hover 150ms, loading skeleton untuk jadual, toast untuk success/error.

## Page 1 — Log Masuk Admin
- Meta:
  - Title: "Admin Login"
  - Description: "Log masuk untuk akses admin panel"
- Layout: Centered card (Flexbox), lebar 420px.
- Struktur:
  1. Brand/Logo (kiri atas dalam card)
  2. Tajuk + penerangan ringkas
  3. Form: Email, Kata laluan
  4. CTA: "Log Masuk"
  5. Error state: mesej ralat di bawah form, highlight field
- States:
  - Loading: disable CTA + spinner
  - Rate/lockout UI: paparkan mesej jika terlalu banyak percubaan

## Page 2 — Dashboard Admin
- Meta:
  - Title: "Admin Dashboard"
  - Description: "Ringkasan dan status data live"
- Layout: Sidebar kiri (fixed 260px) + content kanan (CSS Grid).
- Struktur (Content):
  1. Topbar: breadcrumbs, search global (optional), avatar + menu log keluar
  2. KPI Cards (grid 3–4): jumlah rekod, jumlah pengguna, aktiviti terbaru
  3. Panel "Status Data Live":
     - Indicator (Live/Offline)
     - Last sync time
     - Button "Refresh" bila offline
  4. Quick links: butang ke Records, Users, Audit

## Page 3 — Pengurusan Rekod (Senarai)
- Meta:
  - Title: "Manage Records"
  - Description: "Senarai rekod dengan carian dan kemas kini live"
- Layout: Content full-width dalam container; table utama.
- Struktur:
  1. Header: tajuk + CTA "Tambah Rekod"
  2. Filter bar:
     - Search input
     - Dropdown status
     - Date range (minimum: from/to)
     - Clear filters
  3. Table:
     - Kolum minimum: ID, Title, Status, Updated At, Actions
     - Actions: View/Edit, Delete
  4. Pagination footer
- States:
  - Live update: row berubah/masuk dengan highlight ringkas
  - Empty: ilustrasi ringkas + cadangan buang filter

## Page 4 — Butiran Rekod
- Meta:
  - Title: "Record Details"
  - Description: "Paparan dan kemas kini rekod"
- Layout: Two-column (Grid): kiri (form), kanan (activity panel) pada desktop.
- Struktur:
  1. Header: Back to list + ID rekod
  2. Form edit:
     - Title (text)
     - Status (select)
     - Payload (textarea/json viewer ringkas)
     - CTA: Save changes
  3. Panel kanan: "Perubahan Terbaru" (siapa/bila/aksi)
- States:
  - Validation: inline error
  - Save success: toast + updated_at dikemas kini

## Page 5 — Pengurusan Pengguna & Peranan
- Meta:
  - Title: "Users & Roles"
  - Description: "Urus akses admin"
- Layout: Table + side drawer modal untuk edit peranan.
- Struktur:
  1. Header: tajuk
  2. Search pengguna
  3. Table: Email/Name, Role, Status (Active), Updated, Actions
  4. Action: Edit role, Toggle active (confirm)
- Guardrails UI:
  - Papar label "Super Admin only"
  - Disable actions jika bukan Super Admin

## Page 6 — Audit Log
- Meta:
  - Title: "Audit Log"
  - Description: "Jejak aktiviti pentadbiran"
- Layout: Filter bar + table; sort by latest.
- Struktur:
  1. Filters: pengguna, action type, date range
  2. Table: Masa, Actor, Action, Target, Ringkasan
  3. Row details (expand): metadata JSON ringkas
- States:
  - Live: log baru muncul di atas dengan badge "New"

## Responsiveness (Ringkas)
- Tablet: sidebar jadi collapsible drawer.
- Mobile: susun single-column; table jadi card list; tindakan utama kekal di atas.
