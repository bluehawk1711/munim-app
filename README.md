# Munim — Shop Management for Web, Desktop & Mobile

One business brain. Three apps. **One API server.**

Munim runs a shop owner's complete business on a **shared NestJS API
(`apps/api`)** that all three apps call through `@munim/api-client`; the API
owns a **single Neon Postgres database** through `packages/core`:

| App | Stack | What it does |
|---|---|---|
| `apps/api` | NestJS 11 + Fastify | **The one backend** — all data routes under `/api`, per-platform API-key auth (`x-api-key`), Cloudinary signed uploads, optional Upstash Redis cache. Deployed on Render via `render.yaml` |
| `apps/web` | Next.js 16 | Full management web app (migrated from stockPilot + job-and-bill-gen) |
| `apps/desktop` | Tauri v2 + React 19 + Tailwind v4 + shadcn/ui | Native desktop app (scaffolded from `kitlib/tauri-app-template`) |
| `apps/mobile` | React Native 0.86 + Expo SDK 57 dev client | Android/iOS app (scaffolded from `react-native-community/template`) |
| `packages/core` | Drizzle ORM + Neon | **ALL schema + business logic** — imported by every app |
| `packages/api-client` | fetch wrapper | **Shared API client** — base-URL joining, `x-api-key` auth, typed endpoints, error mapping. One client for all three apps |
| `packages/ui` | React + shadcn/ui primitives | **Shared UI kit** — web + desktop render the same components (dialogs, settings shell, bill options, PIN gate, …) |
| `packages/theme` | Token file + CSS generator | **Single source of truth** for colors/radius — 5 themes × light/dark, consumed by all 3 apps |

> All business logic — stock, sales, invoices/bills, job letters, parties,
> advances (khata), payments, dashboard — lives **once** in `packages/core`
> and is imported by every app. The bill/invoice generator is shared:
> every app produces the **same bill** (same totals, same amount-in-words)
> from `packages/core/src/billing/`.

## How it works

```
web (Next.js) ──┐
desktop (Tauri) ┼── @munim/api-client ──► apps/api (NestJS) ── @munim/core ──► Neon Postgres
mobile (RN)    ─┘         (fetch + x-api-key)
```

- The API is the **only** place that holds the database connection string
  (`DATABASE_URL`). No Neon credentials ever reach a client device.
- Each platform authenticates with its own API key (`API_KEY_WEB` /
  `API_KEY_DESKTOP` / `API_KEY_MOBILE`), baked into the client at build time.
- Data is live-shared: a sale on the phone appears in the desktop app instantly.
- `@munim/api-client` joins every request path onto the configured base URL and
  **strips trailing slashes**, so `https://munim-api.onrender.com` and
  `https://munim-api.onrender.com/` are equivalent.

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
packages/api-client/  shared API client (fetch, auth, typed endpoints)
packages/ui/          shared UI kit (web + desktop render identically from here)
packages/theme/       shared design tokens (5 themes × light/dark)
apps/api/             NestJS backend — the only server (deployed on Render)
apps/web/             Next.js management app
apps/desktop/         Tauri v2 desktop app
apps/mobile/          React Native app (bare RN) + eas.json
render.yaml           Render blueprint (api service: build/start commands + env vars)
.github/workflows/    desktop-build, mobile-build, web, lint, db-migrate
docs/                 PLAN.md, ARCHITECTURE.md, features.md (matrix), theme.md, i18n-hindi.md, nestjs-backend.md
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

# 1. Start the API (requires DATABASE_URL in apps/api/.env — see apps/api/.env.example)
pnpm dev:api                                # http://localhost:4000

# 2. Run the web app (point it at the API in apps/web/.env — see apps/web/.env.example)
pnpm dev:web                                # http://localhost:3000

# 3. Desktop app (Tauri)
cp apps/desktop/.env.example apps/desktop/.env   # VITE_API_URL=…, VITE_API_KEY=…
pnpm dev:desktop

# 4. Mobile app (see apps/mobile/README.md)
cd apps/mobile && pnpm android              # set the API URL/key in onboarding/Settings
```

Apply the database schema once: `pnpm --filter @munim/core db:migrate` (or
`db:push`).

## Deployment

### API — Render

`render.yaml` at the repo root defines the `munim-api` web service:

- **Root directory:** `.` (repo root — the pnpm workspace lockfile lives here)
- **Build command:** `pnpm --filter @munim/api build`
- **Start command:** `cd apps/api && pnpm start` (binds Render's injected `PORT`)
- **Health check:** `GET /healthz` (no API key required)

Deploy: **Render → New Blueprint Instance → select repo → `main` branch**.
Render reads `render.yaml` and creates the service; fill the env vars it
prompts for:

| Env var | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | Neon connection string — the API crashes at boot without it |
| `API_KEY_WEB` | optional | 8+ chars; must match the web app's `NEXT_PUBLIC_API_KEY` |
| `API_KEY_DESKTOP` | optional | 8+ chars; must match the desktop secret `VITE_API_KEY` |
| `API_KEY_MOBILE` | optional | 8+ chars; must match the mobile secret `EXPO_PUBLIC_API_KEY` |
| `CORS_ORIGINS` | for web | Comma-separated browser origins, e.g. `https://munim-web.onrender.com` |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | optional | server-side signed uploads; `/api/upload` returns 503 when unset |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | optional | shared cache; falls back to in-process cache when unset |

> ⚠️ **Config changes require a fresh blueprint.** An existing Render service
> keeps its old build/start commands — `render.yaml` is only applied when the
> blueprint is created. Delete the old service (and blueprint) and create a
> **New Blueprint Instance** to pick up changes.

### Web app

Set these in the web hosting platform's environment (inlined at build time):

- `NEXT_PUBLIC_API_URL` — API base URL, e.g. `https://munim-api.onrender.com`
  (trailing slash optional — the client strips it)
- `NEXT_PUBLIC_API_KEY` — must equal the server's `API_KEY_WEB`

The web origin must also be listed in the server's `CORS_ORIGINS`, or browser
calls are blocked.

### Desktop & mobile — GitHub Actions secrets

Set in **GitHub → Settings → Secrets and variables → Actions**:

| Secret | App | Must match server env |
|---|---|---|
| `VITE_API_URL` | desktop | — |
| `VITE_API_KEY` | desktop | `API_KEY_DESKTOP` |
| `EXPO_PUBLIC_API_URL` | mobile | — |
| `EXPO_PUBLIC_API_KEY` | mobile | `API_KEY_MOBILE` |

Optional Cloudinary fallback: `VITE_CLOUDINARY_CLOUD_NAME` +
`VITE_CLOUDINARY_UPLOAD_PRESET` (desktop) and
`EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME` + `EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET`
(mobile) — image uploads still work through the API without them. The desktop
and mobile workflows **fail fast** when the required secrets are missing.

Generate keys with `openssl rand -hex 32`. Users can still override the
URL/key in onboarding or Settings per device.

## CI/CD

| Workflow | Trigger | Result |
|---|---|---|
| `render.yaml` (API) | push to `main` | Deploys `munim-api` on Render (build + start commands above) |
| `.github/workflows/desktop-build.yml` | **manual** | Windows NSIS installer via `tauri-action`, uploaded as artifact |
| `.github/workflows/mobile-build.yml` | **manual** / mobile native changes | Android APK built directly with Gradle (no EAS): `debug` dev-client shell or `release` APK with bundled JS, uploaded as an artifact |
| `.github/workflows/web.yml` | push/PR | web typecheck + `next build` |
| `.github/workflows/lint.yml` | push/PR | ESLint across the repo (typed no-any/no-unknown rules) |
| `.github/workflows/db-migrate.yml` | push to main / manual | drift-check (migrations committed?) + apply pending Drizzle migrations to Neon |

## Rules & memory

Read **[AGENTS.md](AGENTS.md)** before contributing — it encodes hard rules:
no `any`/`unknown`/`as any`/`as unknown` (with one documented exception),
types defined once in core and never redefined, and all shared logic reused
from `packages/core`. Architecture decisions and the phase plan live in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/PLAN.md`](docs/PLAN.md),
and the feature × platform matrix in [`docs/features.md`](docs/features.md).
Hindi language support is planned in [`docs/i18n-hindi.md`](docs/i18n-hindi.md).
