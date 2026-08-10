# Munim — Feature Matrix

Every feature lives in the **shared core** (`packages/core`): the Drizzle schema, the Neon
Postgres client, and ALL business logic (stock, sales, invoices, bills, parties, advances/ledger,
payments, reports, settings). The three apps are thin UIs over that one model — there is **no API
server**.

This document records what exists, and **on which platforms** it is available (✅ = full UI,
🟡 = partial / reduced UI, ❌ = not surfaced yet).

> Last updated: 2026-08-10

---

## Global rules

- **One database, one model.** Web, desktop and mobile read/write the same Neon database through
  `@munim/core`. A bill created on any platform is immediately visible on all three.
- **Shared logic.** Bill/invoice generation (`buildBillDocument`, `renderBillText`, `amountInWords`),
  SKU/invoice numbering, stock movements, khata/ledger math and `getReport` all live in core.
- **Platform-specific rendering only.** PDF export and file dialogs are per-platform (browser print /
  jsPDF, Tauri download, mobile `Share`), but they all consume the same `BillDocument`.
- **One theme.** All colors, radii and visual tokens live in `@munim/theme` (`packages/theme/src/tokens.ts`).
  Web + desktop consume the generated `tokens.css`; mobile consumes `mobileColors`. See `docs/theme.md`.
  → Edit one file, restyle all 3 apps.

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

## Feature matrix

| # | Feature | Web | Desktop | Mobile | Notes |
|---|---------|:---:|:-------:|:------:|-------|
| 1 | Dashboard (revenue, receivables, payables, low stock, recent invoices/advances) | ✅ | ✅ | ✅ | Same `getDashboard` in core |
| 2 | Products — list, search, create, edit, delete | ✅ | ✅ | ✅ | SKU auto-generated in core |
| 3 | Stock — adjust (+/− with reason), low-stock/out-of-stock badges | ✅ | ✅ | ✅ | `adjustStock` + movements in core |
| 4 | Catalog — colors & sizes management (add/rename/delete) | ✅ | ❌ | ❌ | **Web-only UI**; core has `addColor`/`addSize`/`listMeta` ready for the other apps |
| 5 | Sales — quick sale (product, qty, price, customer, paid/unpaid) | ✅ | ✅ | ✅ | `createSale` in core |
| 6 | Billing / Invoice creation (line items, discount, delivery, paid-now) | ✅ | ✅ | ✅ | Shared `buildBillDocument`; web has richest form (date, party link, notes, templates) |
| 7 | Invoice list — search, status filter, pagination | ✅ | 🟡 | 🟡 | Web has dedicated view with filters; desktop/mobile list inside Billing/Sales without search/filter |
| 8 | Record invoice payment (partial/full) | ✅ | ✅ | ❌ | Web + desktop; **mobile lists invoices but cannot record payments yet** |
| 9 | Bill PDF generation (jewellery/e-commerce templates, 2-in-1, classic colors) | ✅ | ✅ | ❌ | Web: jsPDF templates; Desktop: `billPdf.ts`; Mobile: **text share only** (`Share`) |
| 10 | Job letters — create, save, list, delete | ✅ | 🟡 | 🟡 | Web has the full rich form + gold-bordered **PDF**; desktop/mobile have basic create/list without PDF |
| 11 | Parties & Khata — balances (due / owed), ledger, advances given/taken | ✅ | ✅ | ✅ | Full ledger on web + desktop; mobile shows balances + compact ledger |
| 12 | Advances summary — "whom I gave money / whom I owe" dashboard | ✅ | 🟡 | 🟡 | Web has a dedicated Advances view; desktop/mobile surface it inside Parties |
| 13 | Settle advance | ✅ | ✅ | ❌ | Web + desktop; **mobile cannot settle an advance yet** |
| 14 | Reports — daily/weekly/monthly/yearly/stock/low-stock/sold (+ custom dates) | ✅ | ✅ | ✅ | Shared `getReport` in core; web/desktop can export (Excel/PDF/CSV), mobile view-only |
| 15 | Report export (Excel / PDF / CSV) | ✅ | 🟡 | ❌ | Web: Excel+PDF; Desktop: CSV; Mobile: none (view only) |
| 16 | Settings — shop profile (name, address, phones, email, currency, low-stock threshold) | ❌ | ✅ | 🟡 | Desktop has full shop profile + DB URL test; mobile has **shop name + DB URL only** |
| 17 | Database connection (paste Neon URL, test, save) | ❌ | ✅ | ✅ | Desktop + mobile store the URL locally; web reads env vars |

## Platform detail

### Web (`apps/web`) — Next.js, server + client
- Views: dashboard, products, sales, catalog, invoices, billing, job-letter, parties, advances, reports
- Auth: login page + server-side API routes; DB access through `lib/db` + `@munim/core`
- Exports: Excel + PDF (reports), jsPDF bill templates, job-letter PDF
- No settings view (shop details come from the DB row; DB URL comes from env)

### Desktop (`apps/desktop`) — Tauri + Vite
- Pages: dashboard, products, sales, billing, parties, job-letters, **reports**, settings
- Direct DB: connects straight to Neon via core (fetch-based proxy client); DB URL stored locally
- PDF: bill download via `lib/billPdf.ts`; CSV export on reports
- Navigation: pushState SPA with motion transitions

### Mobile (`apps/mobile`) — React Native + Expo SDK 57
- Screens: home, products, sales, billing, parties, letters, **reports**, settings
- Direct DB: same Neon fetch client (works on Hermes); URL stored in AsyncStorage
- Share: bill as text via native `Share`; no PDF, no payment recording, no advance settle yet

## Known gaps & next steps

1. **Catalog (colors/sizes) UI on desktop + mobile** — core is ready (`listMeta`, `addColor`,
   `addSize`); only the management screens are missing.
2. **Record invoice payment on mobile** — core `recordInvoicePayment` exists; needs a screen action.
3. **Settle advance on mobile** — core `settleAdvance` exists; needs a screen action.
4. **Mobile bill PDF** — would need a PDF renderer (e.g. `expo-print` / react-native-html-to-pdf)
   or keep text share.
5. **Job-letter PDF on desktop/mobile** — web-only generator today.
6. **Settings on web** — shop profile editing is desktop/mobile-only; web reads the same DB row.
7. **Report export parity** — give mobile a simple CSV/text export.

## How to add a feature globally

1. Put the data + business logic in `packages/core/src/services/<feature>.ts` and export it from
   `packages/core/src/index.ts`.
2. Build the UI once per platform, calling the core function with the platform's `getCore()`.
3. Update this matrix (✅/🟡/❌) and the `Notes` column.
