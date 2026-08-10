# AGENTS.md

Guidance for AI agents and developers working in this repository.

## Commands

```bash
bun run dev          # dev server on port 3000 (logs to dev.log)
bun run build        # prisma generate && prisma db push && next build (standalone)
bun run lint         # ESLint
bun run db:push      # sync Prisma schema to DB (create/update tables, no migration files)
bun run db:generate  # regenerate Prisma client
bun run db:migrate   # create migration (dev only)
bun run db:reset     # reset DB from migrations (dev only, destructive)
npx tsc --noEmit     # typecheck
```

- This is a **Windows (win32) / PowerShell** dev environment. The `build` and `start` scripts are POSIX-oriented; avoid running them locally.
- The build script runs `prisma db push` and therefore **requires a reachable `DATABASE_URL`** — the placeholder in `.env` will make the build fail.
- Package manager: **pnpm** (`pnpm-lock.yaml`, `pnpm-workspace.yaml`) for Vercel builds; Bun is used for local dev. Update both `package.json` and the lockfile when adding dependencies.

## Architecture

- **Next.js 16 App Router**. Pages live in `src/app`, API route handlers in `src/app/api/{dashboard,products,sales,reports}`.
- **`src/lib/db.ts`** is the singleton Prisma client — always import `db` from there, never construct a new `PrismaClient`.
- **`src/views/*`** hold page-level components; **`src/components/ui/*`** are shadcn/ui primitives (Radix).
- **`src/lib/`** contains shared helpers: `format.ts` (currency/number formatting), `sku.ts` (SKU generation), `export.ts` (Excel/PDF export), `activity.ts` (activity log writes), `validators.ts` (zod schemas), `api-client.ts` (fetch wrapper).
- **`src/store/`** — Zustand stores for client state.
- **`prisma/schema.prisma`** — models: `Product`, `Sale`, `ActivityLog`. `Sale` stores a snapshot of product name/SKU/price at time of sale; stock is decremented when a sale is created.
- `tests/` and `.zscripts/` contain **shell scripts for the older self-hosted deployment** (Caddy + standalone server). They are legacy and not used on Vercel; don't rely on them for current behavior.

## Database

- Provider is **PostgreSQL** (production, Vercel) — do not change it back to SQLite.
- `DATABASE_URL` comes from the `.env` (local) or is injected by the Vercel Neon Postgres integration (prod).
- After any change to `prisma/schema.prisma`, run `bun run db:generate` (and `bun run db:push` to apply).
- No `prisma/migrations/` directory exists — schema is applied via `prisma db push` on every Vercel build.

## Conventions

- `.env` is untracked and must never be committed; use `.env.example` for new env vars. Never log secrets.
- UI strings are in English (hardcoded); `next-intl` is a dependency but not wired up — don't assume it exists.
- `next.config.ts` intentionally sets `typescript.ignoreBuildErrors: true` and `reactStrictMode: false`; `output: "standalone"` is required for the Vercel build scripts.
- Follow existing code style: shadcn/ui components, Tailwind classes, zod for validation, `@/` path alias for imports.
