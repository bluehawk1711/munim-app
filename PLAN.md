# Munim — Master Development Plan

> One shop-management system. Three apps. One shared brain (`packages/core`).
> **No API server.** All three apps talk directly to a Neon Postgres database over
> SQL-over-HTTP using `drizzle-orm/pg-proxy` (pure `fetch` — works in Node,
> Tauri webview, and React Native).

---

## The monorepo

```
munim/
├── packages/
│   ├── core/            ← THE SHARED BRAIN (all business logic lives here)
│   │   ├── src/db/      Drizzle schema + Neon HTTP client + migrations
│   │   ├── src/services/ stock, sales, invoices, job letters, parties, advances,
│   │   │                payments, dashboard, reports, settings, activity, security
│   │   ├── src/billing/ shared bill/invoice model + generation (used by ALL 3 apps)
│   │   ├── src/security/ PIN hashing/verify (pure-TS SHA-256, works on Hermes)
│   │   ├── src/types/   global domain types (defined ONCE, imported everywhere)
│   │   └── src/utils/   numberToWords, SKU/barcode, invoice numbering, currency, id
│   ├── ui/              ← SHARED UI KIT (web + desktop render identically from here)
│   │   └── src/components/ SettingsShell, BillTemplateOptions, RecordPaymentDialog,
│   │                      KhataActionDialog, ConfirmDialog, QuickAdvanceRecord,
│   │                      SummaryTile, KhataCard, InvoiceStatusBadge, LedgerKindBadge,
│   │                      ThemeSwatches, AnimatedThemeToggle, Switch, Skeleton,
│   │                      PinGate/PinSettingsCard, theme-select
│   └── theme/           ← SINGLE SOURCE OF TRUTH for colors/radius (5 themes, light+dark)
│       └── src/tokens.ts  + dist/tokens.css (generated) + mobileColorsFor()
├── apps/
│   ├── web/             Next.js 16 — full management web app
│   │                    (migrated from stockPilot + job-and-bill-gen)
│   ├── desktop/         Tauri v2 desktop app
│   │                    (scaffolded from kitlib/tauri-app-template)
│   └── mobile/          React Native app (Android + iOS), Expo SDK 57 dev client
│                        (scaffolded from react-native-community/template)
├── .github/workflows/   desktop-build, mobile-eas-build, web, lint, db-migrate
├── docs/                PLAN.md (this file), ARCHITECTURE.md (decisions/memories),
│                        features.md (feature × platform matrix), theme.md, i18n-hindi.md
└── AGENTS.md            Rules for AI agents & developers
```

---

## Phases

### Phase 0 — Foundations ✅ (done)
- pnpm workspaces + Turborepo at root
- `packages/core` with Drizzle Postgres schema (13 tables), Neon HTTP client,
  all services, utils (numberToWords, SKU, invoice numbers, ids, formatting)
- Drizzle migrations generated (`packages/core/drizzle/`)
- Web app migrated from stockPilot + job-and-bill-gen and rewired to core

### Phase 1 — Plans, rules & memories ✅ (done)
- `PLAN.md` — this file, with the full feature list below
- `AGENTS.md` — hard rules (no `any`/`unknown`, global types, reuse core)
- `docs/ARCHITECTURE.md` — architecture decision record + skills to use
- README files for root, desktop, mobile

### Phase 2 — Shared bill/invoice generation lives in `packages/core` ✅ (done)
- `buildBillDocument()` + `renderBillText()` / `renderBillHtml()` in
  `packages/core/src/billing/` (totals, amount-in-words, invoice numbering,
  item snapshots, template settings).
- Desktop renders the shared `renderBillHtml` via jsPDF
  (`apps/desktop/src/lib/billPdf.ts`); mobile shares it via `expo-print` (PDF);
  web keeps its rich jsPDF templates (content identical). All apps produce
  identical numbers.
- Bill types defined once in core (`BillDocument`, `BillLine`, …).

### Phase 3 — Desktop app (Tauri v2) — from `kitlib/tauri-app-template` ✅ (done)
- Scaffolded `apps/desktop` from the template, branded Munim (`com.munim.desktop`)
- Wired to `@munim/core` (fetch → Neon directly from the webview)
- Screens: Dashboard, Products & Stock, Catalog, Sales, Billing (shared bill gen
  + PDF + 2-in-1 sheets), Invoices, Parties & Khata, Advances, Job Letters,
  Reports (CSV export), Settings (Shop / Appearance / Security / Database)
- `.github/workflows/desktop-build.yml` — Windows NSIS via `tauri-action`, artifacts

### Phase 4 — Mobile app (React Native) — from `react-native-community/template` ✅ (done)
- Scaffolded `apps/mobile` from the template at stable tag `0.86.2`; Expo SDK 57
  dev client (`expo-dev-client`), TypeScript
- Wired to `@munim/core` (fetch → Neon directly from the device)
- Metro monorepo config (watchFolders / nodeModulesPaths)
- Screens: Home, Products, Sales, Billing, Parties, Letters, Catalog, Reports,
  Invoices, Advances, Settings (all overflow sections from the More tab)
- `eas.json`: development (dev-client APK), preview (release APK), release (AAB)
- `.github/workflows/mobile-eas-build.yml` — EAS Android dev build (**manual
  trigger only** — a new build is only needed when a native dependency changes)
- Local builds: `pnpm build:android` / `pnpm build:android:release` via
  `scripts/build-android.mjs`

### Phase 5 — Validation & polish ✅ (done)
- Core + web + desktop + mobile all typecheck clean; lint workflow in CI
- Web deploys on Vercel (`apps/web` root; no `output: "standalone"`)
- Feature parity: all 11 modules on all 3 platforms (see `docs/features.md`);
  web + desktop share `@munim/ui`; mobile tracked separately
- Migrations deploy via `db-migrate.yml` CI (drift-check + migrate jobs), not `db:push`

### Phase 6 — Current & next (in progress)
- [ ] **Hindi language support** — full plan in `docs/i18n-hindi.md`
      (typed dictionaries in a shared package, per-app providers, settings-column
      sync, Hindi number-to-words + Indian digit grouping, optional Devanagari
      numerals; bills/letters stay English by default)
- [ ] Code review + final CI sanity pass on any remaining module

---

## Full feature list — all shipped ✅ (see docs/features.md for the platform matrix)

### 1. Stock management (all apps)
- Products with SKU, barcode, name, color/size variants, buy price, sell price,
  current stock, low-stock threshold
- Stock-in (purchases), stock-out (sales), manual adjustments with reason — all
  recorded as movements
- Stock history per product; low-stock alerts on dashboard
- Product catalog with color/size lookups (add/rename/delete, product-count guards)
- Product image upload (Cloudinary — signed route on web, unsigned preset on
  desktop/mobile) + thumbnails
- Search products by name/SKU/color/size (all apps)

### 2. Money & invoice management (all apps)
- Create bills/invoices with multiple line items, discount, delivery charge, date,
  notes/terms, party link
- **Amount-in-words via shared `numberToWords` (core)**
- Duplicate / two-in-one bill templates (separate or duplicate, classic colors)
- Invoice numbering (auto, shared generator in core)
- Paid / partial / unpaid statuses; record payments against an invoice
- Per-sale profit (sell − buy) and totals; reports
- PDF export — one shared bill generator in core (`renderBillHtml`)

### 3. Parties, advances & ledger — "whom did I give money / who owes me" (all apps)
- Party registry (customer/supplier/worker/other)
- **Advance given** (money you gave them → receivable)
- **Advance taken** (money you owe them → payable)
- Full ledger/statement per party; net balance (khata)
- Record payments/settlements; settle advances; activity log

### 4. Job letters (all apps)
- Job/offer letter generator with templates (shared `JobLetterData` + `renderJobLetterHtml`)
- PDF export (web rich jsPDF; desktop + mobile shared HTML via jsPDF / expo-print)

### 5. Dashboard & reports (all apps)
- Today's/period revenue, profit, top products
- Pending payments, advance summary (given vs taken)
- Low-stock list; recent activity
- Daily/weekly/monthly/yearly/stock/low-stock/sold reports + **custom date range
  on any type**; CSV export (shared `reportToCsv`) on all apps, Excel+PDF on web

### 6. Settings (all apps)
- Shop/business profile (name, address, phone, email, currency, low-stock threshold)
- Appearance: 5 color themes + light/dark (theme AND mode sync via the shared
  `settings` row), "force theme transition" toggle (device-local)
- Security: 4-digit PIN app lock (per-device; test account 1234)
- Database: Neon connection string (desktop/mobile local + masked; web from env)
- Web + desktop share the `SettingsShell` sectioned layout; mobile mirrors it as
  grouped cards

### 7. Data layer
- Single Neon Postgres database — all apps read/write the same data live
- `drizzle-orm/pg-proxy` fetch driver works in Node, Tauri webview, RN
- Migrations via drizzle-kit from `packages/core`, applied by CI (`db-migrate.yml`)

### 8. CI/CD
- **Desktop:** GitHub Actions → Tauri Windows NSIS build, artifact upload
- **Mobile:** GitHub Actions → EAS Build Android **development** build
  (**manual trigger**) — needs `EXPO_TOKEN` secret
- **Web:** `web.yml` — typecheck + production build on push/PR; deploys on Vercel
- **Lint:** `lint.yml` — ESLint across the repo (typed no-any/no-unknown rules)
- **DB:** `db-migrate.yml` — drift-check (migrations committed) + migrate on main
