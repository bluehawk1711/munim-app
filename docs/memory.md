# Munim — Project Memory & Complete Reference

> **Last updated:** 2026-09-02 · **Current commit:** `dd38fd3`
>
> This file is the single source of truth for understanding the Munim project.
> Read it when you pick up work. Append new decisions here instead of re-litigating old ones.

---

## Table of Contents

1. [What Munim Is](#1-what-munim-is)
2. [Architecture at a Glance](#2-architecture-at-a-glance)
3. [Tech Stack](#3-tech-stack)
4. [Workspace Structure](#4-workspace-structure)
5. [Data Flow](#5-data-flow)
6. [Key Decisions (ADR Summary)](#6-key-decisions-adr-summary)
7. [Shared Packages](#7-shared-packages)
8. [Platform Details](#8-platform-details)
9. [Label Printing System](#9-label-printing-system)
10. [Theme System](#10-theme-system)
11. [State Management & Caching](#11-state-management--caching)
12. [CI/CD](#12-cicd)
13. [Database & Migrations](#13-database--migrations)
14. [Feature Matrix](#14-feature-matrix)
15. [Known Issues & Next Steps](#15-known-issues--next-steps)
16. [Docs Index](#16-docs-index)
17. [How to Add a Feature](#17-how-to-add-a-feature)
18. [Troubleshooting](#18-troubleshooting)

---

## 1. What Munim Is

Munim is a **shop management app** for Indian dukaan (shop) owners. One business brain, three apps:

| App | What it does | Stack |
|---|---|---|
| **Web** | Full management dashboard in the browser | Next.js 16, React 19, Tailwind v4 |
| **Desktop** | Native Windows app | Tauri v2, React 19, Vite |
| **Mobile** | Android/iOS app | React Native 0.86, Expo SDK 57 dev client |
| **API** | The one backend all apps call | NestJS 11, Fastify, pg.Pool |

**Core modules:** Dashboard, Products (with barcode/labels), Stock, Catalog (colors/sizes/categories), Sales, Billing/Invoices (with 2-in-1 mode), Parties & Khata (ledger), Advances, Job Letters, Reports (with CSV/Excel/PDF export), Settings.

**Key guarantee:** A sale on the phone appears on the desktop app instantly — all three apps read/write the same Neon Postgres database through the shared API.

---

## 2. Architecture at a Glance

```
┌─────────────┐  ┌──────────────┐  ┌──────────────┐
│   Web (SSR)  │  │  Desktop     │  │  Mobile      │
│  Next.js 16  │  │  Tauri v2    │  │  RN 0.86     │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                  │
       ▼                 ▼                  ▼
┌─────────────────────────────────────────────────┐
│  @munim/api-client (shared typed HTTP client)    │
│  @munim/query (TanStack Query hooks)             │
│  @munim/store (Zustand client state)             │
└──────────────────────┬──────────────────────────┘
                       │ fetch + x-api-key
                       ▼
┌─────────────────────────────────────────────────┐
│  apps/api — NestJS API (Fastify, pg.Pool)       │
│  • Per-platform API keys (API_KEY_WEB/DESKTOP/MOBILE) │
│  • Upstash Redis caching (cache-aside)           │
│  • Cloudinary signed uploads                     │
└──────────────────────┬──────────────────────────┘
                       │ createServerDb() → pg.Pool
                       ▼
┌─────────────────────────────────────────────────┐
│  @munim/core — ALL business logic               │
│  • Drizzle ORM schema + services                 │
│  • Bill/invoice generation (renderBillHtml)       │
│  • Barcode generation (EAN-13, Code 39)          │
│  • TSPL2 thermal label commands                  │
│  • PIN hashing (pure-TS SHA-256)                 │
│  • Validators (zod) + serializers                │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
              Neon Postgres (single DB)
```

**The one rule:** Business logic lives ONLY in `packages/core`. Apps are thin UIs. The API reuses core functions unchanged with a `pg.Pool`-backed Drizzle client.

---

## 3. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| **Monorepo** | pnpm 11 workspaces + Turborepo | `pnpm-workspace.yaml`, `turbo.json` |
| **API server** | NestJS 11 (Fastify adapter) | `apps/api` — the only server |
| **Database** | Neon Postgres + Drizzle ORM | Schema in `packages/core/src/db/schema.ts` |
| **Cache** | Upstash Redis (REST SDK) | `@upstash/redis` in `apps/api/src/common/cache.service.ts` |
| **Web** | Next.js 16 (Turbopack) | `apps/web` |
| **Desktop** | Tauri v2 + Vite + React 19 | `apps/desktop` — scaffolded from `kitlib/tauri-app-template` |
| **Mobile** | React Native 0.86 + Expo SDK 57 | `apps/mobile` — bare RN (not Expo managed) |
| **Shared UI** | shadcn/ui + Tailwind v4 | `packages/ui` — web + desktop render from here |
| **Shared theme** | 5 curated themes × light/dark | `packages/theme` — single source of truth |
| **State** | TanStack Query (server) + Zustand (client) | `packages/query` + `packages/store` |
| **API client** | Shared typed fetch wrapper | `packages/api-client` — one client for all apps |
| **Validation** | Zod (shared schemas in core) | `packages/core/src/validators/` |
| **PDF** | jsPDF (web/desktop) + expo-print (mobile) | Bill/invoice/label/job-letter PDFs |
| **Barcode** | Pure TS (EAN-13 + Code 39) | `packages/core/src/utils/barcode.ts` |
| **Thermal printing** | TSPL2 native commands | `packages/core/src/billing/labelTspl.ts` |

---

## 4. Workspace Structure

```
munim/
├── apps/
│   ├── api/                  NestJS API server
│   ├── web/                  Next.js web app
│   ├── desktop/              Tauri v2 desktop app
│   └── mobile/               React Native app (bare RN)
├── packages/
│   ├── core/                 ALL business logic, schema, services, utils
│   ├── api-client/           Shared typed HTTP client
│   ├── query/                Shared TanStack Query hooks
│   ├── store/                Shared Zustand client state
│   ├── ui/                   Shared UI kit (web + desktop)
│   └── theme/                Design tokens (5 themes × light/dark)
├── docs/                     Documentation
├── .github/workflows/        CI/CD
├── AGENTS.md                 Rules for AI assistants
└── turbo.json                Turborepo config
```

**Key files:**

| Path | What it is |
|---|---|
| `packages/core/src/db/schema.ts` | All tables (products, invoices, items, parties, advances, payments, job letters, settings, activity) |
| `packages/core/src/services/*` | Business logic: products, invoices, parties, advances, payments, jobLetters, dashboard, settings, activity |
| `packages/core/src/billing/*` | Bill/invoice generation + label printing (all 3 apps) |
| `packages/core/src/security/pin.ts` | PIN hashing/verify (pure-TS SHA-256) |
| `packages/core/src/utils/barcode.ts` | Barcode generation (EAN-13, Code 39) + SVG rendering |
| `packages/core/src/validators/*` | Shared zod request schemas (API + web) |
| `packages/core/src/serialize/*` | Shared Date→JSON serializers |
| `packages/core/src/db/server.ts` | Server-only `pg.Pool` client (`@munim/core/server` subpath) |
| `apps/api/src/controllers/*` | NestJS controllers (1:1 with the old /api/* routes) |
| `apps/api/src/common/cache.service.ts` | Upstash Redis cache-aside wrapper |
| `apps/api/src/auth/api-key.guard.ts` | Per-platform API key authentication |
| `apps/web/src/views/*` | Web UI screens |
| `apps/desktop/src/pages/*` | Desktop screens (Tauri) |
| `apps/mobile/src/screens/*` | Mobile screens (React Native) |
| `packages/ui/src/components/*` | Shared UI components (web + desktop) |
| `packages/theme/src/tokens.ts` | Design tokens — single source of truth |
| `packages/theme/dist/tokens.css` | Generated CSS variables (consumed by web + desktop) |

---

## 5. Data Flow

### Read path (cached)
```
Screen → useProducts() [packages/query] → api.products.list() [packages/api-client]
  → fetch("GET /api/products") → ProductsController → listProducts(db, filters)
  → CacheService.cacheAside(key, 300, loader) → Neon Postgres → JSON response
```

### Write path (cache invalidation)
```
Screen → useCreateProduct() [packages/query] → api.products.create(v)
  → fetch("POST /api/products") → ProductsController → createProduct(db, v)
  → CacheService.invalidate("products") → clears products + dashboard cache
  → Mutation success → TanStack Query invalidates ["products"] → refetch
```

### Theme flow
```
User picks theme → localStorage (munim.theme) → document.documentElement.dataset.theme = "ocean"
  → tokens.css [data-theme="ocean"] variables apply instantly
  → No DB roundtrip (device-local, ADR-011b)
```

### Label printing flow
```
Product row → buildProductLabel(product, shop) [core] → ProductLabel
  ├→ renderLabelMarkup(label) → HTML preview (dialog)
  ├→ renderLabelSheetHtml(labels) → A4 print sheet (web/desktop: jsPDF, mobile: expo-print)
  └→ buildLabelTspl2(labels, opts) → TSPL2 commands → Rust printer.rs → Windows RAW spool → TSC TE244
```

---

## 6. Key Decisions (ADR Summary)

| ADR | Decision | Status | Notes |
|---|---|---|---|
| ADR-001 | No API server (SQL-over-HTTP) | **Superseded** by ADR-014 | Original architecture, replaced by NestJS |
| ADR-002 | Monorepo: pnpm + Turborepo | ✅ Accepted | |
| ADR-003 | `packages/core` = single source of truth | ✅ Accepted | Schema, types, services, utils all in core |
| ADR-004 | Desktop from `kitlib/tauri-app-template` | ✅ Accepted | Vite + React 19 + Tailwind v4 + shadcn/ui + Tauri v2 |
| ADR-005 | Mobile from `react-native-community/template` | ✅ Accepted | Bare RN 0.86.2 (not Expo managed) |
| ADR-006 | Mobile builds via EAS Build | ✅ Accepted | `eas.json` profiles: development/preview/release |
| ADR-007 | Desktop CI: tauri-action | ✅ Accepted | Windows NSIS installer |
| ADR-008 | Shared bill/invoice generation in core | ✅ Accepted | `renderBillHtml` used by all 3 apps |
| ADR-009 | Shared UI kit `packages/ui` | ✅ Accepted | Web + desktop render from here |
| ADR-010 | Shared design tokens `packages/theme` | ✅ Accepted | 5 themes × light/dark |
| ADR-011b | Theme + dark/light mode are device-local | ✅ Accepted | Old DB sync removed (caused accent bugs) |
| ADR-012 | Per-device 4-digit PIN app lock | ✅ Accepted | SHA-256 in core, test PIN: 1234 |
| ADR-013 | Mobile build is manual-only (direct Gradle) | ✅ Accepted | No EAS; manual trigger via `workflow_dispatch` |
| ADR-014 | NestJS API server (Fastify + pg.Pool) | ✅ Complete | All 3 apps fetch through the API |
| ADR-017 | TanStack Query + Zustand (not Redux) | ✅ Accepted | Shared hooks + client state |

---

## 7. Shared Packages

### `@munim/core` — The Brain
- **Schema:** `src/db/schema.ts` — all tables, relations, types
- **Services:** `src/services/*.ts` — pure functions taking a Drizzle client
- **Billing:** `src/billing/` — bill/invoice/job-letter/label generation
- **Barcode:** `src/utils/barcode.ts` — EAN-13 + Code 39 generation + SVG
- **Security:** `src/security/pin.ts` — pure-TS SHA-256 PIN hashing
- **Validators:** `src/validators/*.ts` — shared zod schemas
- **Serializers:** `src/serialize/*.ts` — Date→JSON wire format
- **Server DB:** `src/db/server.ts` — `createServerDb()` for the API

### `@munim/api-client` — The HTTP Client
- `createApiClient({ baseUrl, apiKey, fetchImpl? })` → typed endpoints
- Methods mirror core service names: `api.products.list()`, `api.invoices.create()`
- DTOs re-exported from core (never redefined)
- `fetchImpl` is injectable (desktop passes Tauri HTTP-plugin fetch)

### `@munim/query` — Server State
- TanStack Query hooks over the api-client
- Query keys: `["products","list",filters]`, `["dashboard"]`, etc.
- StaleTime: 30s, retry: 1, refetchOnWindowFocus: false
- Mutations invalidate the same groups as the API's cache

### `@munim/store` — Client State
- Zustand factory: active view/tab, global search, cross-view filters, sell dialog
- Platform-specific persistence (localStorage / AsyncStorage)

### `@munim/ui` — Shared Components (Web + Desktop)
- SettingsShell, Dialog, Select, Button, Skeleton, ThemeSelect, AnimatedThemeToggle
- BillTemplateOptions, RecordPaymentDialog, KhataActionDialog, ConfirmDialog
- PinGate, PinSettingsCard, ConnectionTestDialog, LabelPrintDialog
- BarcodeSvg, BarcodeLookupInput, SummaryTile, KhataCard, InvoiceStatusBadge
- Sonner (self-contained toast — never import from "sonner" directly)

### `@munim/theme` — Design Tokens
- `src/tokens.ts` — 5 themes (apple/ocean/forest/rose/midnight) × light + dark
- `mobileColorsFor(mode, themeName)` — hex palette for React Native
- `generate-css.mjs` — outputs `dist/tokens.css` (CSS custom properties)

---

## 8. Platform Details

### Web (`apps/web`)
- **Stack:** Next.js 16 (Turbopack), React 19, Tailwind v4
- **Views:** dashboard, products, sales, catalog, invoices, billing, job-letter, parties, advances, reports, settings
- **Auth:** PIN gate (30-day session cookie), login page
- **Exports:** Excel + PDF (reports), jsPDF bill templates, job-letter PDF
- **Settings:** `SettingsShell` sectioned layout (Shop profile / Appearance / Security / Server)
- **Header:** light/dark toggle only (color theme in Settings)
- **Navigation:** URL-synced tabs (`?view=…`), browser back/forward
- **SEO:** title template, description, Open Graph, Twitter card in `layout.tsx`
- **Env:** `NEXT_PUBLIC_API_URL` + `NEXT_PUBLIC_API_KEY` (build-time)

### Desktop (`apps/desktop`)
- **Stack:** Tauri v2 + Vite + React 19 + Tailwind v4
- **Pages:** dashboard, products, catalog, sales, billing, invoices, parties, advances, job-letters, reports, settings
- **API:** `@tauri-apps/plugin-http` (Rust fetch, no CORS)
- **Settings:** same `SettingsShell` + Printing section (thermal printer selection)
- **Thermal printing:** Rust `printer.rs` spools TSPL2 commands raw to Windows print queue
- **PDF:** bill/job-letter/label via jsPDF `html()` of shared core HTML
- **Env:** `VITE_API_URL` + `VITE_API_KEY` (build-time, override in Settings)

### Mobile (`apps/mobile`)
- **Stack:** React Native 0.86 + Expo SDK 57 dev client
- **Screens:** home, products, sales, billing, parties, letters, catalog, reports, invoices, advances, settings
- **API:** global fetch (native, no CORS)
- **Native modules:** `expo-image-picker`, `@react-native-community/datetimepicker`, `expo-camera` — require dev build rebuild
- **PDF:** `expo-print` + `renderBillHtml` / `renderJobLetterHtml` / `renderLabelSheetHtml`
- **Env:** `EXPO_PUBLIC_API_URL` + `EXPO_PUBLIC_API_KEY` (build-time, override in Settings)

---

## 9. Label Printing System

### Overview
The label system prints product labels — either on a normal printer (A4 sheet) or directly to a thermal barcode printer (TSC TE244 etc.).

### Three layers

**1. Core (`packages/core/src/billing/`)**

- `labelDocument.ts` — `ProductLabel` type, `buildProductLabel()`, `renderLabelMarkup()` (HTML preview), `renderLabelSheetHtml()` (A4 sheet), `renderLabelText()` (plain text)
- `labelTspl.ts` — `buildLabelTspl2()` emits native TSPL2 commands for thermal printers
- `barcode.ts` — `barcodeSvg()`, `ean13Svg()`, `code39Svg()`, `generateEan13()`, `isEan13()`

**2. Desktop platform bridge (`apps/desktop/src/lib/`)**

- `printer.ts` — Tauri ↔ core bridge: `listLabelPrinters()`, `printLabelsToThermal()`, `getSavedLabelPrinter()`
- `labelPdf.ts` — `downloadLabelPdf()` (jsPDF + rasterize), `printLabelHtml()` (window.print)
- Rust backend: `src-tauri/src/printer.rs` — `list_printers` (Win32 EnumPrintersW), `print_raw` (RAW datatype spooling)

**3. Shared UI (`packages/ui/src/components/`)**

- `label-print-dialog.tsx` — `LabelPrintDialog` (preview, copies stepper, Print/Download PDF/Direct thermal)
- `label.tsx` — `BarcodeSvg` component

### TSPL2 thermal layout (current, for TSC TE244)

```
┌───────────────────────────┐  45×30mm at 203 DPI (360×240 dots)
│                           │
│  Rakhi          (8pt)     │  ← Name (left side, top)
│                           │
│  |||||||||||||||||||||||  │  ← Barcode (right side, 32% height)
│    521839443640           │     EAN-13: 12 digits + printer check digit
│                           │     Code 128: fallback for non-EAN values
│  24.5 g          (7pt)    │  ← Weight (left side, bottom)
│                           │
└───────────────────────────┘
  ← 42% text →│← 52% barcode →
```

**Key TSPL2 parameters:**
- `DIRECTION 0` — origin at top-left, Y increases downward
- `FONT "0"` — Monotype scalable, x/y params = point sizes
- `BARCODE "EAN13"` — expects 12 digits (printer calculates check digit)
- `BARCODE "128"` — narrow=1, wide=2 (fits in right half of 45mm label)
- `CODEPAGE UTF-8` — for Hindi/Unicode text

**Label stock sizes (verified):**
| Size | Width dots | Height dots |
|---|---|---|
| 45 × 30mm | 360 | 240 |
| 40 × 25mm | 320 | 200 |
| 50 × 30mm | 400 | 240 |

Full TSPL2 reference + TE244 audit: `docs/tspl2-reference.md`

---

## 10. Theme System

### How it works
- **Single source:** `packages/theme/src/tokens.ts` — 5 themes × light + dark
- **Web + desktop:** `tokens.css` (CSS custom properties, `[data-theme]` blocks)
- **Mobile:** `mobileColorsFor(mode, themeName)` → hex palette (RN can't read CSS variables)

### Five themes
| Name | Light primary | Dark primary | Vibe |
|---|---|---|---|
| `apple` (default) | `#846324` gold | `#b69255` | Warm silver/gold |
| `ocean` | `#1d5bd6` | `#6da3ff` | Cool blues |
| `forest` | `#177245` | `#57c98a` | Natural greens |
| `rose` | `#b8436f` | `#f07ba8` | Warm blush pinks |
| `midnight` | `#4f46e5` | `#818cf8` | Deep indigo |

### How theme switching works
- **Web + desktop:** `document.documentElement.dataset.theme = "ocean"` → CSS variables swap instantly
- **Mobile:** `ThemeProvider` swaps the palette (AsyncStorage persistence)
- **Light/dark:** `.dark` class on root (web/desktop), `useColorScheme` + AsyncStorage (mobile)
- **Force animation:** Device-local toggle (`munim.forceThemeTransition`) plays the wipe even with reduced motion

### Adding a new theme
1. Add `light` + `dark` to `themes` in `tokens.ts`
2. Add to `themeNames`, `themeLabels`, `themeSwatches`
3. Rebuild: `pnpm --filter @munim/theme build`
4. No app code changes needed

---

## 11. State Management & Caching

### Server state (TanStack Query)
- **`@munim/query`** — shared hooks over the api-client
- Query keys: `["products","list",filters]`, `["dashboard"]`, `["settings"]`, etc.
- StaleTime: 30s, retry: 1, refetchOnWindowFocus: false
- Mutations invalidate matching cache groups

### Client state (Zustand)
- **`@munim/store`** — active view/tab, global search, cross-view filters, sell dialog
- Platform-specific persistence

### API-level caching (Upstash Redis)
- `CacheService` in `apps/api` — cache-aside + explicit prefix invalidation
- Keys namespaced `munim:*`; TTL varies (30s–300s)
- Writes invalidate conservative groups (products → products + dashboard)
- Falls back to in-process TTL Map when Upstash is unavailable

---

## 12. CI/CD

| Workflow | Trigger | What it does |
|---|---|---|
| `render.yaml` | push to `main` | Deploys `munim-api` on Render |
| `desktop-build.yml` | **manual** (`workflow_dispatch`) | Windows NSIS installer via `tauri-action` |
| `mobile-build.yml` | **manual** (`workflow_dispatch`) | Android APK via Gradle (no EAS) |
| `web.yml` | **manual** | Web typecheck + `next build` |
| `lint.yml` | **manual** | ESLint across the repo |
| `db-migrate.yml` | **manual** | Drift-check + apply migrations to Neon |

**Build-time secrets:**
- Desktop: `VITE_API_URL`, `VITE_API_KEY` (required), `VITE_CLOUDINARY_*` (optional)
- Mobile: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_API_KEY` (required), `EXPO_PUBLIC_CLOUDINARY_*` (optional)
- Both workflows fail fast when required secrets are missing

---

## 13. Database & Migrations

### Schema location
`packages/core/src/db/schema.ts` — all tables (products, invoices, items, parties, advances, payments, job letters, settings, activity, colors, sizes, categories)

### Migration workflow
1. Edit `schema.ts`
2. Run `pnpm db:generate` from root → writes `packages/core/drizzle/000N_*.sql`
3. Commit everything under `packages/core/drizzle/`
4. CI drift-check enforces committed migrations; `migrate` job applies to Neon

### Local dev
- `pnpm db:push` — schema push (local scratch only)
- `pnpm db:studio` — Drizzle Studio
- `packages/core/.env` must contain `DATABASE_URL` (drizzle-kit reads from config dir)

### pnpm driver-resolution quirk
- drizzle-kit needs `@neondatabase/serverless` as a devDependency of `packages/core` (not just root)
- `DATABASE_URL` must be in `packages/core/.env` (not just root `.env`)
- See `docs/features.md` → "Database tooling quirks"

---

## 14. Feature Matrix

| # | Feature | Web | Desktop | Mobile |
|---|---|:---:|:-------:|:------:|
| 1 | Dashboard (revenue, charts, low stock) | ✅ | ✅ | ✅ |
| 2 | Products (list, search, create, edit, delete) | ✅ | ✅ | ✅ |
| 2b | Product image upload (Cloudinary) | ✅ | ✅ | ✅ |
| 3 | Stock adjust (+/− with reason) | ✅ | ✅ | ✅ |
| 4 | Catalog (colors, sizes, categories) | ✅ | ✅ | ✅ |
| 5 | Sales (quick sale, undo) | ✅ | ✅ | ✅ |
| 6 | Billing (templates, 2-in-1, date, notes) | ✅ | ✅ | ✅ |
| 7 | Invoice list (search, status, pagination) | ✅ | ✅ | ✅ |
| 8 | Record invoice payment | ✅ | ✅ | ✅ |
| 9 | Bill PDF (shared renderBillHtml) | ✅ | ✅ | ✅ |
| 10 | Job letters + PDF | ✅ | ✅ | ✅ |
| 11 | Parties & Khata (ledger) | ✅ | ✅ | ✅ |
| 12 | Advances summary | ✅ | ✅ | ✅ |
| 13 | Settle advance | ✅ | ✅ | ✅ |
| 14 | Reports (daily/weekly/monthly/custom) | ✅ | ✅ | ✅ |
| 15 | Report export (CSV/Excel/PDF) | ✅ | ✅ | ✅ |
| 16 | Settings (shop profile, appearance, security) | ✅ | ✅ | ✅ |
| 17 | Connection (onboarding, API URL/key) | ✅ | ✅ | ✅ |
| 18 | Multiple color themes (5 themes × light/dark) | ✅ | ✅ | ✅ |
| 19 | App lock (4-digit PIN) | ✅ | ✅ | ✅ |
| 20 | Loading skeletons (shimmer) | ✅ | ✅ | ✅ |
| 21 | Themed scrollbars | ✅ | ✅ | — |
| 22 | Product label printing (A4 + thermal) | ✅ | ✅ | ✅ |
| 23 | Barcode generation (EAN-13) | ✅ | ✅ | ✅ |
| 24 | Barcode lookup & scanning | ✅ | ✅ | ✅ |
| 25 | Weight-based sales info | ✅ | ✅ | ✅ |

Full matrix with notes: `docs/features.md`

---

## 15. Known Issues & Next Steps

### In progress / planned
1. **Hindi language support** — full plan in `docs/i18n-hindi.md` (5 phases: infrastructure → static strings → dynamic content → documents → hardening). Not yet shipped.
2. **React Doctor cleanup** — baseline scores: web 50/100, desktop 42/100, mobile 59/100. Remaining items tracked in `docs/react-doctor-checklist.md`.

### Accepted technical debt
- Web bill PDF uses rich jsPDF templates; desktop + mobile share `renderBillHtml` (content identical, only renderer differs)
- Mobile list performance (~63 warnings for inline renderItem/callbacks) — low urgency for shop-sized lists
- Desktop `no-transition-all` in `dashboard.tsx` — scope to specific properties

---

## 16. Docs Index

| Doc | What it covers |
|---|---|
| `docs/features.md` | Feature × platform matrix (which app has what) |
| `docs/ARCHITECTURE.md` | ADR decisions, security notes, type discipline, repo map |
| `docs/nestjs-backend.md` | NestJS API plan, caching (Upstash), performance, deployment |
| `docs/state-management.md` | TanStack Query + Zustand architecture, rules for future work |
| `docs/theme.md` | Design tokens, how theme switching works, adding themes |
| `docs/tspl2-reference.md` | TSPL2 command reference, TSC TE244 specifics |
| `docs/i18n-hindi.md` | Hindi language support plan (5 phases, glossary, style rules) |
| `docs/react-doctor-checklist.md` | React Doctor cleanup checklist (bugs, perf, maintainability) |
| `AGENTS.md` | Rules for AI assistants (no any/unknown, global types, reuse core) |
| `README.md` | Project overview, quickstart, deployment, CI/CD |

---

## 17. How to Add a Feature

1. **Put business logic in core:** `packages/core/src/services/<feature>.ts` + export from `packages/core/src/index.ts`
2. **Add API endpoint:** controller in `apps/api/src/controllers/`, DTO in core validators
3. **Add query hook:** `packages/query/src/hooks/<feature>.ts` with query keys + invalidation
4. **Build UI once per platform:**
   - Web: `apps/web/src/views/<feature>-view.tsx`
   - Desktop: `apps/desktop/src/pages/<feature>.tsx` (uses same shared `@munim/ui` components)
   - Mobile: `apps/mobile/src/screens/<Feature>Screen.tsx`
5. **Update docs:** `docs/features.md` matrix + `docs/memory.md` if architectural

---

## 18. Troubleshooting

### "please install either of 'pg', 'postgres'..."
→ `@neondatabase/serverless` is missing from `packages/core` devDeps. Run `pnpm install`.

### "Either connection url or host, database are required"
→ `DATABASE_URL` missing from `packages/core/.env`. Copy from `.env.example`.

### Desktop: "connection failed" in Settings
→ API URL/key wrong, or API server is down. Check `GET /readyz` on the API.

### Mobile: blank screen on dev build
→ Old native code cached. Rebuild dev build when native modules change.

### Label prints upside-down
→ `DIRECTION 0` = origin top-left. `DIRECTION 1` = origin bottom-left (inverted Y).

### EAN-13 barcode doesn't scan
→ Check if `digits.slice(0, 12)` is being sent (not 13). Printer calculates the check digit.

### Theme doesn't change on dark mode
→ Check `prefers-reduced-motion` — Skiper26 animation respects it. Toggle "Force animation play" in Settings.

### Toaster not showing
→ Import `toast` from `@munim/ui`, NOT from `sonner`. pnpm workspace copies split sonner's module store.
