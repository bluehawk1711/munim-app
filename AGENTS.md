# AGENTS.md — Rules for AI agents & developers working on Munim

These rules are **mandatory**. Read them before touching any code.

## 1. Strict type discipline (non-negotiable)

- **NEVER use `any`, `unknown`, `as any`, or `as unknown`** anywhere in this
  codebase. Not in apps, not in packages, not in tests, not in scripts.
- They may be used **only** when _nothing else can possibly work_ (e.g. an
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

## 4b. Web ⇄ Desktop feature parity (mandatory)

- **Web and desktop are treated as ONE UI surface.** Every module/feature that
exists on web must exist on desktop and vice versa — they are the same product
on two window sizes. Mobile is tracked separately (see `docs/features.md`).
- **Shared UI components live in `@munim/ui` (`packages/ui/src/components/`).**
  Presentational building blocks used by more than one screen (stat tiles,
  status badges, khata cards, bill options, PIN gate, …) must be extracted
there and consumed by BOTH apps. NEVER fork a shared component into an app.
- **Before building any web or desktop screen**, check `docs/features.md`
  matrix + the other app's screen for the same module. Missing features are
  bugs; add them to both apps in the same change.
- Both apps render **shimmer skeletons** (`.skeleton-shimmer` in the shared
  theme `tokens.css`) while loading — never `animate-pulse` or plain "Loading…"
  text on web/desktop. Mobile uses its own shimmer `Loading` component.
- When adding a module to one app, update the other app, `docs/features.md`,
  this rules file, and the web/desktop sidebar navigation in the same change.

## 5. Skills to use during development

Installed in `.agents/skills/`:

| Skill                                                    | When to use                                                                                          |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `tauri-v2`                                               | Any Tauri desktop work (IPC, capabilities, config, plugins)                                          |
| `expo-dev-client`, `expo-tailwind-setup`, `expo-upgrade` | Mobile dev-build setup, styling, upgrades (apply to RN where relevant)                               |
| `nextjs-app-router-patterns`                             | Next.js web app work (routes, caching, server/client split)                                          |
| `sqlite-database-expert`                                 | DB discipline: parameterized queries, transactions, schema review (principles apply to our Postgres) |
| `browser-act`                                            | Verifying web UI in a real browser — click-through flows, dialogs, layout/rendering, console errors. ALWAYS use this skill for web UI testing (never guess from code alone). |

## 6. Browser testing (web UI) — use `browser-act`

Whenever the web app needs verification (a button that "doesn't work", dialog
layout, a flow, console errors), test it in a real browser with the
[`browser-act`](.agents/skills/browser-act/SKILL.md) skill — its Python CLI is
installed. Do not guess from code; get evidence.

Workflow (session name is yours — create it, close it when done, never touch
another conversation's session):

```bash
# 1. Ensure the dev server is running
cd apps/web && npx next dev -p 3333

# 2. Pick a browser, then open a session on it
browser-act browser list
browser-act --session <name> browser open <browser_id> http://localhost:3333/

# 3. The PIN gate may appear (fresh profile → test account 1234):
browser-act --session <name> state          # read indices, e.g. [1]=1, [2]=2, [3]=3, [4]=4
browser-act --session <name> click 1 && browser-act --session <name> click 2 \
  && browser-act --session <name> click 3 && browser-act --session <name> click 4

# 4. Interact — indices are snapshots: re-run `state` after ANY navigation/click
browser-act --session <name> state
browser-act --session <name> click <index>
browser-act --session <name> wait stable
browser-act --session <name> state          # fresh indices after the page changed

# 5. Verify & extract
browser-act --session <name> get markdown
browser-act --session <name> eval "document.querySelectorAll('[role=dialog]').length"

# 6. Clean up
browser-act session close <name>
```

Rules:
- Element indices from `state` are only valid for that snapshot. After any
  navigation, click, or re-render, run `state` again — never reuse old indices.
- When the target isn't visible or multiple candidates match, inspect further
  before acting; don't guess an index.
- Fallback if `browser-act` is unavailable: Playwright Python CLI
  (`playwright`, v1.58) is installed on this machine.

## 7. Working agreements

- Migrations are generated with `drizzle-kit generate` **from** `packages/core`
  and committed; never hand-edit migration SQL unless a comment explains why.
- Run `pnpm --filter <pkg> ...` for targeted commands; `pnpm turbo <task>` for
  repo-wide.
- Typecheck your change (`tsc --noEmit` for the affected app/package) before
  finishing. Keep the whole repo typechecking clean.
- After rebuilding `packages/core` (`tsc` in `packages/core`), consumers read
  the fresh `dist/` — rebuild core whenever its public API changes.
- Commit messages describe the _why_, not just the _what_.
- Mobile builds run through **EAS Build** (Android dev build = debug APK via
  `:app:assembleDebug`). Desktop builds run through GitHub Actions +
  `tauri-action`.
