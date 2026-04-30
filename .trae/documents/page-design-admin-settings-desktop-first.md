# Admin Settings Page Design (Desktop-first)

## Layout
- Primary layout: AdminShell provides a 2-column layout (left sidebar + right content).
- Inside the right content, Settings renders within the existing white container (`<main> -> card`) and uses a stacked vertical layout.
- Forms use CSS Grid for desktop (2 columns where appropriate) and collapse to 1 column on small screens.
- Spacing: 16–24px vertical rhythm (Tailwind `space-y-4/6`, `p-4 sm:p-6 lg:p-8`).

## Meta Information
- Title: "Settings — Admin Console"
- Description: "Manage your profile and system settings."
- Open Graph:
  - og:title: "Admin Settings"
  - og:description: "Update profile and system configuration"
  - og:type: "website"

## Global Styles
- Background:
  - App background: `bg-zinc-100` (from AdminShell)
  - Content containers: `bg-white`, border `border-zinc-200`, radius `rounded-xl`
- Typography:
  - Page title: `text-base font-semibold text-zinc-900`
  - Helper text: `text-sm text-zinc-600`
  - Section titles: `text-sm font-semibold text-zinc-900`
  - Field labels: `text-xs font-medium text-zinc-700`
- Controls:
  - Inputs: `border border-zinc-200 rounded-lg px-3 py-2 text-sm`
  - Focus: `focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600`
  - Primary button: `bg-blue-600 text-white hover:bg-blue-700` (disabled: `opacity-50 cursor-not-allowed`)
  - Secondary button (optional): `border border-zinc-200 bg-white hover:bg-zinc-50`
- Links: `text-blue-600 hover:underline`
- Accents: blue for primary actions; slate for admin chrome.

## Page Structure
1. Page header (title + helper text)
2. Profile Settings card (form)
3. System Settings card (form)

## Sections & Components

## 1) Page Header
- Placement: top of page content, aligned left.
- Elements:
  - Title: "Settings"
  - Subtitle/helper: short description (matches screenshot’s header + hint layout).

## 2) Profile Settings Card
- Container: `rounded-xl border border-zinc-200 bg-white p-4`.
- Header row:
  - Section title: "Profile Settings"
  - Short hint text below title (smaller, muted).
- Form layout:
  - Desktop grid: 2 columns, gap 16px.
  - Fields (standard profile set):
    - Full Name (text)
    - Email (email)
    - Role (read-only pill or disabled input)
    - Current Password (password, shown only when changing password)
    - New Password (password)
    - Confirm New Password (password)
  - Validation:
    - Inline errors under fields (`text-xs text-red-600`).
    - Disable Save while invalid or submitting.
- Actions:
  - Primary button right-aligned: "Save Changes".
  - Feedback:
    - Success: compact alert/notice within card.
    - Error: compact alert with actionable message.

## 3) System Settings Card
- Container: same styling as Profile card; placed below with `mt-3/4`.
- Header row:
  - Section title: "System Settings"
  - Hint text below title.
- Form layout:
  - Desktop grid: 2 columns, gap 16px.
  - Fields (keep aligned to what you expose in UI):
    - Organization Name (text)
    - Organization Code (text, uppercase)
    - Default Locale (select)
    - Default Timezone (select)
    - Maintenance Mode (toggle switch)
- Permissions:
  - If the user lacks rights, show read-only values and disable Save.
- Actions:
  - Primary button right-aligned: "Save Settings".

## Responsive behavior
- ≤640px: stack all fields into a single column; buttons become full-width.
- Sidebar: remains handled by AdminShell (mobile toggle).

## Interaction states
- Loading:
  - Skeleton rows within each card or a subtle spinner beside section title.
- Dirty state:
  - Enable Save only when changes are made; optionally show "Unsaved changes" text.
- Navigation consistency:
  - Left sidebar highlights Settings as active (existing AdminShell `NavLink` behavior).
