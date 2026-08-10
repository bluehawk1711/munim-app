# StockPilot — Inventory & Sales Management

A modern inventory and sales management system with real-time stock tracking, analytics, and one-click reporting.

## Features

- **Dashboard** — real-time analytics, stock levels, and sales trends (recharts)
- **Products** — full CRUD with SKU, barcode, color/size variants, stock, purchase & selling price
- **Sales** — record sales with auto-generated invoice numbers and automatic stock decrement
- **Reports** — export to Excel (`exceljs`) and PDF (`jspdf`) with one click
- **Activity log** — every action is recorded for auditability
- **Theming** — dark/light mode via `next-themes`
- **Responsive UI** — built with shadcn/ui + Tailwind CSS 4

## Tech Stack

| Layer      | Tech                                                         |
| ---------- | ------------------------------------------------------------ |
| Framework  | Next.js 16 (App Router, `output: standalone`)                |
| UI         | React 19, Tailwind CSS 4, shadcn/ui (Radix), lucide icons    |
| Data       | Prisma 6 + PostgreSQL                                        |
| State      | TanStack Query, TanStack Table, Zustand                      |
| Forms      | react-hook-form + zod                                        |
| Charts     | recharts                                                     |
| Export     | exceljs, jspdf + jspdf-autotable                              |
| Notify     | sonner toasts                                                 |

## Getting Started

Requirements: Node.js 20+ (Bun also works), a PostgreSQL database (local or hosted).

```bash
# 1. Install dependencies
bun install        # or: pnpm install

# 2. Configure environment
cp .env.example .env
#  -> set DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"

# 3. Create the schema
bun run db:push

# 4. Start the dev server
bun run dev        # http://localhost:3000
```

### Scripts

| Command             | Description                                      |
| ------------------- | ------------------------------------------------ |
| `bun run dev`       | Start dev server on port 3000                    |
| `bun run build`     | Generate Prisma client, sync schema, build       |
| `bun run start`     | Run the standalone production build (Bun)        |
| `bun run lint`      | Run ESLint                                       |
| `bun run db:push`   | Push schema to the database (create/update tables) |
| `bun run db:generate` | Regenerate the Prisma client                   |
| `bun run db:migrate`  | Create a new migration (dev)                   |
| `bun run db:reset`    | Reset the database from migrations (dev)       |

## Deployment (Vercel)

1. Import the repository into [Vercel](https://vercel.com) (framework: Next.js — auto-detected).
2. Go to **Storage** → add a **Neon Postgres** database (free tier is fine). This auto-injects the `DATABASE_URL` env var — no manual configuration needed.
3. Deploy. The build command (`prisma generate && prisma db push && next build`) automatically syncs the database schema on **every** deploy, so there are no manual migration steps.

> Local development uses the same `DATABASE_URL` — just copy the connection string from Neon into `.env`.

## Project Structure

```
src/
├── app/            # App Router pages + API route handlers
│   └── api/        # dashboard, products, sales, reports endpoints
├── components/     # UI components (shadcn/ui in components/ui)
├── hooks/          # Shared React hooks
├── lib/            # db.ts (Prisma singleton), utils, format, sku, export, activity
├── store/          # Zustand stores
└── views/          # Page-level components (dashboard, products, sales, reports)
prisma/
└── schema.prisma   # Database schema (Product, Sale, ActivityLog)
```
