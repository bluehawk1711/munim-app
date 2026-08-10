# Munim Web

The web app of the Munim monorepo — shop management (stock, sales, billing,
khata/advances, reports, job letters) for the browser. A thin UI over the
shared `@munim/core` package: it talks **directly** to the shared Neon
database, exactly like the desktop and mobile apps. There is no API server.

## Tech Stack

| Layer     | Tech                                                        |
| --------- | ----------------------------------------------------------- |
| Framework | Next.js 16 (App Router, Turbopack)                          |
| UI        | React 19, Tailwind CSS 4, shadcn/ui (Radix), lucide icons   |
| Data      | `@munim/core` (Drizzle schema + Neon fetch client)          |
| Theme     | `@munim/theme` (single source of truth — see `docs/theme.md`) |
| State     | TanStack Query, TanStack Table, Zustand                     |
| Forms     | react-hook-form + zod                                       |
| Charts    | recharts                                                    |
| Export    | exceljs, jspdf + jspdf-autotable, CSV                        |
| Notify    | sonner toasts                                               |

## Getting Started

Requirements: Node.js 22+, pnpm.

```bash
# 1. Install workspace dependencies (from the repo root)
pnpm install

# 2. Configure environment
cp .env.example .env
#  -> set DATABASE_URL="postgresql://user:password@host/db?sslmode=require"

# 3. Start the dev server
pnpm dev        # http://localhost:3000
```

### Scripts

| Command       | Description                                   |
| ------------- | --------------------------------------------- |
| `pnpm dev`    | Start dev server on port 3000                 |
| `pnpm build`  | Production build (Next.js 16, Turbopack)      |
| `pnpm start`  | Run the production build                      |
| `pnpm lint`   | Run ESLint                                    |
| `pnpm typecheck` | TypeScript typecheck                      |

Database schema is managed from `packages/core` — see the root scripts
`pnpm db:generate` / `pnpm db:push` / `pnpm db:migrate`.

## Deployment (Vercel)

1. Import the repository into [Vercel](https://vercel.com). Set the project
   **Root Directory** to `apps/web` (framework: Next.js — auto-detected).
2. Set the `DATABASE_URL` env var (e.g. via the Neon integration).
3. Deploy. Vercel detects Turbo and runs `turbo run build`; env vars used by
   the build are declared in `turbo.json` → `globalEnv`.

> Note: there is intentionally **no `output: "standalone"`** — Vercel does its
> own serverless bundling, and standalone previously broke Vercel's build
> tracing (`ENOENT .next/next-server.js.nft.json`).

## Project Structure

```
src/
├── app/            # App Router pages + API route handlers
│   └── api/        # dashboard, products, sales, reports, colors, sizes…
├── components/     # UI components (shadcn/ui in components/ui)
├── hooks/          # Shared React hooks
├── lib/            # db.ts (shared core client proxy), utils, format, sku, export
├── store/          # Zustand stores
└── views/          # Page-level components (dashboard, products, sales, …)
```

See the repo root `docs/features.md` for the full feature × platform matrix.
