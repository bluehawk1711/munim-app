# Munim — Testing & Verification Guide

How to verify a change before you call it done. Run the **static checks** on
every change, then the **targeted checks** for the layer you touched (see the
table at the end), then **browser-act** for any web UI change (AGENTS §6 —
never guess from code alone).

---

## 1. Static checks (always)

```bash
pnpm typecheck        # turbo typecheck — all packages + apps (depends on ^build)
pnpm lint             # turbo lint (eslint per workspace)
pnpm build            # turbo build — next/vite/tsc builds for everything
pnpm format           # prettier --write on ts/tsx/md/json
```

Targeted (faster while iterating):

```bash
pnpm --filter @munim/core typecheck        # after editing core — then REBUILD:
pnpm --filter @munim/core build            # consumers read packages/core/dist
pnpm --filter @munim/api-client build      # and the other library packages
pnpm --filter @munim/query build
pnpm --filter @munim/ui build
pnpm --filter @munim/web typecheck
pnpm --filter @munim/desktop typecheck     # desktop: pnpm --filter @munim/desktop check (lint+typecheck)
pnpm --filter @munim/mobile typecheck
```

> **Rule:** after changing `packages/core`'s public API, rebuild core (and any
> other package you changed) **before** typechecking apps — apps compile
> against `dist/`.

Repo-wide type discipline is enforced by review, not a linter rule: **no
`any` / `unknown` / `as any`** (AGENTS §1), `noUncheckedIndexedAccess` is on in
core + web — handle `undefined` from indexed access explicitly.

---

## 2. Unit & smoke tests (no DB, CI-safe)

| What | Command | Notes |
|---|---|---|
| Core service smoke | `pnpm db:smoke` | **Needs `DATABASE_URL`** in `packages/core/.env` — runs every exported core service against the real DB, then deletes its test records (73 checks) |
| API unit smoke | `pnpm --filter @munim/api test` | `apps/api/test/smoke.ts` — boots the Nest app with a stub fetch + stub DB, auth 401 + happy paths (14 checks) |
| Cache contract | `pnpm --filter @munim/api exec tsx test/cache.spec.ts` | `CacheService` against the in-memory fallback: cache-aside, null-skip, TTL, prefix invalidation, group composition (11 checks) |
| api-client smoke | `pnpm --filter @munim/api-client test` | Typed client against a stub server (14 checks) |
| query hooks smoke | `pnpm --filter @munim/query test` | Hook surface + query keys compile and hang together |
| store smoke | `pnpm --filter @munim/store test` | Zustand factory contract |
| Mobile unit tests | `pnpm --filter @munim/mobile test` | jest (`apps/mobile/jest.config.js`, `react-native` preset) — currently no `__tests__` specs; command must still exit green |

## 3. Live-DB checks (need `DATABASE_URL`)

These hit the real Neon database. They create **and delete** their own test
records; still, run them against dev, not prod data you care about.

```bash
# Full core service smoke (also listed above)
pnpm db:smoke

# Pricing engine round-trip
pnpm db:verify-pricing

# Invoice guards (ZERO_PRICE_ITEM / ZERO_TOTAL / BAD_QUANTITY) — one real
# invoice created then deleted. Run from packages/core:
pnpm --filter @munim/core exec esbuild scripts/verify-invoice-guards.ts \
  --bundle --platform=node --format=esm --outfile=scripts/.v1.mjs && \
  node packages/core/scripts/.v1.mjs

# Purity field end-to-end (migration 0004) — same pattern with verify-purity.ts

# API end-to-end against the live DB (run from apps/api; skipped if no DATABASE_URL)
cd apps/api
npx tsx test/e2e-live.ts     # controllers + pg.Pool client, 16 checks
npx tsx test/e2e-client.ts   # the same flows through @munim/api-client, 17 checks
```

**Migrations:** schema changes go through generated migrations only —
`pnpm db:generate` from `packages/core`, commit the SQL, apply via the manual
`db-migrate` GitHub workflow (main only). Its **drift-check** job regenerates
migrations and fails if `packages/core/drizzle/` is out of date, so never
hand-edit or skip the generated files.

---

## 4. Web UI verification — browser-act (mandatory)

Any web change (buttons, dialogs, flows, layout, console errors) must be
verified in a real browser. Full workflow lives in `AGENTS.md` §6; the short
version:

```bash
# 1. API first (web talks to http://localhost:4000)
pnpm --filter @munim/api dev            # PORT=4000, x-api-key auth

# 2. Web dev server (next dev; use -p 3333 when you want a separate instance)
cd apps/web && npx next dev -p 3333

# 3. Open a session, pass the PIN gate (fresh profile → test PIN 1234)
browser-act browser list
browser-act --session <name> browser open <browser_id> http://localhost:3333/
browser-act --session <name> state          # read indices [1]..[4]
browser-act --session <name> click 1 && browser-act --session <name> click 2 \
  && browser-act --session <name> click 3 && browser-act --session <name> click 4

# 4. Interact — indices are a snapshot: re-run `state` after ANY navigation
browser-act --session <name> wait stable
browser-act --session <name> get markdown
browser-act --session <name> eval "document.querySelectorAll('[role=dialog]').length"

# 5. Clean up your own session when done
browser-act session close <name>
```

**Responsiveness (1280 / 900 / 600 px):** `window.resizeTo` is a no-op in
headless mode. Emulate the width with a same-origin iframe — media queries
respond to the *iframe's* width:

```js
// eval: mount a same-origin iframe at the target width, load the app in it,
// then audit scrollWidth vs clientWidth inside the frame's document.
// Confirmed working: at 600px the sidebar drops out and bottom-nav kicks in.
```

Fallback when `browser-act` is unavailable: the Playwright Python CLI
(`playwright`, v1.58) is installed on this machine.

**Data hygiene:** end-to-end flows that write (bulk edit, record payment,
create product) must be **reverted** afterwards, and throwaway categories /
parties cleaned up, so the dev DB stays usable for everyone.

---

## 5. API manual checks

```bash
pnpm --filter @munim/api dev                       # http://localhost:4000
KEY=$(grep -E '^API_KEY_WEB=' apps/api/.env | cut -d= -f2-)
curl -s -H "x-api-key: $KEY" http://localhost:4000/api/products?pageSize=2 | head -c 400
curl -s http://localhost:4000/healthz              # liveness (no key)
curl -s http://localhost:4000/readyz               # DB (+ Upstash when configured)
curl -s -H "x-api-key: wrong" http://localhost:4000/api/products   # must be 401
```

Caching behavior to spot-check after touching a read endpoint: repeat the GET
(should be served from cache), then hit the matching write (key-prefix
invalidation) and GET again — the fresh row must appear.

---

## 6. Desktop & mobile

```bash
# Desktop (Tauri v2): typecheck + lint + vite build; UI through
pnpm --filter @munim/desktop check
pnpm tauri:dev                                   # real window; tauri-plugin-http → API

# Mobile (bare RN): jest + tsc; native builds only when a native module changes
pnpm --filter @munim/mobile test
pnpm --filter @munim/mobile typecheck
pnpm build:mobile:android                        # local debug APK (Gradle)
# CI: .github/workflows/mobile-build.yml — manual workflow_dispatch (Gradle, no EAS)
```

---

## 7. CI (`.github/workflows/`)

All five workflows are **manual** (`workflow_dispatch` only — nothing runs on
push): trigger them via Actions → "Run workflow".

| Workflow | What it runs |
|---|---|
| `lint.yml` | `pnpm lint` across the workspace |
| `web.yml` | build shared packages → typecheck → `next build` |
| `desktop-build.yml` | Tauri build via `tauri-action` (Windows NSIS installer) |
| `mobile-build.yml` | Gradle debug/release APK (`variant` input) |
| `db-migrate.yml` | **drift-check** (regenerates migrations, `git diff --exit-code` on `packages/core/drizzle/` — fails if the SQL isn't committed) → then **migrate** job applies pending migrations to Neon, `main` only, `production` environment |

---

## 8. What to run per change

| You changed… | Run at minimum |
|---|---|
| `packages/core` | core typecheck + **build** → all 5 package typechecks → `pnpm db:smoke` (+ `db:verify-pricing` for pricing/billing) |
| `apps/api` | `pnpm --filter @munim/api typecheck && lint && test` → live `e2e-live.ts` + `e2e-client.ts` |
| `packages/api-client` / `query` / `store` | package build + its `test` smoke → consuming apps' typecheck |
| Web UI | web typecheck + **browser-act click-through** (incl. 1280/900/600 for layout changes) |
| Desktop UI | desktop `check` + `tauri:dev` manual pass — **and the same feature on web** (AGENTS §4b parity) |
| Mobile UI | mobile typecheck + jest + device/emulator pass |
| Schema | `pnpm db:generate` + commit SQL → drift-check passes |
| Docs / help content | `docs/pages.md` (help mirror) + `docs/features.md` updated in the same change |
