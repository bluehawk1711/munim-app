# Munim — NestJS Backend Plan

> Status: **Phase 1 landed (2026-08-17)** — `apps/api` scaffolded (Fastify,
> pg.Pool client, API-key guard, health checks, boot + live-DB e2e smoke) and
> core prep done (`createServerDb` via `@munim/core/server`, validators +
> serializers moved into core). **All controllers are implemented:** products,
> dashboard, settings, catalog, invoices (+ record payment), sales, parties
> (+ ledger/balances), advances (+ payments), job-letters, reports (JSON +
> CSV) and upload (Cloudinary signed). Remaining phases: 2 (Upstash caching)
> → 3 (`api-client`) → 4 (desktop) → 5 (mobile) → 6 (web) → 7 (CI/CD + docs).
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
| Caching | **Upstash Redis** via `@nestjs/cache-manager` (v6) + `upstash-redis` cache-manager store; in-memory fallback for local dev |
| Deploy | **Render or Railway** (container, long-running Node) — Node 24, same as CI |
| Order | Desktop + mobile first (this plan), **web later** (Phase 6) |
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

## 6. Caching — Upstash Redis

**Library choice:** `node-cache` is effectively abandoned (in-memory only,
unmaintained). The modern NestJS stack is **`@nestjs/cache-manager`** (v6, the
replacement for the deprecated `CacheModule`) + **`cache-manager` v6** +
**`upstash-redis`** (its SDK ships a cache-manager-compatible store). Dev
fallback: `cache-manager`'s built-in memory store when
`UPSTASH_REDIS_REST_URL` is unset — so local dev needs no Redis.

**What gets cached (read-heavy, safe):**

| Cache key | TTL | Invalidation trigger |
|---|---|---|
| `dashboard` | 30 s | any write (product/invoice/sale/advance/payment/settings) |
| `reports:{type}:{from}:{to}` | 60 s | writes touching invoices/payments |
| `catalog:{kind}` (colors/sizes/categories) | 10 min | create/rename/delete catalog item |
| `products:list:{hash(filters,page)}` | 30 s | product create/update/delete/adjust |
| `products:byBarcode:{barcode}` | 5 min | product update/delete |
| `parties:list:{hash(filters)}` | 30 s | party create/update/delete |
| `settings` | 60 s | `PUT /api/settings` |

**Rules:**
- **Cache-aside only** (never write-through): `cache.service.ts` wraps a read;
  every mutating controller calls `invalidate(keyPattern)` — explicit
  invalidation, never pure TTL trust for money data.
- **Never cache** single invoice/advance/ledger reads unless keyed precisely;
  financial *totals* come from `getReport`/`getDashboard` which are invalidated
  on writes.
- Invalidation uses Upstash `del` with a key-prefix scan (`dashboard*`,
  `reports:*`) — a small `keys()`/`scan` helper in `cache.service.ts`.

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

## 10. Web refactor (Phase 6 — later, kept out of this build)

Replace the Next.js `/api/*` server routes with direct calls to the NestJS API
(web sends its own `x-api-key`; same origin or CORS-enabled). Next.js stays the
renderer; `lib/db.ts` proxy goes away. Validators/serializers already moved to
core in Phase 1, so the swap is thin. Until then **web keeps running on direct
Neon** — a live fallback while desktop/mobile are migrated.

---

## 11. CI/CD & secrets

- **Secrets (GitHub):** `API_KEY_WEB`, `API_KEY_DESKTOP`, `API_KEY_MOBILE`
  (user generates 3 keys), `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`,
  `RENDER_API_KEY`/`RAILWAY_TOKEN` (deploy), existing `DATABASE_URL`.
- **New workflow `api-deploy.yml`:** on push to main → build `apps/api` →
  run `drizzle-kit migrate` (existing `db-migrate` flow) → deploy to
  Render/Railway with the API keys + Upstash + DB URL as env vars.
- **Desktop build (`desktop-build.yml`):** add `VITE_API_URL` +
  `VITE_API_KEY` (from `API_KEY_DESKTOP` secret) to the `pnpm build` env.
- **Mobile build (`mobile-build.yml`):** add `EXPO_PUBLIC_API_URL` +
  `EXPO_PUBLIC_API_KEY` (from `API_KEY_MOBILE` secret).
- **Web build:** add `API_KEY_WEB` to Vercel env (used in Phase 6).

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

### Phase 2 — Upstash caching
- [ ] `CacheModule` (upstash store; memory fallback in dev).
- [ ] `cache.service.ts` (get/set/invalidate + prefix scan); wire the read
      endpoints per §6 table; invalidate on every mutating route.
- [ ] Verify: repeated `GET /api/dashboard` hits Upstash (log/hit-miss header);
      a write invalidates.

### Phase 3 — `packages/api-client`
- [ ] Scaffold package (fetch wrapper, `fetchImpl` injection, typed endpoints,
      DTO types re-exported from core).
- [ ] Unit-smoke against a running `apps/api` dev server.

### Phase 4 — Desktop refactor
- [ ] Swap `lib/core.ts` → api-client; swap all 11 pages.
- [ ] Settings Database → API connection; onboarding simplification; image
      upload via `/api/upload`.
- [ ] Typecheck + lint desktop; **browser-act verify** the full desktop flow
      (dashboard → create invoice → PDF still works) against the API.

### Phase 5 — Mobile refactor
- [ ] Swap `lib/core.ts` → api-client; swap all 11 screens.
- [ ] Settings/onboarding simplification; remove AsyncStorage Neon URL.
- [ ] Typecheck + lint mobile; run a dev build; verify a screen end-to-end.

### Phase 6 — Web refactor (later, separate PR)
- [ ] Swap Next.js `/api/*` routes for api-client calls; remove `lib/db.ts`.
- [ ] Vercel env `API_KEY_WEB`; verify.

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
  access; note web remains direct until Phase 6; core stays the single brain.
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
- **Web stays on direct Neon** until Phase 6 — no regression window.
- Barcode/PDF/label logic is client-side rendering of core HTML — unaffected by
  the API move.
