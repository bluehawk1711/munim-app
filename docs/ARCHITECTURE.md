# Architecture Decision Record & Developer Memory

This file is the project memory: decisions, rules, and skills. Read it when you
pick up work. Append new decisions here instead of re-litigating old ones.

## Decisions (ADR)

### ADR-001 — No API server: shared Neon Postgres via SQL-over-HTTP
**Status:** Accepted · **Date:** 2026-08

All three apps (web, desktop, mobile) connect **directly** to a single Neon
Postgres database. No backend service exists.

**Why:** The user requirement was "a global DB where all logic lives there and
is imported by all 3 applications" — no separate API server. Research
confirmed `drizzle-orm/pg-proxy` (plain `fetch` handler) is the only Drizzle
driver that runs identically in Node (Next.js), a browser webview (Tauri), and
React Native. Neon's SQL-over-HTTP endpoint supports CORS and works from RN's
`fetch`.

**Consequences:**
- All business logic lives in `packages/core`; apps import it directly.
- DB credentials are per-app environment secrets (`.env`), never committed.
- Data is live-shared across all devices with no sync layer.

### ADR-002 — Monorepo: pnpm workspaces + Turborepo
**Status:** Accepted

`apps/web` (Next.js), `apps/desktop` (Tauri v2), `apps/mobile` (React Native),
`packages/core` (shared brain). pnpm 11, Turborepo for task orchestration.

### ADR-003 — `packages/core` is the single source of truth
**Status:** Accepted

Schema, types, services, utils, and bill/invoice generation live in core.
Apps never redefine types or reimplement business logic (see `AGENTS.md`).

### ADR-004 — Desktop app from `kitlib/tauri-app-template`
**Status:** Accepted

`apps/desktop` is scaffolded from https://github.com/kitlib/tauri-app-template
(Vite + React 19 + Tailwind v4 + shadcn/ui + Tauri v2) — not built from
scratch. Adapted: branding (Munim), feature screens, wiring to core, CI.

### ADR-005 — Mobile app from `react-native-community/template`
**Status:** Accepted

`apps/mobile` is scaffolded from the official RN community template at stable
tag **0.86.2** (TypeScript, bare RN with `android/` + `ios/`) — not built from
scratch. It is bare RN (not Expo); Android dev builds go through **EAS Build**.

### ADR-006 — Mobile Android builds via EAS Build CLI
**Status:** Accepted

`eas.json` profiles: `development` → debug APK (`:app:assembleDebug`,
`buildType: apk`, `distribution: internal`); `preview`/`release` for
distribution. EAS supports bare RN projects **without** the `expo` package; it
detects the pnpm workspace and runs `pnpm install` at the root. CI: GitHub
Actions with `expo/expo-github-action@v8` + `EXPO_TOKEN` secret.

### ADR-007 — Desktop CI via GitHub Actions + tauri-action
**Status:** Accepted

Windows NSIS installer built by `tauri-action` on push/tags; Rust target dir
cached (`swatinem/rust-cache`), pnpm frozen install, artifacts uploaded.

### ADR-008 — Shared bill/invoice generation lives in core
**Status:** Accepted

The bill model + generator (totals, amount-in-words via `numberToWords`, item
snapshots, invoice numbering, formatting) moved from the web app into
`packages/core/src/billing/`. All three apps render the same bill; each app
keeps only a thin platform print/PDF adapter.

## Security notes

- The Neon connection string (which includes the DB password) is stored by the
  desktop app in webview `localStorage` and by the mobile app in AsyncStorage —
  plaintext on device. This is inherent to the no-API-server design. Use a
  **least-privilege DB role** for the desktop/mobile connection strings (e.g. a
  role limited to the `munim` schema, `SELECT/INSERT/UPDATE/DELETE` only) so a
  leaked client key cannot DROP tables or touch other projects.
- Never commit `.env` files; only `.env.example`.

## Type discipline (from AGENTS.md)

- No `any` / `unknown` / `as any` / `as unknown`, except as a documented last
  resort with a runtime narrowing guard.
- Types are defined once in core and imported; never redefined in apps.
- Reuse core logic (billing, numberToWords, codes, services) everywhere.

## Environment & connection pattern

```env
# .env for each app (never committed)
DATABASE_URL=postgresql://<user>:<password>@<host>/<db>?sslmode=require
```

Web (Next.js server routes) and desktop (Tauri webview) read `DATABASE_URL`
from env. Mobile: pass the connection string at build/launch time via app
config (or a settings screen) — never hardcode.

Migration commands (from `packages/core`):

```bash
pnpm exec drizzle-kit generate   # write new migration SQL
pnpm exec drizzle-kit push       # apply to a dev database (or use migrate)
```

Rebuild core after changing its public API (consumers import from `dist/`):

```bash
pnpm --filter @munim/core build
```

## Skills in use (installed to `.agents/skills/`)

- `tauri-v2` — desktop work
- `expo-dev-client`, `expo-tailwind-setup`, `expo-upgrade` — mobile dev builds / styling / upgrades
- `nextjs-app-router-patterns` — web app work
- `sqlite-database-expert` — DB discipline (parameterization, transactions)

## Repo map (quick reference)

| Path | What it is |
|---|---|
| `packages/core/src/db/schema.ts` | All tables (products, invoices, items, parties, advances, payments, job letters, settings, activity) |
| `packages/core/src/services/*` | Business logic: products, invoices, parties, advances, payments, jobLetters, dashboard, settings, activity |
| `packages/core/src/billing/*` | Shared bill/invoice generation (all 3 apps) |
| `apps/web/src/app/api/*` | Thin Next.js route adapters calling core services |
| `apps/web/src/views/*` | Web UI screens |
| `apps/desktop/src/pages/*` | Desktop screens (Tauri) |
| `apps/mobile/src/screens/*` | Mobile screens (RN) |
| `.github/workflows/*` | Desktop build + mobile EAS build CI |
