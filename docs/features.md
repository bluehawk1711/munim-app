# Munim — Feature Matrix

Every feature lives in the **shared core** (`packages/core`): the Drizzle schema, the Neon
Postgres client, and ALL business logic (stock, sales, invoices, bills, parties, advances/ledger,
payments, reports, settings). The three apps are thin UIs over that one model — there is **no API
server**.

This document records what exists, and **on which platforms** it is available (✅ = full UI,
🟡 = partial / reduced UI, ❌ = not surfaced yet).

> Last updated: 2026-08-15

---

## Global rules

- **One database, one model.** Web, desktop and mobile read/write the same Neon database through
  `@munim/core`. A bill created on any platform is immediately visible on all three.
- **Shared logic.** Bill/invoice generation (`buildBillDocument`, `renderBillText`, `renderBillHtml`),
  job-letter generation (`JobLetterData`, `renderJobLetterHtml`, `jobLetterFromStored`), SKU/invoice
  numbering, stock movements, khata/ledger math and `getReport` all live in core.
- **Platform-specific rendering only.** PDF export and file dialogs are per-platform (browser print /
  jsPDF, Tauri download, mobile `Share`), but they all consume the same `BillDocument`.
- **One theme.** All colors, radii and visual tokens live in `@munim/theme` (`packages/theme/src/tokens.ts`).
  Web + desktop consume the generated `tokens.css`; mobile consumes `mobileColors`. See `docs/theme.md`.
  → Edit one file, restyle all 3 apps.
- **One settings layout.** Web + desktop share `SettingsShell` in `@munim/ui` (sectioned sidebar
  layout — Shop / Appearance / Security / Database). Any settings page change is made once and
  appears on both apps. The feature matrix below was last audited on **2026-08-12**: all 11 modules
  (dashboard → settings) exist on all three platforms (no ❌ rows, and no 🟡 feature rows — the
  only 🟡 left, row 17 web, is a deliberate platform difference: the browser can't hold a DB
  connection string, so web reads it from env while desktop + mobile store it locally).
- **Shared workflow dialogs.** The money-movement dialogs live once in `@munim/ui` and are used by
  both web and desktop: `RecordPaymentDialog` (invoice payment), `KhataActionDialog` (give/take
  advance, receive/make payment — used by the Advances pages AND the desktop Parties page),
  `ConfirmDialog` (destructive confirms like delete-invoice) and `QuickAdvanceRecord` (the Advances
  quick-capture card). Parents keep the core calls + toasts; the dialogs own their form state
  (amount resets to the outstanding balance / to 0 on open).

## Database tooling quirks (read before running `pnpm db:*`)

`pnpm db:push` / `db:generate` / `db:studio` run `drizzle-kit` from
`packages/core` (see root `package.json` → `db:push` → `pnpm --filter @munim/core`).
Two pnpm-specific gotchas bite here — both cost real debugging time when they hit:

**1. The Postgres driver must be resolvable from `packages/core`.**

drizzle-kit needs a *real* Postgres driver to connect while pushing or introspecting
the schema — the apps themselves do **not** (they talk to Neon via
`drizzle-orm/pg-proxy` + plain `fetch`, so no driver ships to the runtime at all;
see `docs/ARCHITECTURE.md` ADR-001). drizzle-kit `require()`s the driver relative to
**the config file's directory** (`packages/core`), not from the workspace root.
pnpm's strict `node_modules` layout means a driver declared only at the root or in a
sibling package is **invisible** from there, producing:

```
To connect to Postgres database - please install either of 'pg', 'postgres',
'@neondatabase/serverless' or '@vercel/postgres' drivers
```

Fix (current state): `@neondatabase/serverless` is a devDependency of **both**
`packages/core` (so drizzle-kit resolves it from the config dir — verified with
`require.resolve` from `packages/core`) and the workspace root (so tooling run from
the root resolves it too). If that error ever returns after a dependency cleanup,
check both declarations and re-run `pnpm install`.

**2. `DATABASE_URL` must live in `packages/core/.env`.**

drizzle-kit reads `.env` from the config file's directory — a root-only `.env` is
ignored, producing:

```
Either connection "url" or "host", "database" are required for PostgreSQL database connection
```

So the connection string belongs in `packages/core/.env` (copy the keys from
`.env.example`). Both `.env` and `packages/core/.env` are gitignored — never commit
the real connection string.

**3. Schema changes deploy via committed migrations, not `db:push`.**

Production schema changes go through the `db-migrate` CI workflow
(`.github/workflows/db-migrate.yml`):

1. Edit `packages/core/src/db/schema.ts`.
2. Run `pnpm db:generate` from the repo root — writes
   `packages/core/drizzle/000N_*.sql` and updates `meta/`. **Commit everything
   under `packages/core/drizzle/`.**
3. CI enforces it: the **drift-check** job regenerates migrations and fails if
   they aren't committed, and the **migrate** job (main only, uses the
   `DATABASE_URL` GitHub secret) applies pending migrations to Neon.

`pnpm db:push` is only for local scratch databases. The baseline migration
(`0000_*.sql`) is intentionally idempotent (`CREATE TABLE/INDEX IF NOT EXISTS` +
`DO` blocks around the FK `ADD CONSTRAINT`s) so the first `migrate` applies cleanly
over the schema that `db:push` originally created — keep future migrations as
plain drizzle output.

## Feature matrix

| # | Feature | Web | Desktop | Mobile | Notes |
|---|---------|:---:|:-------:|:------:|-------|
| 1 | Dashboard (revenue, receivables, payables, low stock, recent invoices/advances) | ✅ | ✅ | ✅ | Same `getDashboard` in core |
| 2 | Products — list, search, create, edit, delete | ✅ | ✅ | ✅ | SKU auto-generated in core. Mobile has search (name/SKU/color/size, client-side over the full list with a clear button) and a shared add/edit form (`updateProduct` on save) alongside create, delete, adjust stock + image upload |
| 2b | Product image upload (Cloudinary) + thumbnail in list | ✅ | ✅ | ✅ | Web: signed upload via `/api/upload` (server-side secret); desktop + mobile: shared `uploadImageToCloudinary` (unsigned upload preset — no secret on client). Mobile uses `expo-image-picker` (native module — rebuild the dev build only when native deps change) |
| 3 | Stock — adjust (+/− with reason), low-stock/out-of-stock badges | ✅ | ✅ | ✅ | `adjustStock` + movements in core (input supports `reason`). All three apps show a **Reason (optional)** multiline field on the adjust dialog and store it as the movement note (`e.g. Restocked, damaged, returned…`) |
| 4 | Catalog — colors & sizes management (add/rename/delete) | ✅ | ✅ | ✅ | Shared `catalog.ts` service in core (`listCatalogItems`/`createCatalogItem`/`renameCatalogItem`/`deleteCatalogItem` with product-count guards); all three apps manage the same colors/sizes |
| 5 | Sales — quick sale (product, qty, price, customer, paid/unpaid) | ✅ | ✅ | ✅ | `createSale` in core; web + desktop also share search, date-range filter, summary tiles and **undo sale** (stock restore via `deleteInvoice`); mobile adds a record-payment shortcut on unpaid recent sales |
| 6 | Billing / Invoice creation (line items, discount, delivery, paid-now, date, notes, party link) | ✅ | ✅ | ✅ | Shared `buildBillDocument`; the **template options (template / classic color / 2-in-1 duplicate-separate) are driven by the same model on all 3 platforms**: web + desktop render the shared `BillTemplateOptions` component in `@munim/ui`; mobile renders native segmented controls (Classic Jewellery / Modern E-commerce, red-yellow swatches, 2-in-1 switch, Duplicate / Separate) with a full second-bill editor in Separate mode. The template types (`BillTemplate`/`BillClassicColor`/`BillMode`) live in `@munim/core` (re-exported by `@munim/ui`) and each invoice snapshots its settings in `template_settings`. **Bill-to/details parity:** all three forms collect customer name + phone + address, **link-to-khata-party** (mobile: bottom-sheet picker that pre-fills name/phone/address, mirroring web's select), **date** (mobile: native date picker — Android dialog / iOS inline sheet, no manual typing), and **notes/terms** (mobile: multi-line field); date + notes apply to both bills in 2-in-1 Separate mode, exactly like web's shared `basePayload` |
| 7 | Invoice list — search, status filter, pagination | ✅ | ✅ | ✅ | Web + desktop share the same **Invoices page** (`invoices-view.tsx` / `pages/invoices.tsx`) built on shared `SummaryTile` + `InvoiceStatusBadge` from `@munim/ui`; mobile has a dedicated **`InvoicesScreen`** (More → Invoices) with the same search, status chips, summary strip, record-payment sheet, delete-with-stock-restore and Prev/Next pagination (page resets to 1 on filter change). The old compact list inside Billing remains as a creation follow-up |
| 8 | Record invoice payment (partial/full) | ✅ | ✅ | ✅ | Shared `recordInvoicePayment` in core; mobile has a Record-payment sheet on unpaid/partial invoices |
| 9 | Bill PDF generation (jewellery/e-commerce templates, 2-in-1, classic colors) | ✅ | ✅ | ✅ | Web: rich jsPDF templates; Desktop: shared `renderBillHtml` (core) via jsPDF `html()` — **2-in-1 sheets stack both bills on one A4 (accent strip for classic color)**; Mobile: shared `renderBillHtml` + `expo-print` → share PDF — **2-in-1 supported** (Duplicate repeats the same bill, Separate stacks Bill 2, page-break between copies); text share includes both bills in Separate mode |
| 10 | Job letters — create, save, list, delete + PDF | ✅ | ✅ | ✅ | Shared `JobLetterData` + `renderJobLetterHtml` (core); web has the full rich form + gold-bordered jsPDF PDF; desktop downloads the same shared HTML via jsPDF `html()`; mobile shares it via `expo-print` |
| 11 | Parties & Khata — balances (due / owed), ledger, advances given/taken | ✅ | ✅ | ✅ | Web + desktop share search + type filter (customer/supplier/worker/other), party type on create, delete party, and the shared `LedgerKindBadge` in ledger rows; mobile shows balances + compact ledger |
| 12 | Advances summary — "whom I gave money / whom I owe" dashboard | ✅ | ✅ | ✅ | Web + desktop share the same **Advances page** (`advances-view.tsx` / `pages/advances.tsx`) built on the shared `SummaryTile` + `KhataCard` from `@munim/ui`; mobile has a dedicated **`AdvancesScreen`** (More → Advances) mirroring it — summary tiles (owed/payable/net), quick record with party picker + given/taken toggle, and receivables/payables khata cards with Collect/+Give and Pay/+Take |
| 13 | Settle advance | ✅ | ✅ | ✅ | Shared `settleAdvance` in core; mobile has a Settle button per open advance in Parties |
| 14 | Reports — daily/weekly/monthly/yearly/stock/low-stock/sold (+ custom dates) | ✅ | ✅ | ✅ | Shared `getReport` in core; all three apps generate + export the same report. Custom date range applies to **any** report type on all three apps — dates are committed on "Generate" and an empty range falls back to the type's default period. Mobile uses a **native date picker** (`@react-native-community/datetimepicker`: Android dialog / iOS inline sheet) in Reports and Billing instead of typed YYYY-MM-DD text |
| 15 | Report export (Excel / PDF / CSV) | ✅ | ✅ | ✅ | All three apps share `reportToCsv` (RFC-4180) for CSV; web also has Excel+PDF, mobile shares CSV via native Share |
| 16 | Settings — shop profile (name, address, phones, email, currency, low-stock threshold) | ✅ | ✅ | ✅ | Same `updateSettings`/`getSettings` in core; all three apps edit the same DB row. Web + desktop share the **`SettingsShell`** from `@munim/ui` — an Apple-style **sectioned layout** (Shop profile / Appearance / Security / Database sidebar nav, collapsing to chips on narrow screens) so both settings pages are pixel-identical; each section also shows a live status badge (e.g. Security shows “Locked/Off”). Mobile uses the same 4 sections (Shop profile → Appearance → Security → Database) as **grouped cards with `Section` headers** (iOS style, staggered entrance) inside a ScrollView — matching the web/desktop group order and names |
| 17 | Database connection (paste Neon URL, test, save) | 🟡 | ✅ | ✅ | Desktop + mobile store the URL locally; web reads env vars + has a connection check in Settings. Desktop URL field is **masked (password-style with show/hide eye)** — only the host is shown once saved; the dashboard shows a friendly "Open Settings" CTA when the DB isn't configured |
| 18 | Multiple color themes (Apple Gold / Ocean Blue / Forest Green / Rose Blush / Midnight Indigo) | ✅ | ✅ | ✅ | 5 curated themes in `@munim/theme`; compact `ThemeSelect` lives in **Settings only** (web header keeps just the light/dark toggle); dark/light mode ALSO syncs via the shared `settings.mode` column. **The chosen theme + mode sync across all three apps** — each app writes to Neon and pulls on startup (the untouched default never clobbers a local preference on first load). The **header light/dark toggle is the shared `AnimatedThemeToggle`** in `@munim/ui` — a **simple themed circular button with animated Sun/Moon icons** (lucide `Sun`/`Moon` crossfade + rotate on toggle, pure CSS) that drives the **Skiper UI 26 View-Transition toggle** (polygon wipe from top-left with blur; flips the `.dark` class synchronously inside `startViewTransition`, reduced-motion safe, try/catch fallback). The themed fill/border (not solid black) keeps the button visible on dark surfaces. **"Force theme transition"** is a **device-local** Settings → Appearance toggle (`munim.forceThemeTransition` in localStorage / AsyncStorage, NOT DB-synced) that plays the wipe even when the OS has reduced motion on — it bypasses the JS `matchMedia` check AND omits the injected reduced-motion CSS kill-switch, so the animation runs on machines with "Animation effects" off. Present on all three apps (web/desktop shared `Switch` in `@munim/ui`; mobile row in the Dark-mode card). Re-adding other Skiper26 variants later: `pnpm dlx shadcn add @skiper-ui/skiper26`, then port `createAnimation` into the shared component |
| 19 | App lock — 4-digit PIN login screen (test account 1234 pre-created) | ✅ | ✅ | ✅ | Per-device lock, no DB: web/desktop gate in `@munim/ui` (PinGate + PinSettingsCard, localStorage `munim.pin`); mobile `PinLockScreen` + Settings card (AsyncStorage). Two-step login (email+password → PIN) with a 30-day session cookie on web; hashing/verify live in `@munim/core` `security/pin.ts` (pure-TS SHA-256, works on Hermes). The web/desktop lock page is a **premium Apple-style glass screen** (gradient backdrop, blur, staggered entrance); Settings can change password/PIN, disable the lock, or reset to the test account |
| 20 | Loading skeletons — shimmer (left-to-right sweep, not pulse) | ✅ | ✅ | ✅ | `.skeleton-shimmer` keyframes ship in the shared theme `tokens.css`; the shared `Skeleton` in `@munim/ui` uses it; desktop pages + mobile `Loading` (Reanimated sweep) render shimmer placeholder rows/cards |
| 21 | Themed scrollbars (thin, matches theme; incl. inside dialogs) | ✅ | ✅ | — | Global thin themed scrollbars (`scrollbar-width` + `-webkit-scrollbar`) in the shared theme `tokens.css`; native mobile scrollbars are OS-styled |
| 22 | Product label printing (preview, copies, print / PDF, 24-up A4 sheet) | ✅ | ✅ | ✅ | One model in core: `buildProductLabel` + `renderLabelSheetHtml` (63.5 × 33.9 mm labels, 3×8 grid, inline SVG barcode — the SAME markup on every platform). Web + desktop share the `LabelPrintDialog` from `@munim/ui` (label preview, copies stepper, Print via browser dialog + Download PDF via jsPDF `html()` at true physical size); mobile prints via `expo-print` + share |
| 23 | Barcode generation — unique EAN-13 per product + backfill for existing | ✅ | ✅ | ✅ | `generateEan13` + `backfillBarcodes` in core (shared). New products get a scannable EAN-13 automatically when the form leaves the barcode blank; the **Generate missing barcodes** button appears when any product lacks one. Barcode stays SEPARATE from SKU. Web/desktop show the barcode inline (`BarcodeSvg` in `@munim/ui`); mobile renders the same SVG via `react-native-svg` |
| 24 | Barcode lookup & scanning (camera on mobile; USB scanners on desktop/web) | ✅ | ✅ | ✅ | Fast indexed exact lookup `findProductByBarcode` in core. Web + desktop: `BarcodeLookupInput` (shared `@munim/ui`) — USB scanners type into it and hit Enter → product opens. Mobile: camera scan (`expo-camera` — **new native module, dev build must be rebuilt**) → `Scan → Detect → Find → Open Product`, plus manual barcode entry in the search box |
| 25 | Weight-based sales info (product weight + sold weight) | ✅ | ✅ | ✅ | Products store **weight in milligrams (mg)** (row 2). Reports show a **Sold Wt** column per product and a **Weight Sold** total (daily/weekly/monthly/yearly/custom dates), computed as `quantity × unit weight` in `getReport` (core). CSV export includes a `Sold Wt (g)` column; `formatWeight` (mg → g → kg) is shared by all three apps |

## Platform detail

### Web (`apps/web`) — Next.js, server + client
- Views: dashboard, products, sales, catalog, invoices, billing, job-letter, parties, advances, reports, **settings**
- Auth: login page + server-side API routes; DB access through `lib/db` + `@munim/core`
- Exports: Excel + PDF (reports), jsPDF bill templates, job-letter PDF
- Settings: `SettingsShell` sectioned layout (Shop profile / Appearance / Security / Database) via `GET/PUT /api/settings` + connection check; DB URL comes from env; header shows only the light/dark toggle (color theme lives in Settings)
- Header toggle: `AnimatedThemeToggle` (shared `@munim/ui`) — Skiper26 polygon wipe from top-left with blur; still syncs the mode through `setMode` → shared `settings.mode`
- Navigation: the active tab is synced to the URL (`?view=…`, `pushState`) and restored on refresh; browser back/forward navigates between tabs; the document title updates per view (`<Title> · Munim`); SEO metadata (title template, description, Open Graph, Twitter card) is set in `layout.tsx`

### Desktop (`apps/desktop`) — Tauri + Vite
- Pages: dashboard, products, **catalog**, sales, billing, **invoices**, parties, **advances**, job-letters, **reports**, settings
- Direct DB: connects straight to Neon via core (fetch-based proxy client); DB URL stored locally (masked in Settings)
- Settings: same shared `SettingsShell` sectioned layout as web (Shop profile / Appearance / Security / Database) — the URL field is masked (password-style with show/hide eye); only the host is shown once saved
- Billing: full web parity — `BillTemplateOptions` shared component (template/color/2-in-1), date, notes, second-bill section for Separate mode, 2-in-1 PDF sheet
- Products: image upload (Cloudinary unsigned preset via `VITE_CLOUDINARY_*`) + thumbnail column; weight (mg) field; inline barcode display; **barcode lookup input** (USB scanners) + **Generate missing barcodes**; **Print label** per product (shared `LabelPrintDialog` → Print / jsPDF download via `lib/labelPdf.ts`)
- PDF: bill download via `lib/billPdf.ts` + job-letter download via `lib/jobLetterPdf.ts` + label download via `lib/labelPdf.ts` (all render the shared core HTML — identical layout to mobile); CSV export on reports
- Navigation: pushState SPA with motion transitions
- Header toggle: `AnimatedThemeToggle` (shared `@munim/ui`) — replaces the old Light/Dark/System dropdown; System mode remains available in Settings (Appearance)

### Mobile (`apps/mobile`) — React Native + Expo SDK 57
- Screens: home, products, sales, billing, parties, letters, **catalog**, **reports**, **invoices**, **advances**, settings (all overflow sections open from the More tab)
- Direct DB: same Neon fetch client (works on Hermes); URL stored in AsyncStorage
- Share: bill as **PDF** via shared `renderBillHtml` + job letter as **PDF** via shared `renderJobLetterHtml` + `expo-print` (text share also available for bills); invoice payment recording + advance settle included
- Products: image upload (picker via `expo-image-picker` + Cloudinary unsigned preset via `EXPO_PUBLIC_CLOUDINARY_*`); weight (mg) field; inline barcode (`react-native-svg` `SvgXml` of the shared core SVG); **camera barcode scanning** (`expo-camera`) + manual barcode search; **Generate missing barcodes**; **label PDF share** (`expo-print` of the shared `renderLabelSheetHtml`)
- Native modules on mobile: `expo-image-picker`, `@react-native-community/datetimepicker` and **`expo-camera`** — **adding any native module requires a dev-build rebuild**; builds are manual now (EAS workflow is manual)

## Known gaps & next steps

1. **Hindi language support (planned)** — see `docs/i18n-hindi.md` for the full plan:
   typed en/hi dictionaries in a shared package, per-app providers, a `language`
   setting synced via the shared settings row, Hindi number-to-words + Indian
   digit grouping (lakh/crore), optional Devanagari numerals. Bills/letters stay
   English by default. **Not yet shipped** — this row will become a feature row
   once implemented.
2. **Web job-letter PDF vs shared HTML** — web keeps its gold-bordered jsPDF template; desktop + mobile render the shared `renderJobLetterHtml` from core, so the letter content is identical everywhere (only the renderer differs).
   - **Labels are NOT subject to this gap** — web + desktop + mobile all render the exact shared `renderLabelSheetHtml` from core; only the rasterizer differs (jsPDF html() / browser print / expo-print).
3. **Web bill PDF vs shared renderBillHtml** — web keeps its rich jsPDF templates (jewellery/e-commerce, 2-in-1, classic colors); desktop + mobile share the exact `renderBillHtml` markup from core. Desktop now supports 2-in-1 sheets; the remaining difference is only the rasterizer/template styling.

## How to add a feature globally

1. Put the data + business logic in `packages/core/src/services/<feature>.ts` and export it from
   `packages/core/src/index.ts`.
2. Build the UI once per platform, calling the core function with the platform's `getCore()`.
3. Update this matrix (✅/🟡/❌) and the `Notes` column.
