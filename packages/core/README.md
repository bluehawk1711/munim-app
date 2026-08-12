# @munim/core

The shared brain of the munim monorepo. **All** business logic — stock, sales,
invoices/bills, job letters, parties (khata), advances (given/taken), payments —
lives here, along with the Drizzle schema and the Neon Postgres connection.

## Why no API server?

The connection uses **Drizzle's `pg-proxy` driver** pointed at **Neon's
SQL-over-HTTP endpoint** (`https://<host>/sql`) with plain `fetch`. Since it's
pure fetch + JSON, the exact same client runs in:

- **Next.js** (Node 18+) — the web app imports it server-side
- **Tauri** — the desktop webview imports it directly
- **React Native / Expo** — Hermes' global `fetch` works

Every app talks to the shared Neon database directly. Schema and migrations are
managed once here with `drizzle-kit`.

## Setup

```bash
# 1. Set the connection string — IMPORTANT: drizzle-kit reads .env from THIS
#    directory (packages/core), not the workspace root.
cp .env.example .env        # then fill in DATABASE_URL from Neon

# 2. Push schema or run migrations
pnpm --filter @munim/core db:push      # dev: sync schema to Neon (local scratch DBs only)
pnpm --filter @munim/core db:generate  # write a new migration SQL into ./drizzle
pnpm --filter @munim/core db:migrate   # prod: apply ./drizzle migrations

# 3. Run the smoke tests (all services, in-process, no network)
pnpm --filter @munim/core smoke
```

> ⚠️ **pnpm driver-resolution quirk** — drizzle-kit resolves both the Postgres
> driver (`@neondatabase/serverless`, a devDependency of this package AND the
> root) and the `.env` file from the **config directory** (`packages/core`).
> The root `.env` is ignored. Full write-up: `docs/features.md` → **Database
> tooling quirks**.

## Usage

```ts
import { createDb, listProducts, createInvoice, getPartyBalances } from "@munim/core";

const db = createDb(); // reads DATABASE_URL

const { products } = await listProducts(db, { search: "ring" });
const invoice = await createInvoice(db, { customerName: "Raj", items: [...] });
const balances = await getPartyBalances(db); // who owes us / who we owe
```

> **Mobile note:** the Neon credentials are embedded in the app bundle. Use a
> dedicated low-privilege Neon role (INSERT/UPDATE/SELECT on the schema) rather
> than the account root role.
