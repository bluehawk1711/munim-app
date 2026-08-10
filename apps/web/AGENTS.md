# AGENTS.md

Guidance for AI agents and developers working in this repository.

## Commands

```bash
pnpm dev              # Next.js dev server on port 3000
pnpm build            # production build (Next.js 16, Turbopack)
pnpm start            # run the production build
pnpm lint             # ESLint
pnpm typecheck        # tsc --noEmit
```

- Package manager is **pnpm** (workspace monorepo, `pnpm-lock.yaml`).
- Run from `apps/web`, or from the repo root via turbo: `pnpm --filter @munim/web dev`.

## Architecture

- **Next.js 16 App Router**. Pages live in `src/app`, API route handlers in
  `src/app/api/{dashboard,products,sales,reports,...}`.
- **No Prisma, no ORM of its own.** All database access goes through
  `@munim/core` (`src/lib/db.ts` exposes the shared Neon client). Schema and
  business logic live in `packages/core` — see the root `docs/features.md`.
- **`src/views/*`** hold page-level components; **`src/components/ui/*`** are
  shadcn/ui primitives (Radix). The shared theme comes from `@munim/theme`
  (see `docs/theme.md`).
- **`src/lib/`** contains app helpers: `db.ts` (shared client proxy),
  `format.ts`, `sku.ts`, `export.ts` (Excel/PDF), `validators.ts` (zod),
  `api-client.ts` (fetch wrapper), `cloudinary.ts`.
- **`src/store/`** — Zustand stores for client state.
- `next.config.ts` sets `reactStrictMode: false` only. There is intentionally
  **no `output: "standalone"`** — the app deploys on **Vercel**, which does its
  own serverless bundling.

## Deployment

- Production: **Vercel** (project root `apps/web`). Build = `turbo run build`
  (Vercel detects Turbo). Env vars (DATABASE_URL, CLOUDINARY_*) are injected by
  Vercel; they are declared in `turbo.json` → `globalEnv` so turbo passes them
  to the build tasks.
- CI: `.github/workflows/web.yml` (typecheck + build on push/PR).
- The `output: "standalone"` + Caddy + `.zscripts/` self-hosted pipeline was
  removed — do not reintroduce it.

## Conventions

- `.env` is untracked and must never be committed; use `.env.example` for new
  env vars. Never log secrets.
- UI strings are English; follow the existing style (shadcn/ui components,
  Tailwind v4 classes, zod validation, `@/` path alias).
- Do not use `any`/`unknown` unless nothing else works (monorepo rule — see
  root AGENTS.md/docs).
