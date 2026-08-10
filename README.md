# Munim — Shop Management for Web, Desktop & Mobile

One business brain. Three apps. **No API server.**

Munim runs a shop owner's complete business on a **single shared Neon Postgres
database** that all three apps talk to directly:

| App | Stack | What it does |
|---|---|---|
| `apps/web` | Next.js 16 | Full management web app (migrated from stockPilot + job-and-bill-gen) |
| `apps/desktop` | Tauri v2 + React 19 + Tailwind v4 + shadcn/ui | Native desktop app (scaffolded from `kitlib/tauri-app-template`) |
| `apps/mobile` | React Native 0.86 + TypeScript | Android/iOS app (scaffolded from `react-native-community/template`) |
| `packages/core` | Drizzle ORM + Neon | **ALL schema + business logic** — imported by every app |

> All business logic — stock, sales, invoices/bills, job letters, parties,
> advances (khata), payments, dashboard — lives **once** in `packages/core`
> and is imported by all three apps. The bill/invoice generator is shared:
> every app produces the **same bill** (same totals, same amount-in-words)
> from `packages/core/src/billing/`.

## How it works — no API server

```
web (Next.js) ──┐
desktop (Tauri) ┼── @munim/core ── drizzle pg-proxy (plain fetch) ──► Neon Postgres
mobile (RN)    ─┘        ▲
                         └─ schema, services, billing, numberToWords, SKU, codes
```

- The Drizzle **`pg-proxy`** driver is pure `fetch` + JSON, so the *same*
  client runs in Node, the Tauri webview, and React Native.
- Each app only needs its own connection string (`DATABASE_URL`), never a server.
- Data is live-shared: a sale on the phone appears in the desktop app instantly.

## Business features

- **Stock** — products with SKU/barcode, color/size variants, buy/sell price,
  stock-in/out/adjustments with audit trail, low-stock alerts
- **Money & invoices** — bills with line items, discount, delivery, paid /
  partial / unpaid statuses, payments, amount-in-words (shared `numberToWords`),
  PDF export (shared bill generation)
- **Parties & advances (khata)** — who gave whom money: **advance given**
  (they owe you) and **advance taken** (you owe them), full ledger per party,
  net balance, payments & settlements
- **Job letters** — offer/job letter records for staff
- **Dashboard & reports** — revenue, profit, low stock, pending payments,
  receivables vs payables, activity log

## Repo layout

```
packages/core/        shared brain (schema, services, billing, utils) + migrations
apps/web/             Next.js management app
apps/desktop/         Tauri v2 desktop app
apps/mobile/          React Native app (bare RN) + eas.json
.github/workflows/    desktop (tauri-action), mobile (EAS), web CI
docs/                 PLAN.md (phases + features), ARCHITECTURE.md (decisions)
AGENTS.md             mandatory rules (no any/unknown, global types, reuse core)
```

## Prerequisites

- Node.js ≥ 22, pnpm ≥ 11
- Rust (for desktop) — https://rustup.rs
- Android SDK / Xcode (for mobile)
- A [Neon](https://neon.tech) Postgres database

## Quickstart

```bash
pnpm install

# 1. Create the database schema (run once)
cp .env.example .env                      # add your Neon DATABASE_URL
pnpm --filter @munim/core db:migrate      # or: db:push

# 2. Run the web app
pnpm dev:web                              # http://localhost:3000

# 3. Desktop app (Tauri)
cp apps/desktop/.env.example apps/desktop/.env   # VITE_DATABASE_URL=…
pnpm dev:desktop

# 4. Mobile app (see apps/mobile/README.md)
cd apps/mobile && pnpm android            # set the connection string in the app's Settings screen
```

## CI/CD

| Workflow | Trigger | Result |
|---|---|---|
| `.github/workflows/desktop-build.yml` | push/tag | Windows NSIS installer via `tauri-action`, uploaded as artifact |
| `.github/workflows/mobile-eas-build.yml` | manual / mobile changes | **Android dev build via EAS Build** (`eas build --profile development`) — needs `EXPO_TOKEN` secret |
| `.github/workflows/web.yml` | push/PR | web typecheck + `next build` |

## Rules & memory

Read **[AGENTS.md](AGENTS.md)** before contributing — it encodes hard rules:
no `any`/`unknown`/`as any`/`as unknown` (with one documented exception),
types defined once in core and never redefined, and all shared logic reused
from `packages/core`. Architecture decisions and the phase plan live in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/PLAN.md`](docs/PLAN.md).
