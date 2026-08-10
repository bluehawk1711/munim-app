# AGENTS.md — Rules for AI agents & developers working on Munim

These rules are **mandatory**. Read them before touching any code.

## 1. Strict type discipline (non-negotiable)

- **NEVER use `any`, `unknown`, `as any`, or `as unknown`** anywhere in this
  codebase. Not in apps, not in packages, not in tests, not in scripts.
- They may be used **only** when *nothing else can possibly work* (e.g. an
  untyped third-party boundary). In that single case you MUST:
  1. Add a `// eslint-disable-next-line` comment explaining exactly why, and
  2. Narrow the value with a runtime guard as close to the boundary as possible
     (a validation function / type predicate), so the rest of the code stays typed.
- Prefer precise types: discriminated unions, generics, `satisfies`, and literal
  types. Never loosen a type to silence an error — fix the data shape instead.
- `noUncheckedIndexedAccess` is ON in `packages/core` and `apps/web`. Handle
  `undefined` from indexed access explicitly (guard or fallback), never suppress it.
- **Sanctioned exception (documented here, not a loophole):** `Record<string, unknown>`
  is permitted ONLY for JSON-blob schema columns (`template_settings`, job letter
  `data`, `default_template`) and for parsing the Neon HTTP response payload.
  Everywhere else `unknown` is banned like `any`.

## 2. Define types ONCE, globally — never redefine

- **All domain types live in `packages/core`** (`src/types/` and the Drizzle
  schema in `src/db/schema.ts`). They are the single source of truth.
- Apps (`web`, `desktop`, `mobile`) **import types from `@munim/core`** and must
  NOT redefine, re-declare, or fork them locally.
- If a shape must differ slightly per app, derive it from the core type
  (`Pick`, `Omit`, `extends`) — do not duplicate it.
- When you add a field to a core type, update every consumer. Do not create
  parallel "local copies" of types.

## 3. All shared logic lives in `packages/core` — reuse, don't reimplement

- Bill/invoice **generation** (totals, amount-in-words, numbering, formatting,
  item snapshots) lives ONCE in `packages/core/src/billing/` and `utils/`.
  All 3 apps produce the **same bill** by importing core. Apps only render.
- Same rule applies to: `numberToWords`, SKU/barcode generation, invoice
  numbering, currency/date formatting, id generation, and every business
  service (stock, sales, invoices, parties, advances, payments, job letters,
  dashboard, reports, settings, activity).
- Apps contain **only**: UI components, platform adapters (PDF/print), and thin
  data hooks that call core services. If you find yourself copying business
  logic into an app, STOP — move it to core.
- Reuse existing UI primitives (shadcn/ui in web & desktop, RN core components
  in mobile). Do not build parallel component sets.

## 4. Architecture: no API server

- The database is **Neon Postgres**, accessed via `drizzle-orm/pg-proxy` (pure
  `fetch`) from ALL THREE runtimes (Node/Next.js, Tauri webview, React Native).
- **Do not** introduce an API server / backend microservice. Business logic is
  the `core` package, imported directly by every app.
- The only secrets are database connection strings (`.env` per app, or runtime
  config). Never hardcode credentials, never commit `.env`.

## 5. Skills to use during development

Installed in `.agents/skills/`:

| Skill | When to use |
|---|---|
| `tauri-v2` | Any Tauri desktop work (IPC, capabilities, config, plugins) |
| `expo-dev-client`, `expo-tailwind-setup`, `expo-upgrade` | Mobile dev-build setup, styling, upgrades (apply to RN where relevant) |
| `nextjs-app-router-patterns` | Next.js web app work (routes, caching, server/client split) |
| `sqlite-database-expert` | DB discipline: parameterized queries, transactions, schema review (principles apply to our Postgres) |

## 6. Working agreements

- Migrations are generated with `drizzle-kit generate` **from** `packages/core`
  and committed; never hand-edit migration SQL unless a comment explains why.
- Run `pnpm --filter <pkg> ...` for targeted commands; `pnpm turbo <task>` for
  repo-wide.
- Typecheck your change (`tsc --noEmit` for the affected app/package) before
  finishing. Keep the whole repo typechecking clean.
- After rebuilding `packages/core` (`tsc` in `packages/core`), consumers read
  the fresh `dist/` — rebuild core whenever its public API changes.
- Commit messages describe the *why*, not just the *what*.
- Mobile builds run through **EAS Build** (Android dev build = debug APK via
  `:app:assembleDebug`). Desktop builds run through GitHub Actions +
  `tauri-action`.
