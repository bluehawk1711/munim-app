# Munim — Shared State Management & Caching

> Decision record for how all three apps (web, desktop, mobile) fetch, cache and
> share data. This is the **single API-calling layer**: one set of hooks, one
> cache model, three platforms. Companion to `docs/ARCHITECTURE.md` (ADR-017)
> and `docs/nestjs-backend.md`.

## The problem

Every screen calls the API. Before this layer, each platform did it slightly
differently:

- **Web** used TanStack Query hooks (`apps/web/src/hooks/*`) against its own
  Next.js `/api/*` routes with a raw `apiFetch` wrapper, plus a local Zustand
  store (`apps/web/src/store/view-store.ts`) for UI state.
- **Desktop** called the typed `@munim/api-client` per screen via a `useAsync`
  helper — no caching, every mount refetched.
- **Mobile** did the same with its own `useAsync`.

The result: the *same* API-calling logic existed in three places, and desktop +
mobile had zero caching (every tab switch refetched, no dedup, no background
refresh).

## The decision — TanStack Query + Zustand (not Redux)

| Option | Verdict |
|---|---|
| **Redux Toolkit** | ❌ Rejected — boilerplate (providers, slices, thunks/RTK-query codegen), heavier bundle, and no caching win over the alternatives. Would wrap the api-client in another layer instead of calling it directly. |
| **Hand-rolled Zustand cache** | ❌ Rejected — we would have rebuilt staleTime, dedup, retries, background refetch and garbage collection ourselves. |
| **TanStack Query (server state) + Zustand (client state)** | ✅ **Chosen** — TanStack Query is the best-in-class async-cache for React *and* React Native (identical API on both), and web already shipped it (`@tanstack/react-query` + `zustand` in `apps/web`). Desktop + mobile adopt the exact same libraries, so one mental model + one codebase. |

Zustand is kept for **ephemeral client state** (active view/tab, global search,
cross-view product filters, sell dialog) — exactly what web's `view-store`
already used it for. TanStack Query owns all **server state** (reads cached +
invalidated, writes go through mutations that invalidate).

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│  packages/query  (@munim/query)                               │
│  Shared TanStack Query hooks — the ONE API-calling layer:     │
│    useDashboard, useProducts, useInvoices, useSales,          │
│    useParties, useAdvances, useCatalog, useJobLetters,        │
│    useReports, useSettings, + every mutation hook             │
│  All queryFns call the typed @munim/api-client endpoints.     │
└───────────────┬───────────────────────────────────────────────┘
                │  useApiClient() — the configured client from context
┌───────────────▼───────────────────────────────────────────────┐
│  packages/store  (@munim/store)                               │
│  createAppStore() — Zustand factory for CLIENT state:         │
│    activeView, globalSearch, productColor/Size/Category/      │
│    Status filters, sellDialogOpen                              │
└───────────────┬───────────────────────────────────────────────┘
                │
   ┌────────────┼────────────────┐
   ▼            ▼                ▼
 apps/web    apps/desktop    apps/mobile
```

- **`QueryProvider`** (`@munim/query`) wraps each app root. It receives a
  `getClient` function — **the API key/base-URL resolution is a function
  parameter**, so the shared hooks never know where the key lives:
  - web: `() => apiClientFromEnv` (`lib/query.tsx` resolves
    `NEXT_PUBLIC_API_URL` + `NEXT_PUBLIC_API_KEY`, same-origin fallback)
  - desktop: `() => getApi()` (`lib/api.ts`, Tauri fetch + saved URL/key)
  - mobile: `() => getApi()` (`lib/api.ts`, AsyncStorage URL/key + global fetch)
- Hooks `await` the client inside `queryFn`, so mobile's async `getApi()` works
  unchanged.
- **Query keys** are the shared cache contract (`packages/query/src/keys.ts`):
  `["dashboard"]`, `["products","list",filters]`, `["parties","balances"]`,
  `["settings"]`, `["catalog",kind]`, … Mutations invalidate the same groups
  the API's Upstash cache does (products write → products + dashboard, etc.).
- `QueryClient` defaults: `staleTime: 30s`, `retry: 1`,
  `refetchOnWindowFocus: false` (mobile has no window focus concept; desktop
  keeps it off to avoid surprise refetches).

## Why "API key via function param" works

The shared hooks never read env vars or storage. Each platform builds its
`ApiClient` once (`createApiClient({ baseUrl, apiKey, fetchImpl })`) in its own
`lib/api.ts` and hands it to `QueryProvider` as `getClient`. If a screen needs a
*different* connection (Settings test, onboarding), it constructs a throwaway
client directly — the shared data layer stays untouched.

## Adoption status

| Platform | Data hooks (`@munim/query`) | Client store (`@munim/store`) |
|---|---|---|
| **Web** | ✅ Adopted — `apps/web/src/hooks/*` re-export `@munim/query`; provider resolves the API from env; Next `/api/*` routes deleted (Phase 6) | ✅ Adopted — `store/view-store.ts` re-exports a shared-store instance |
| **Desktop** | ✅ Adopted — all 11 pages use `@munim/query` hooks | ✅ Adopted — active view lives in the shared store |
| **Mobile** | ✅ Adopted — all 11 screens use `@munim/query` hooks | ✅ Adopted — active tab lives in the shared store |

## Rules for future work (append to AGENTS.md / PLAN.md)

1. **Never call the api-client directly from a screen** for reads or writes —
   use the shared `@munim/query` hooks so caching + invalidation always apply.
2. **Client-only state** (view/tab, search, filters, dialog toggles) goes in
   `@munim/store`, never in local `useState` that other screens need.
3. **New endpoints** land in `@munim/api-client` first, then get a hook in
   `@munim/query` with query keys + invalidation groups mirroring the API's
   `cache.keys.ts`.
4. **Types** come from `@munim/core` (DTOs) — never redefined in hooks.
