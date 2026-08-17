# Munim — NestJS Backend Plan

> Status: **Phases 1–3 landed (2026-08-17)** — `apps/api` scaffolded (Fastify,
> pg.Pool client, API-key guard, health checks, boot + live-DB e2e smoke), core
> prep done (`createServerDb` via `@munim/core/server`, validators +
> serializers moved into core, explicit `*Dto` wire types added to
> `packages/core/src/serialize`), **`packages/api-client` built** (typed
> client, one module per resource, `fetchImpl` injection, `ApiClientError`,
> CSV mode; 14-check unit smoke + 17-check live-DB e2e), and **Upstash
> caching landed (Phase 2)** — `CacheService` cache-aside + explicit
> prefix invalidation on every write; in-memory TTL fallback when
> `UPSTASH_REDIS_REST_URL/TOKEN` are unset; `/readyz` pings Upstash too;
> 11-check cache unit spec + live-DB e2e extended to 16 checks, all green.
> Remaining phases: 4 (desktop) → 5 (mobile) → 6 (web) → 7 (CI/CD + docs).
>
> Supersedes part of **ADR-001** (no API server). See "ADR updates" at the end.

---

## 1. Why & what

Today all three apps talk to Neon directly through `@munim/core`'s pg-proxy
(fetch-based) client:

- **Web** — Next.js server routes (`/api/*`) call core services with `getDb()`.
- **Desktop** — Tauri webview calls core with `createAppDb(url)` using the Rust
  HTTP plugin fetch (CORS workaround for Neon).
- **Mobile** — RN calls core with `createDb({databaseUrl})` (native fetch).

This works but has real costs: every query is a **fresh HTTP round-trip to
Neon's SQL-over-HTTP endpoint** (no connection pooling, no prepared-statement
reuse), the DB password sits in each client, and the desktop needs a CORS
hack. The plan: a **NestJS API server** that owns the pooled DB connection and
exposes a REST API, and desktop + mobile talk to *it* instead of to Neon.

**The reusability guarantee:** every core service is a plain function that
takes a Drizzle client as its first argument (`listProducts(db, filters)`,
`getDashboard(db)`, …). The API creates a **fast `pg.Pool`-backed Drizzle
client** and passes it to the **exact same functions**. Zero business-logic
duplication — core stays the single source of truth.

---

## 2. Decisions (confirmed with the user)

| Decision | Choice |
|---|---|
| Framework | **NestJS 11** (Fastify adapter — ~2× Express throughput) |
| DB driver in API | `pg` connection pool via `drizzle-orm/node-postgres` (long-running process) |
| Business logic | 100% `packages/core` services — API only adds HTTP/validation/caching/auth |
| Auth | **3 static API keys** — one per platform (web / desktop / mobile), injected at **build time via GitHub secrets**, sent by each client as `x-api-key` |
| Caching | **Upstash Redis** via `@upstash/redis` (REST SDK) in a small `CacheService` (cache-aside + explicit prefix invalidation); in-memory TTL fallback when `UPSTASH_REDIS_REST_URL/TOKEN` are unset. **Note:** the original plan's `upstash-redis` cache-manager store was **unpublished in 2021** — using the SDK directly instead |
| Deploy | **Render or Railway** (container, long-running Node) — Node 24, same as CI |
| Order | Desktop → mobile → web — **all three now on the API** (Phases 4–6) |
| DB | Neon unchanged; migrations flow unchanged (`db-migrate` workflow) |

---

## 3. New packages

```
apps/api/                  ← NestJS API server (new workspace member)
packages/api-client/       ← shared typed HTTP client (desktop + mobile + web later)
packages/core/             ← gains: server db factory, validators, serializers (existing)
```

### `apps/api` (NestJS)

```
apps/api/
├── src/
│   ├── main.ts                 # Fastify bootstrap, helmet, compression, CORS, shutdown hooks
│   ├── app.module.ts           # ConfigModule, CacheModule (Upstash), ThrottlerModule
│   ├── config/
│   │   └── env.ts              # validated env: DATABASE_URL, API_KEY_* , UPSTASH_*, CORS_ORIGINS
│   ├── db/
│   │   └── drizzle.provider.ts # pg.Pool singleton → drizzle client (type = core DbClient)
│   ├── auth/
│   │   ├── api-key.guard.ts    # x-api-key header vs env keys (per-platform constant-time compare)
│   │   └── api-key.decorator.ts
│   ├── common/
│   │   ├── exception.filter.ts # consistent { error, status } JSON shape
│   │   ├── validation.pipe.ts  # zod-based (shared core schemas) — NOT class-validator
│   │   └── cache.service.ts    # cache-aside wrapper (get/set + invalidation helpers)
│   ├── controllers/            # 1:1 with the web /api/* routes (see §5)
│   │   ├── products.controller.ts
│   │   ├── colors.controller.ts / sizes.controller.ts / categories.controller.ts
│   │   ├── sales.controller.ts
│   │   ├── invoices.controller.ts / payments.controller.ts
│   │   ├── parties.controller.ts / advances.controller.ts
│   │   ├── job-letters.controller.ts
│   │   ├── reports.controller.ts
│   │   ├── settings.controller.ts
│   │   ├── dashboard.controller.ts
│   │   └── upload.controller.ts # Cloudinary signed upload (server-side secret)
│   └── health/
│       └── health.controller.ts # GET /healthz (liveness), GET /readyz (DB + Upstash ping)
├── test/                       # e2e smoke (auth 401, happy path create+list)
├── Dockerfile                  # multi-stage, node:24-alpine, non-root
└── package.json
```

### `packages/api-client` (shared typed client)

```
packages/api-client/
├── src/
│   ├── index.ts        # createApiClient({ baseUrl, apiKey, fetchImpl? }) → ApiClient
│   ├── types.ts        # DTOs re-exported from @munim/core (no redefinition)
│   └── endpoints/      # one module per resource, methods mirror core service names
│       ├── products.ts     # list(filters), get(id), create(v), update(id, v), remove(id)
│       ├── dashboard.ts    # get()
│       ├── invoices.ts     # list(filters), create(v), remove(id), recordPayment(id, v)
│       ├── parties.ts / advances.ts / payments.ts
│       ├── job-letters.ts / reports.ts / settings.ts
│       └── catalog.ts      # colors/sizes/categories list+create+rename+remove
├── package.json
```

**Swap mechanics:** `api.products.list({ search, page })` etc. keep the same
argument/return shapes as today's core calls, so screen changes are mechanical.
`fetchImpl` is injectable — desktop passes the Tauri HTTP-plugin fetch, mobile
and web pass global `fetch`.

---

## 4. Core changes (small, additive)

1. **`createServerDb()`** in `packages/core/src/db/server.ts` — builds a
   `pg.Pool`-backed Drizzle client:
   ```ts
   import { Pool } from "pg";
   import { drizzle } from "drizzle-orm/node-postgres";
   export function createServerDb(connectionString: string) { … }
   ```
   Return type must satisfy core's `DbClient` so service signatures don't
   change. **Watch out:** `DbClient` is `ReturnType<typeof createDb>` (pg-proxy
   drizzle); the node-postgres client is structurally similar but the generic
   params differ — plan for a one-line cast *or* re-typing `DbClient` to a
   structural `PgDatabase` type. Verify with `pnpm --filter @munim/core build`
   + API typecheck.
2. **Move validators into core** — `apps/web/src/lib/validators.ts`
   (`productSchema`, `saleSchema`, `stockAdjustmentSchema`) →
   `packages/core/src/validators/`; web imports them from `@munim/core` (single
   source). Add the missing ones (invoice, party, advance, payment, job-letter,
   settings, report) so **both** the API and web validate with the same schemas.
3. **Move serialization into core** — `apps/web/src/lib/serialize.ts`
   (Date→ISO string + join-flattening) → `packages/core/src/serialize/`; API
   and web both use it.
4. Add `pg` + `drizzle-orm/node-postgres` as deps of `apps/api` (not core —
   core stays client-safe; `pg` never ships to RN/webview).

---

## 5. API surface (mirrors web `/api/*` exactly)

| Resource | Endpoints (all implemented) |
|---|---|
| Products | `GET /api/products?search&color&size&category&status&page&pageSize`, `POST /api/products`, `GET/PUT/DELETE /api/products/:id`, `PATCH /api/products/:id/stock`, `GET /api/products/:id/movements`, `GET /api/products/lookup?barcode`, `GET /api/products/meta`, `POST /api/products/backfill-barcodes` |
| Catalog (colors/sizes/categories) | `GET/POST /api/catalog/:kind`, `PATCH/DELETE /api/catalog/:kind/:id` (`kind` = color \| size \| category) |
| Sales | `GET /api/sales?search&status&startDate&endDate`, `POST /api/sales` (quick sale), `DELETE /api/sales/:id` (undo → stock restore) |
| Invoices | `GET /api/invoices?search&status&partyId&startDate&endDate&page&pageSize`, `POST /api/invoices`, `GET/DELETE /api/invoices/:id`, `POST /api/invoices/:id/payment` |
| Payments | `GET/POST /api/payments` (money in/out against a party) |
| Parties | `GET /api/parties?search&type&balances`, `POST /api/parties`, `GET/PUT/DELETE /api/parties/:id` (GET returns party + ledger) |
| Advances | `GET/POST /api/advances`, `POST /api/advances/:id/settle`, `DELETE /api/advances/:id` |
| Job letters | `GET/POST /api/job-letters`, `DELETE /api/job-letters/:id` |
| Reports | `GET /api/reports?type&startDate&endDate[&format=csv]` (all types + custom dates) |
| Settings | `GET/PUT /api/settings` |
| Dashboard | `GET /api/dashboard` (all 7 stat sets) |
| Upload | `POST /api/upload` (multipart `file` field, Cloudinary signed — secret lives only on the server) |
| Health | `GET /healthz`, `GET /readyz` |

Every controller = parse DTO (shared zod schema) → call core service with the
injected drizzle client → serialize → JSON. Controllers never contain business
logic.

---

## 6. Caching — Upstash Redis ✅

**Library choice:** `node-cache` is effectively abandoned (in-memory only,
unmaintained). The originally-planned `upstash-redis` cache-manager store was
**unpublished in 2021** — instead we use **`@upstash/redis` (the REST SDK)
directly** in a small `CacheService` (`apps/api/src/common/cache.service.ts`):
`cacheAside(key, ttl, loader)`, `get/set/del`, `delByPrefix` (SCAN + pipelined
DEL over REST), `ping`. When `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`
are unset it falls back to an **in-process TTL Map** (single-instance dev;
`isRedis` reports which). Reads are **fail-open**: a Redis error logs once/min
and falls through to the loader rather than failing the request.

Keys are namespaced `munim:*`; all controllers inject the service explicitly
(`@Inject(CacheService)` — required because the tsx dev runner doesn't emit
`design:paramtypes` decorator metadata). `apps/api/src/common/cache.keys.ts`
holds the key builders + **invalidation groups**: a write invalidates every
prefix that could hold derived data (conservative by design).

**What gets cached (read-heavy, safe):**

| Cache key | TTL | Invalidation group(s) on write |
|---|---|---|
| `dashboard:get` | 30 s | products / invoices / parties / money / jobLetters / settings |
| `reports:{type}:{from}:{to}` | 120 s | products / invoices / parties / money |
| `catalog:{kind}:list` | 300 s | catalog (+ products — names embedded in rows) |
| `products:list:{hash(filters)}` / `products:get:{id}` / `products:lookup:{barcode}` / `products:meta` / `products:movements:{id}` | 300 s | products |
| `invoices:list:{hash}` / `invoices:get:{id}` / `sales:list:{hash}` | 120 s | invoices (covers sales) |
| `parties:list:{hash}` / `parties:balances` / `parties:get:{id}` | 120 s | parties / money |
| `advances:list:{partyId}` / `payments:list:{partyId}` | 120 s | money |
| `job-letters:list` | 120 s | jobLetters |
| `settings:get` | 300 s | settings |

**Rules:**
- **Cache-aside only** (never write-through); every mutating controller calls
  `invalidate(cache, [groups])` — explicit invalidation, never pure TTL trust
  for money data. Groups are conservative (see `CACHE_GROUPS` in
  `cache.keys.ts`).
- `null`/`undefined` loader results are never cached (a Redis miss is
  indistinguishable from a stored null).
- CSV reports run `reportToCsv` per-request over the cached report — the raw
  report is what gets cached.
- Invalidation uses Upstash SCAN (cursor loop, `count: 200`) + pipelined DEL;
  the memory fallback iterates its Map.

**Fixed while testing:** the settings schema rejected `null` on fields the
DB row actually returns (e.g. `shopAddress`/`shopEmail` can be NULL), so a
GET→PUT settings save 400'd on its own output. The shared `settingsSchema`
now accepts null and normalizes it to `undefined` via `.transform()` (a null
means "no change"), keeping `ShopSettingsInput` untouched.

---

## 7. Performance & production hardening

- **Fastify adapter** (`@nestjs/platform-fastify`) + `fastify-compress`
  (gzip/br) — the single biggest throughput win.
- **pg.Pool** — `max: 10`, `idleTimeoutMillis: 30_000`, `connectionTimeoutMillis:
  5_000`; kills the per-query TLS handshake of SQL-over-HTTP. Node 24 (matches
  CI).
- **Helmet** security headers; **CORS** restricted to configured origins
  (`CORS_ORIGINS` env — the web app origin; desktop/mobile native fetch don't
  need CORS, desktop Tauri fetch is Rust-side).
- **Throttler** (`@nestjs/throttler`) — e.g. 300 req/min per API key, burst 30.
- **pino** logging (`nestjs-pino`) — JSON logs, request IDs, low overhead.
- **Global exception filter** — `{ error: string, status: number }` shape, no
  stack leaks to clients; **ValidationPipe** with shared zod schemas.
- **Graceful shutdown** — SIGTERM → `app.close()` → `pool.end()`.
- **Health checks** — `/healthz` liveness, `/readyz` pings DB (`select 1`) +
  Upstash (`ping`); both wired to the container platform's health check.
- **Dockerfile** — multi-stage `node:24-alpine`, `pnpm --filter @munim/api
  --filter @munim/core build`, non-root user, `HEALTHCHECK` → `/readyz`.

---

## 8. Desktop refactor (Phase 4 detail)

1. **`apps/desktop/src/lib/core.ts`** — replace `getCore()`/`createAppDb()`
   with a single `api = createApiClient({ baseUrl, apiKey, fetchImpl: tauriFetch })`
   built once. API base URL + key from build env (`VITE_API_URL`,
   `VITE_API_KEY`) with a Settings override for local dev.
2. **Swap every page** `getDashboard(getCore())` → `api.dashboard.get()`,
   `listProducts(getCore(), f)` → `api.products.list(f)`, etc. — 11 pages,
   mechanical. Billing/PDF label/job-letter **stay client-side** (they render
   shared core HTML, no DB).
3. **Settings → Database section** becomes **API connection**: base URL +
   key (masked), non-dismissible test dialog now pings `/readyz` (or a
   `GET /healthz` with the key). Remove the Neon URL masking/save flow.
4. **Product image upload** moves to `POST /api/upload` — drop the
   desktop-side Cloudinary creds from `lib/env.ts` (secret now server-only).
5. Onboarding screen (desktop + mobile) simplifies: ask only **API base URL**
   (key is baked at build); remove the Neon + Cloudinary credential steps.
6. **CORS disappears as a class of bug** — the Tauri webview fetch hits our
   own API, which either allows the origin or is bypassed by the Tauri plugin.

## 9. Mobile refactor (Phase 5 detail)

1. **`apps/mobile/src/lib/core.ts`** — replace with `createApiClient({ baseUrl,
   apiKey: EXPO_PUBLIC_API_KEY, fetchImpl: globalThis.fetch })`. Base URL from
   `EXPO_PUBLIC_API_URL` (built via GitHub secret) + Settings override; remove
   the AsyncStorage Neon-URL flow.
2. **Swap every screen** (`HomeScreen` → `api.dashboard.get()`, …) — same
   mechanical pass as desktop, 11 screens. Native modules (camera, picker,
   print) untouched — **no dev-build rebuild needed for this refactor** (JS-only).
3. `expo-print` PDF sharing still renders shared core HTML client-side.
4. Barcode **camera scanning** keeps calling the (now API-backed) lookup —
   `api.products.byBarcode(code)`.

## 10. Web refactor (Phase 6 — done)

The Next.js `/api/*` server routes are **deleted**; the web app now calls the
NestJS API through the same shared `@munim/query` hooks as desktop + mobile,
resolving `NEXT_PUBLIC_API_URL` + `NEXT_PUBLIC_API_KEY` at build time (with a
same-origin fallback for local dev). Next.js stays the renderer; `lib/db.ts`,
`lib/cloudinary.ts` and the web-only seed route are gone. Deployment requires
`CORS_ORIGINS` on the API to include the web origin.

---

## 11. CI/CD & secrets

- **Secrets (GitHub):** `API_KEY_WEB`, `API_KEY_DESKTOP`, `API_KEY_MOBILE`
  (user generates 3 keys), `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`,
  `RENDER_API_KEY`/`RAILWAY_TOKEN` (deploy), existing `DATABASE_URL`.
- **New workflow `api-deploy.yml`:** on push to main → build `apps/api` →
  run `drizzle-kit migrate` (existing `db-migrate` flow) → deploy to
  Render/Railway with the API keys + Upstash + DB URL as env vars.
- **Desktop build (`desktop-build.yml`):** injects `VITE_API_URL`,
  `VITE_API_KEY` (from `API_KEY_DESKTOP` secret) plus the Cloudinary
  direct-upload fallback `VITE_CLOUDINARY_CLOUD_NAME` +
  `VITE_CLOUDINARY_UPLOAD_PRESET` (unsigned preset — see .env.example) onto the
  tauri-action step; the installer works without onboarding when the URL is
  baked in.
- **Mobile build (`mobile-build.yml`):** injects `EXPO_PUBLIC_API_URL`,
  `EXPO_PUBLIC_API_KEY` (from `API_KEY_MOBILE` secret) plus
  `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME` + `EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET`
  onto both APK build steps (inlined by Expo at bundle time).
- **Cloudinary upload path:** primary = `POST /api/upload` (server-side signed
  with `CLOUDINARY_*`). Fallback (desktop + mobile only) = direct unsigned
  upload to Cloudinary when the API upload is unavailable — client builds
  carry only the cloud name + unsigned preset, never the API secret.
- **Web build:** add `NEXT_PUBLIC_API_URL` + `NEXT_PUBLIC_API_KEY` to Vercel
  env (Phase 6 complete) and list the web origin in the API's `CORS_ORIGINS`.

---

## 12. Phases & tasks

### Phase 1 — Scaffold `apps/api` + core prep
- [ ] Add `apps/api` (NestJS + Fastify, Node 24, pnpm workspace, turbo
      `dev`/`build`/`typecheck`/`lint` tasks, eslint config matching repo rules —
      **no `any`/`unknown`**).
- [ ] `packages/core`: `createServerDb()` (pg Pool) + verify `DbClient` type
      compatibility (build core, typecheck API).
- [ ] Move web validators + serializers into core; web imports from `@munim/core`.
- [ ] `ConfigModule` env validation; `drizzle.provider.ts`; `/healthz` + `/readyz`.
- [ ] Auth guard (3 API keys, constant-time compare); global exception filter.
- [ ] Controllers for **products, colors, sizes, categories, sales, invoices,
      payments** (read+write, zod DTOs, core services, serializers).
- [ ] Controllers for **parties, advances, job-letters, reports, settings,
      dashboard, upload** (Cloudinary signed).
- [ ] `apps/api` e2e smoke: 401 without key, create→list happy paths.
- [ ] Typecheck + lint `apps/api`; run core smoke; web still green (validators
      now imported from core).

### Phase 2 — Upstash caching ✅
- [x] `CacheService` (`@upstash/redis` REST SDK — the planned `upstash-redis`
      store was unpublished) + `cache.keys.ts` (key builders, TTLs, invalidation
      groups).
- [x] Wire the read endpoints per §6 table; invalidate on every mutating route
      (products, dashboard, catalog, settings, reports, invoices, sales,
      parties, advances, payments, job-letters).
- [x] `/readyz` pings Upstash when configured; `.env.example` gains
      `UPSTASH_REDIS_REST_URL/TOKEN`.
- [x] Verify: `test/cache.spec.ts` (11 checks — cache-aside, null skip,
      prefix invalidation, TTL, group composition) + live-DB e2e extended to
      16 checks (repeat-read + settings write-invalidation round-trip).

### Phase 3 — `packages/api-client` ✅
- [x] Scaffold package (fetch wrapper, `fetchImpl` injection, typed endpoints,
      DTO types re-exported from core).
- [x] Unit-smoke against a running `apps/api` dev server (`test/smoke.ts` —
      stub server, 14 checks) + live-DB e2e through the real API
      (`apps/api/test/e2e-client.ts` — 17 checks).

### Phase 4 — Desktop refactor ✅
- [x] Swap `lib/core.ts` → api-client (`lib/api.ts` — Tauri fetch, base URL
      from settings); swap all 11 pages (dashboard, products, catalog, sales,
      invoices, parties, advances, job-letters, reports, billing, settings).
- [x] Settings Database → API connection (URL + key, `/readyz` test); shared
      `PinGate` onboarding is the single API-URL step (no Cloudinary); image
      upload via `api.upload` (Cloudinary). (Later cleanup removed the legacy
      `"database"` onboarding mode + Cloudinary/DB-URL storage helpers from
      `pin-gate.tsx` — dead code after all platforms moved to the API.)
- [x] **API parity fix:** shared `saleSchema` widened to mirror core `SaleInput`
      (sellingPrice/customerName/paid/etc.) so the desktop sale form works;
      sales controller passes full values through; live-DB e2e extended with a
      create → full-shape sale → undo round-trip (17 checks, net-zero on DB).
- [x] Settings round-trip fix (Phase 2 follow-on): `settingsSchema` fields now
      accept `null` → normalize to `undefined` via `.transform()` so a save
      never 400s on its own output.
- [x] Typecheck + lint desktop, desktop production build, live-DB e2e 17/17,
      web typecheck all green. (browser-act desktop flow deferred — desktop
      build verified; manual smoke on next `pnpm tauri dev`.)

### Phase 5 — Mobile refactor ✅
- [x] New `apps/mobile/src/lib/api.ts` (`getApi()` singleton + `pingApiUrl`,
      AsyncStorage-backed) replaces `lib/core.ts` (deleted); `app-config.ts`
      now stores the API URL + key (same `munim.databaseUrl`/`munim.apiKey`
      keys as web/desktop). All 11 screens swapped (home, products, sales,
      billing, invoices, parties, advances, catalog, job-letters, reports,
      settings).
- [x] Onboarding simplified to a single API-URL (+ optional key) step — no
      Cloudinary step (uploads go through `POST /api/upload`); ResetConfig
      shows the masked server URL + key; Settings “Server” section tests via
      `GET /readyz` (non-dismissible modal) and saves URL + key.
- [x] **DTO field parity:** mobile screens now consume the wire DTOs
      (`ProductDto.color/size/category` instead of `colorName/sizeName/…`;
      string dates everywhere) — no per-platform type redefinition.
- [x] api-client `upload.image` widened to accept RN file objects
      (`{uri,name,type}` — no DOM Blob on Hermes); `build-android.mjs` builds
      `@munim/api-client` before bundling.
- [x] Verify: mobile typecheck + lint clean, workspace typecheck 12/12,
      api-client smoke, core smoke 73/73, live-DB e2e + client e2e against
      Neon. (Dev-build verification deferred to the next `pnpm build:android`.)

### Phase 6 — Web refactor ✅
- [x] `apps/web/src/lib/query.tsx` resolves the shared api-client against
      `NEXT_PUBLIC_API_URL` + `NEXT_PUBLIC_API_KEY` (same-origin fallback when
      unset, so `next dev` still boots without a backend).
- [x] All Next.js `/api/*` route handlers deleted (30 files), plus the now-
      orphaned `lib/db.ts`, `lib/cloudinary.ts` and `lib/api-client.ts`.
- [x] Last direct fetches converted to the shared layer: product image upload
      → `useUploadImage` (`POST /api/upload`), Settings connection ping →
      `api.settings.get()` through `useApiClient`, barcode lookup →
      `api.products.byBarcode(code)`. Web-only `useSeedProducts` dev tool and
      its `/api/products/seed` route removed (no parity on desktop/mobile).
- [x] Verify: web typecheck + lint clean, `next build` green (only `/` +
      `/_not-found` routes remain), live-DB e2e 17/17 against the API.
- [ ] Deploy: set `NEXT_PUBLIC_API_URL` + `NEXT_PUBLIC_API_KEY` on Vercel and
      add the deployed web origin to the API's `CORS_ORIGINS`.

### Phase 7b — Shared data layer (`@munim/query` + `@munim/store`) ✅
- [x] `packages/query` — shared TanStack Query hooks over `@munim/api-client`
      (provider + keys + every resource); desktop + mobile screens use them.
- [x] `packages/store` — shared Zustand client-state factory (view/search/
      filters/sell dialog); adopted by all 3 apps.
- [x] Docs: `docs/state-management.md`, ADR-017, feature-matrix rules.

### Phase 7 — CI/CD + docs + review
- [ ] `api-deploy.yml`; secrets wiring; Render/Railway deploy.
- [ ] Update `docs/features.md` (global-rules: "no API server" → "API server";
      platform notes; row 17 Database section), `docs/ARCHITECTURE.md`
      (**ADR-001 superseded by ADR-014**, new ADR-015 API keys, ADR-016 Upstash
      caching), `AGENTS.md` rules, `PLAN.md`.
- [ ] Full `pnpm typecheck` + `pnpm lint`; desktop + mobile builds; browser-act
      smoke on web + desktop; core smoke test.
- [ ] Commit per phase (this plan is Phase 0/roadmap — commit the plan doc).

---

## 13. ADR updates (when implementing)

- **ADR-001 (no API server)** → mark **Superseded** for desktop/mobile data
  access; core stays the single brain (all 3 apps now fetch via the API).
- **ADR-014 — NestJS API server (Accepted):** Fastify adapter, pg.Pool,
  business logic 100% in `@munim/core`.
- **ADR-015 — Per-platform API keys (Accepted):** 3 static keys, build-injected
  via GitHub secrets, `x-api-key` header.
- **ADR-016 — Upstash Redis caching (Accepted):** cache-aside, explicit
  invalidation, memory fallback in dev; `node-cache` rejected (unmaintained,
  in-memory-only).

## 14. Risks & notes

- **`DbClient` type compatibility** (pg-proxy vs node-postgres drizzle) — the
  one real technical unknown; planned in Phase 1 with a structural-type fallback.
- **Offline behavior:** desktop/mobile currently work offline-ish only in the
  sense of having the DB URL; after the refactor they need the API reachable —
  same practical constraint, but the connection now needs the shop's server up.
- **Secrets in clients:** baked API keys are extractable from the desktop
  bundle/APK — acceptable for this threat model (per-platform key, rotatable);
  document in Security notes.
- **All three apps now fetch through the API** — the web build requires
  `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_API_KEY` and the server's `CORS_ORIGINS`
  to include the web origin for browser calls.
- Barcode/PDF/label logic is client-side rendering of core HTML — unaffected by
  the API move.
