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
keeps only a thin platform print/PDF adapter. Desktop + mobile render the exact
shared `renderBillHtml` (jsPDF `html()` / `expo-print`); web keeps its rich
jsPDF templates with identical content.

### ADR-009 — Shared UI kit `packages/ui` for web + desktop
**Status:** Accepted

Web and desktop are treated as **one UI surface** (`AGENTS.md` §4b).
Presentational building blocks used by more than one screen (stat tiles, status
badges, khata cards, bill template options, record-payment / advance dialogs,
settings shell, PIN gate, animated theme toggle, switch, skeleton, theme
select) live in `packages/ui` and are consumed by BOTH apps — never forked.
Mobile is platform-native (RN components) and is tracked separately in
`docs/features.md`.

### ADR-010 — Shared design tokens `packages/theme`
**Status:** Accepted

Every color/radius token lives once in `packages/theme/src/tokens.ts` (5
curated themes × light+dark). Web + desktop import the generated
`dist/tokens.css` (CSS custom properties, `[data-theme]` blocks); mobile reads
a hex palette via `mobileColorsFor(mode, themeName)` because RN's color parser
rejects `oklch()`/`oklab()`. See `docs/theme.md`.

### ADR-011 — Theme + dark/light mode sync via the shared settings row
**Status:** **Superseded** by ADR-011b (device-local themes)

Originally the `settings` table gained `theme` and `mode` columns and every app
wrote its chosen theme/mode to Neon and pulled on startup. That cross-platform
sync was **removed**: it caused the dark-mode accent to fall back to the default
(Apple Gold) when a stale row value clobbered the freshly selected theme.

**ADR-011b — Theme + dark/light mode are device-local** (Accepted)

Each app now persists its theme/mode choice **locally only** — web/desktop in
localStorage (`munim.theme` / `munim.themeMode`, desktop `munim-desktop-*`),
mobile in AsyncStorage (`munim.accentTheme` / `munim.themeMode`) — and never
reads or writes the shared `settings` row for them. The `settings.theme` /
`settings.mode` columns remain in the schema for compatibility but are unused.
The "force animation play" flag stays **device-local** (localStorage /
AsyncStorage), as it overrides the OS animation preference.

### ADR-012 — Per-device 4-digit PIN app lock
**Status:** Accepted

Security is per-device and DB-free: `packages/core/src/security/pin.ts`
(pure-TS SHA-256 — works on Hermes/browser/Node) hashes a salted PIN; web +
desktop gate through `PinGate` in `@munim/ui` (localStorage `munim.pin`),
mobile through its own `PinLockScreen` (AsyncStorage). Test account PIN: `1234`.
Web adds a 30-day session cookie so the PIN isn't re-typed on every screen.

### ADR-013 — Mobile build is manual-only (direct Gradle, no EAS)
**Status:** Accepted

`.github/workflows/mobile-build.yml` is triggered **manually** and builds the
Android APK directly with Gradle (no EAS)
(`workflow_dispatch`) — a new dev build is only needed when a **native
library** changes (e.g. `expo-image-picker`, `@react-native-community/datetimepicker`).
JS-only changes hot-reload through Metro, so pushing shouldn't burn an EAS
build. Local builds remain available: `pnpm build:android` (debug APK) / 
`pnpm build:android:release` via `scripts/build-android.mjs`.

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
pnpm exec drizzle-kit generate   # write new migration SQL into ./drizzle
pnpm exec drizzle-kit migrate    # apply pending migrations (what CI runs)
```

Schema changes deploy through the **`db-migrate` GitHub Actions workflow**: edit
`schema.ts` → `pnpm db:generate` → commit `packages/core/drizzle/**` → the
`drift-check` job fails if migrations aren't committed, and the `migrate` job
(main only, `DATABASE_URL` secret) applies them to Neon. **`db:push` is only for
local scratch databases.** The baseline `0000_*.sql` is retrofitted to be
idempotent (`IF NOT EXISTS` + `DO` blocks) because the live DB was originally
created with `db:push` — future migrations stay plain drizzle output. One-time
check after the first CI migrate: eyeball the log for skipped statements, since
`IF NOT EXISTS` silently skips anything that already exists (a hidden schema
divergence would only surface later).

> ⚠️ **pnpm driver-resolution quirk** — drizzle-kit resolves the Postgres driver
> and the `.env` file from the **config directory** (`packages/core`), not the
> workspace root. The driver (`@neondatabase/serverless`, a devDependency of
> `packages/core` *and* the root) and `packages/core/.env` (`DATABASE_URL`) must
> both be present, or you get the "please install either of 'pg', 'postgres'..."
> and "Either connection \"url\" or \"host\"..." errors. Full write-up:
> `docs/features.md` → **Database tooling quirks**.

Rebuild core after changing its public API (consumers import from `dist/`):

```bash
pnpm --filter @munim/core build
```

## Skills in use (installed to `.agents/skills/`)

- `tauri-v2` — desktop work
- `expo-dev-client`, `expo-tailwind-setup`, `expo-upgrade` — mobile dev builds / styling / upgrades
- `nextjs-app-router-patterns` — web app work
- `sqlite-database-expert` — DB discipline (parameterization, transactions)
- `browser-act` — **mandatory for web UI verification** (real browser flows; see `AGENTS.md` §6)

## Repo map (quick reference)

| Path | What it is |
|---|---|
| `packages/core/src/db/schema.ts` | All tables (products, invoices, items, parties, advances, payments, job letters, settings, activity) |
| `packages/core/src/services/*` | Business logic: products, invoices, parties, advances, payments, jobLetters, dashboard, settings, activity |
| `packages/core/src/billing/*` | Shared bill/invoice generation (all 3 apps) |
| `packages/core/src/security/*` | PIN hashing/verify (pure-TS SHA-256) |
| `packages/ui/src/components/*` | Shared UI kit (web + desktop render from here) |
| `packages/theme/src/tokens.ts` | Design tokens — 5 themes × light/dark (single source of truth) |
| `apps/web/src/app/api/*` | Thin Next.js route adapters calling core services |
| `apps/web/src/views/*` | Web UI screens |
| `apps/desktop/src/pages/*` | Desktop screens (Tauri) |
| `apps/mobile/src/screens/*` | Mobile screens (RN) |
| `docs/features.md` | Feature × platform matrix (which app has what) |
| `.github/workflows/*` | Desktop build + mobile EAS build + web + lint + db-migrate CI |
