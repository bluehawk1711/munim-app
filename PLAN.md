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
│   └── core/            ← THE SHARED BRAIN (all business logic lives here)
│       ├── src/db/      Drizzle schema + Neon HTTP client + migrations
│       ├── src/services/ stock, sales, invoices, job letters, parties, advances,
│       │                payments, dashboard, reports, settings, activity
│       ├── src/billing/ shared bill/invoice model + generation (used by ALL 3 apps)
│       ├── src/types/   global domain types (defined ONCE, imported everywhere)
│       └── src/utils/   numberToWords, SKU/barcode, invoice numbering, currency, id
├── apps/
│   ├── web/             Next.js — full management web app
│   │                    (migrated from stockPilot + job-and-bill-gen)
│   ├── desktop/         Tauri v2 desktop app
│   │                    (scaffolded from kitlib/tauri-app-template)
│   └── mobile/          React Native app (Android + iOS)
│                        (scaffolded from react-native-community/template)
├── .github/workflows/   CI: desktop build (tauri-action), mobile EAS dev build
├── docs/                PLAN.md (this file), ARCHITECTURE.md (decisions/memories)
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
  (typechecks clean)

### Phase 1 — Plans, rules & memories ✅
- [x] `PLAN.md` — this file, with the full feature list below
- [x] `AGENTS.md` — hard rules (no `any`/`unknown`, global types, reuse core)
- [x] `docs/ARCHITECTURE.md` — architecture decision record + skills to use
- [x] README files for root, desktop, mobile

### Phase 2 — Shared bill/invoice generation lives in `packages/core` ✅
- [x] `buildBillDocument()` + `renderBillText()` in `packages/core/src/billing/`
      (totals, amount-in-words, invoice numbering, item snapshots).
- [x] Web keeps its legacy jsPDF renderer (migration path documented); desktop
      renders the SAME `BillDocument` via jsPDF (`apps/desktop/src/lib/billPdf.ts`);
      mobile shares it via `Share` (text). All apps produce identical numbers.
- [x] Bill types defined once in core (`BillDocument`, `BillLine`, …).

### Phase 3 — Desktop app (Tauri v2) — from `kitlib/tauri-app-template` ✅
- [x] Scaffolded `apps/desktop` from the template, branded Munim (`com.munim.desktop`)
- [x] Wired to `@munim/core` (fetch → Neon directly from the webview)
- [x] Screens: Dashboard, Products & Stock, Sales, Billing (shared bill gen + PDF),
      Parties & Khata, Job Letters, Settings (shop profile + DB connection)
- [x] `.github/workflows/desktop-build.yml` — Windows NSIS via `tauri-action`, artifacts

### Phase 4 — Mobile app (React Native) — from `react-native-community/template` ✅
- [x] Scaffolded `apps/mobile` from the template at stable tag `0.86.2` (bare RN, TS)
- [x] Wired to `@munim/core` (fetch → Neon directly from the device)
- [x] Metro monorepo config (watchFolders / nodeModulesPaths)
- [x] Screens: Dashboard, Products & Stock, Quick Sale, Billing (shared bill gen +
      share), Parties & Khata, Settings (DB connection)
- [x] `eas.json`: development (debug APK `:app:assembleDebug`), preview, release
- [x] `.github/workflows/mobile-eas-build.yml` — EAS Android dev build

### Phase 5 — Validation ✅ (in progress)
- [x] Core + web + desktop + mobile all typecheck clean
- [x] Web migrated (stockPilot + job-and-bill-gen merged, `job-and-bill-gen` removed)
- [ ] Code review + final CI sanity pass

### Phase 5 — Validation & polish
- Typecheck every app + core (strict, `noUncheckedIndexedAccess`)
- Build web (next build), build core, `tsc` desktop/mobile
- Code review, READMEs final pass

---

## Full feature list

### 1. Stock management (all apps)
- [ ] Products with SKU, barcode, name, color/size variants, buy price, sell price,
      current stock, low-stock threshold
- [ ] Stock-in (purchases), stock-out (sales), manual adjustments — all recorded
- [ ] Stock history per product; low-stock alerts on dashboard
- [ ] Product catalog with color/size lookups; product images
- [ ] CSV/Excel stock export (web)

### 2. Money & invoice management (all apps)
- [ ] Create bills/invoices with multiple line items, discount, tax
- [ ] **Amount-in-words via shared `numberToWords` (core)**
- [ ] Duplicate / two-in-one bill templates
- [ ] Invoice numbering (auto, shared generator in core)
- [ ] Paid / partial / unpaid statuses; record payments against an invoice
- [ ] Per-sale profit (sell − buy) and totals; reports
- [ ] PDF export — one shared bill generator in core

### 3. Parties, advances & ledger — "whom did I give money / who owes me" (all apps)
- [ ] Party registry (customer/supplier)
- [ ] **Advance given** (money you gave them → receivable)
- [ ] **Advance taken** (money you owe them → payable)
- [ ] Full ledger/statement per party; net balance (khata)
- [ ] Record payments/settlements; activity log

### 4. Job letters (all apps)
- [ ] Job/offer letter generator with templates
- [ ] PDF export (shared generation)

### 5. Dashboard & reports (all apps)
- [ ] Today's/period revenue, profit, top products
- [ ] Pending payments, advance summary (given vs taken)
- [ ] Low-stock list; recent activity
- [ ] Sales & stock reports (web)

### 6. Settings (all apps)
- [ ] Shop/business profile (name, address, phone, tax id)
- [ ] Invoice prefix, currency, defaults

### 7. Data layer
- [ ] Single Neon Postgres database — all apps read/write the same data live
- [ ] `drizzle-orm/pg-proxy` fetch driver works in Node, Tauri webview, RN
- [ ] Migrations via drizzle-kit from `packages/core`

### 8. CI/CD
- [ ] Desktop: GitHub Actions → Tauri Windows NSIS build, artifact upload
- [ ] Mobile: GitHub Actions → EAS Build Android **development** build (debug APK)
- [ ] Web: typecheck + production build in CI
