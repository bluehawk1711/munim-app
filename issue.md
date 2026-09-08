# Munim Mobile App — Full Audit Report

**Date:** 2026-09-07 · **Scope:** `apps/mobile` (~10,900 LOC: 15 screens, 11 components, 18 lib modules)
**Method:** full code read of screens/components/lib, dependency & usage greps, feature-matrix cross-check
against `docs/features.md`, architecture comparison with web/desktop + `@munim/*` packages.

**Overall:** the app is in good shape. Architecture follows the monorepo rules (server-backed via
`@munim/api-client`, shared hooks in `@munim/query`, types from `@munim/core`, theme tokens via a
dynamic `colors` proxy, no `any`), the heavy lists use FlashList, and feedback (toast + haptics) is
wired on every mutation. The findings below are the remaining rough edges, ordered by severity.

Severities: 🔴 fix soon · 🟡 should fix · 🟢 nice-to-have / hygiene

---

## 1. Bugs & functional issues

| # | Sev | Finding | Where |
|---|-----|---------|-------|
| 1.1 | 🔴 | **No Error Boundary.** A render-time crash in any screen (bad server payload, chart edge case) white-screens the whole app with no recovery UI. `App.tsx` has no `componentDidCatch` / error boundary anywhere. | `App.tsx` |
| 1.2 | 🔴 | **Tab switch destroys form state.** Tabs are conditionally mounted (`{tab === 'billing' ? <BillingScreen/> : null}`) with an entering/exiting `Animated.View`. Switching away from Billing mid-invoice throws away every field the shopkeeper typed. Server data survives (react-query cache), but **local form state does not**. Fix: keep Billing (and Parties) mounted but hidden, or persist draft state to the zustand store. | `App.tsx` (AppInner) |
| 1.3 | 🟡 | **Customer name not required on mobile billing** (`customer.trim() \|\| undefined`), while desktop/web hard-require it. Server accepts empty → mobile can create invoices with no customer name, which the invoices list renders as blank rows. | `BillingScreen.tsx:548,567` |
| 1.4 | 🟡 | **`productIds` prop is dead & wrong in spirit.** `LineItemsEditor` accepts `productIds` (computed from **bill 1's** lines) and never uses it — and it's passed to the *second* bill's editor too. Either wire it (e.g. prevent double-adding a product across bills) or delete the prop. | `BillingScreen.tsx:394,809,855` |
| 1.5 | 🟡 | **Image-upload failures only hit `console.error`.** If both the direct and Cloudinary upload paths fail, the user gets no toast unless a later code path adds one — verify the catch shows `errorFeedback`; currently the evidence is console-only. | `ProductsScreen.tsx:433,438` |
| 1.6 | 🟢 | Home-header **Search button always jumps to Inventory**, even from Sales/Parties where a contextual search would be more useful. Acceptable, but consider opening a global search sheet instead. | `home-header.tsx:95` |

## 2. UI / UX findings

| # | Sev | Finding | Where |
|---|-----|---------|-------|
| 2.1 | 🔴 | **Accessibility is near-zero.** 11 of 15 screens have *zero* `accessibilityLabel`/`accessibilityRole` (Advances, Catalog, JobLetters, More, Parties, Reports, Sales, Settings, Billing, Home, Onboarding). Screen-reader users cannot operate the app; TalkBack announces raw text or nothing. The `ProductPicker`, filter chips, action buttons and sheets all need roles/labels. Products/Invoices show the pattern to copy. | all screens |
| 2.2 | 🟡 | **Add/Edit product form lives in a `ModalSheet` with many fields but no keyboard strategy.** `KeyboardForm` (a purpose-built `KeyboardAvoidingView` bottom-sheet form) exists but is **unused**; the product form instead relies on the sheet scrolling, which on Android can leave the field under focus hidden behind the keyboard. | `ProductsScreen.tsx`, `KeyboardForm.tsx` |
| 2.3 | 🟡 | **Inconsistent list primitive:** Invoices uses RN `FlatList` while Products/Parties/Advances use FlashList v2 (better recycling + perf). | `InvoicesScreen.tsx:195` |
| 2.4 | 🟡 | **Hardcoded `shadowColor: '#000'`** in 4 places — harmless visually but violates the repo's own "no hardcoded colors" rule; should come from a token (e.g. `colors.shadow`). | `theme-toggle.tsx:42`, `ui.tsx:180`, `OnboardingScreen.tsx:442`, `ResetConfigScreen.tsx:121` |
| 2.5 | 🟢 | Long lists inside sheets (product picker `FlatList maxHeight 340`) don't set `keyboardShouldPersistTaps` on Android consistently — tapping a row while the keyboard is up can require two taps. | `BillingScreen.tsx` ProductPicker |
| 2.6 | 🟢 | Reports row list renders via `ScrollView`+`map` — with a year of data (hundreds of rows) this is unvirtualized. Consider FlashList or pagination like invoices. | `ReportsScreen.tsx` |

## 3. Performance

| # | Sev | Finding | Where |
|---|-----|---------|-------|
| 3.1 | 🟡 | **Global `staleTime: 30s`** in the shared `QueryProvider`. Every screen visited >30s later refetches on mount — this is the root of the recurring "pages show loading again" complaint. Consider per-query staleTimes (catalog/settings/reports 5–10 min; dashboard 30s) or `placeholderData: keepPreviousData` for list screens so revisits paint cached data instantly. | `packages/query/src/provider.tsx` |
| 3.2 | 🟡 | **Billing screen re-renders on every keystroke.** ~12 `.map` blocks, non-memoized `Field`/line components, all state in one component. On low-end Androids typing in the discount field while 10 line items exist will feel sluggish. Memoize `Field`, `ProductPicker`, and line rows (`React.memo` + stable callbacks). | `BillingScreen.tsx` |
| 3.3 | 🟢 | `key={index}` is used for bill line items — reordering/removing a middle line re-mounts subsequent lines (state-less today so only a perf nit, but fragile if fields gain local state later). | `BillingScreen.tsx:257` |
| 3.4 | 🟢 | Home/Sales dashboards are `ScrollView`+`map` — fine today; revisit if sections grow. | `HomeScreen`, `SalesScreen` |

## 4. Architecture & code quality

**Good (worth keeping):** server-backed via shared `@munim/api-client` + `@munim/query` hooks (no direct DB — the `drizzle-orm` dep is vestigial, see 4.2); theme `colors` Proxy resolving against the active palette (dark mode + 5 accents work with zero per-screen work); `useThemeStyles(makeStyles)` pattern keeps styles theme-reactive; FlashList rows memoized; haptics centrally kill-switchable from Settings; PIN lock provider wraps the whole app.

| # | Sev | Finding | Where |
|---|-----|---------|-------|
| 4.1 | 🟡 | **`components/ui.tsx` is an 873-line god-file** (20+ exports: Screen, Card, Button, Field, Badge, ModalSheet, ThreeDotMenu, ConfirmDialog…). Split into a `components/ui/` folder (one primitive per file, re-exported from an index) — matches how `@munim/ui` is organized and eases tree-shaking/review. | `components/ui.tsx` |
| 4.2 | 🟡 | **Dead dependencies** (imported nowhere in `src/`): `drizzle-orm`, `react-native-reanimated-carousel`, `react-native-animatable`, `expo-linear-gradient`, `@react-native/new-app-screen`. Each adds install weight and (for the RN ones) potential native-link noise. Remove from `package.json`. | `package.json` |
| 4.3 | 🟡 | **Dead components:** `SheetPicker.tsx` (230 lines) and `KeyboardForm.tsx` (113 lines) are imported by nothing. Delete or put KeyboardForm to use (see 2.2). | `src/components/` |
| 4.4 | 🟡 | **Local business-logic duplicates core** (repo rule: logic lives once in core): ₹ formatter re-implemented in `ProductsScreen.tsx:89` and `quick-sale-sheet.tsx:26` instead of `lib/format.ts`'s `money`; `home-header.tsx:106` uses `toLocaleDateString('en-IN')` instead of core `formatDate`. | 3 files |
| 4.5 | 🟢 | Type discipline is respected (no `any`). The one sanctioned-pattern exception in `lib/cloudinary.ts:41-43` (`fd.append` cast for the RN FormData boundary) has no eslint-disable/justification comment — add one per the AGENTS.md rule. | `lib/cloudinary.ts` |
| 4.6 | 🟢 | **Zero tests.** `jest.config.js` exists, `pnpm test` runs, but there is not a single `*.test.*` file. Even a smoke suite (formatters, `getStockStatus`, bill-total math in BillingScreen) would protect the highest-churn logic. | repo |
| 4.7 | 🟢 | `ThreeDotMenu` in `ui.tsx` renders a portal-less overlay — earlier bugs ("menu behind card") came from this class of absolute-positioned menu; a `Modal`-based or portal menu would make recurrence impossible. | `ui.tsx:742` |

## 5. Feature-parity & docs accuracy (vs `docs/features.md`)

| # | Sev | Finding |
|---|-----|---------|
| 5.1 | 🟡 | **Row 15 overstates mobile export.** Matrix says Report export ✅ on mobile, but mobile only offers **Share CSV** — no Excel/PDF export path (the PDF button web/desktop have doesn't exist on mobile; the row's fine-print even says "mobile reports export = Share CSV"). Mark mobile 🟡 or add the feature. |
| 5.2 | 🟢 | Row 22 (label printing) is legit on mobile (sheet-based preview + share). Row 5/10/24 verified ✅. |
| 5.3 | 🟢 | The shared product-selector rollout (this session) is **incomplete**: web `billing-view` + desktop `billing`/`sales` now use the shared `ProductSearchSelect`, but **web's `sell-product-dialog.tsx` still uses its own inline search list** (and the shared component doesn't render product thumbnails yet, which that dialog shows). Finish: add `imageUrl` thumbnail support to `ProductSearchSelect`, then swap the dialog. |
| 5.4 | 🟢 | Desktop/web deferred task still open: derive `apps/web/src/lib/types.ts` local mirrors from `@munim/core` (user parked this). |

## 6. Suggested priority order

1. **1.1** Error boundary (small, prevents white-screens)
2. **1.2** Keep Billing mounted across tab switches (data-loss bug)
3. **2.1** Accessibility pass (roles/labels on interactive elements)
4. **3.1** staleTime tuning per query family
5. **4.2/4.3** Delete dead deps + dead components
6. **1.3/1.4** Billing validation parity + dead prop cleanup
7. **4.1** Split `ui.tsx`; **4.4** route formatting through core
8. **5.3** Finish the product-selector rollout (thumbnails + sell dialog)
9. **4.6** Smoke tests for formatters + bill math
10. **3.2** Memoize billing fields/rows

---

*Items verified clean during audit: no `any`/`unknown` outside the documented Cloudinary boundary; no direct DB access; PIN lock + onboarding + reset flows present; theme toggle + 5 accents + dark mode work through one proxy; FlashList used on the three data-heavy lists; toast+haptics on every mutation path (Products 16, Settings 19, Billing 10 call-sites).*

---

# Project-Wide Caching & Speed Audit

**Date:** 2026-09-07 · **Scope:** `@munim/query` (client cache), `apps/api` (server cache + DB),
web, desktop, mobile data layers · Same severity legend as above.

## What's already right (verified)

- **Three coherent cache tiers:** client react-query (`staleTime 30s`, `retry 1`, focus-refetch off) →
  server **cache-aside over Upstash Redis** with an in-process TTL fallback (fail-open reads, namespaced
  keys, TTL tiers: dashboard 30s / lists 120s / reports 120s / detail 300s / static 300s) → **Postgres with a
  genuinely complete index set** (products name/barcode/FKs, invoices party/date/status, movements
  product/created, payments party/invoice/date…).
- **Client keys and server cache groups mirror each other by design** (`packages/query/src/keys.ts` ↔
  `apps/api/src/common/cache.keys.ts`), and mutations invalidate both sides in agreement.
- `placeholderData: (previous) => previous` on the products + invoices lists — page/filter changes
  repaint cached rows instead of flashing skeletons (both apps).
- **No N+1 anywhere I looked:** invoice list batch-fetches items via one `inArray` query; dashboard runs
  its ~10 aggregate scans in `Promise.all` as pure SQL; party balances are aggregated, not looped.
- API: Fastify + `@fastify/compress` (≥1 KB), helmet, hard `pageSize` caps (products ≤ 1000, invoices ≤ 200).
- Web lazy-loads all chart components (`next/dynamic`, `ssr:false`) so recharts stays out of first paint.
- Server cache is **fail-open** — a Redis outage degrades to direct DB hits, never errors the request.

## Findings

### Cache correctness

| # | Sev | Finding | Fix |
|---|-----|---------|-----|
| C1 | 🔴 | **Stock-changing writes don't invalidate the server `products` cache.** `sales.controller` (create/undo) and `invoices.controller` (create/delete) call `invalidate(["invoices"])` only — and the `invoices` group does **not** include `products`. Product stock lives in the cached `products:list` / `stats` / `by-category` payloads with a **300s (static) TTL**, so after every quick sale or bill, the server serves **stale stock for up to 5 minutes** — even though clients faithfully invalidate their own react-query cache and refetch, they just get the stale server copy back. Consequences: picker rows show outdated stock, inventory page shows outdated counts, stock alerts lag. | Add `"products"` to the `invoices` group in `CACHE_GROUPS` (or invalidate `["invoices","products"]` in the sales/invoices write paths). One-line fix, test with two clients. |
| C2 | 🟡 | `productsList` is cached under `CACHE_TTL.static` (300s) — the longest tier — despite being the most stock-volatile list. Even after C1's fix, use the `lists` (120s) tier for defense-in-depth. | `products.controller.ts:66` |
| C3 | 🟡 | **Global `staleTime: 30s`** for every query in every app — the root of the recurring "pages load again on revisit" complaint, and wasteful for near-static data (catalog, settings, product meta). | Per-query `staleTime`: catalog/settings/meta 5–10 min; dashboard keep 30s; lists 60s. Set in the shared hooks so all 3 apps inherit. |
| C4 | 🟢 | Client key prefixes and server cache groups are **hand-synced** in two files (documented, but drift-prone — exactly how C1 happened). Move `CACHE_GROUPS` into `@munim/core` (or a tiny shared package) so the invalidation contract has one source of truth. | refactor |
| C5 | 🟢 | `CacheService` falls back to an **in-process TTL map when Upstash env vars are absent** — fine for dev, silently wrong for multi-replica production. Ensure the deploy env sets `UPSTASH_REDIS_REST_URL/TOKEN` (the startup warn log is easy to miss). | deploy check |

### Speed

| # | Sev | Finding | Fix |
|---|-----|---------|-----|
| S1 | 🟡 | **Full-catalog fetches for client-side search pickers:** 8 call sites fetch `pageSize: 500–1000` products on mount (`billing` ×3, `sales`, `dashboard`, `catalog`, web sell dialog, mobile billing/products). Works today; payload + JSON parse cost grows linearly with SKU count, and it happens on *every* bill open past staleTime. | Server already supports `search` + `status` filters — debounced server search with `placeholderData` (pageSize 25) for pickers, or a slim picker DTO (`id, name, sku, price, stock, imageUrl`) to cut ~80% of the payload. |
| S2 | 🟡 | **Invoice list rows select ALL columns** including `template_settings` and `shop_details` JSON blobs (`db.select().from(schema.invoices)` in `listInvoices`) — that's per-row bloat in API responses **and in the Redis cache**, ×20–200 rows/page. | Project the list columns only (id, invoiceNumber, customer*, date, status, totals, partyId); keep full JSON for the detail endpoint. |
| S3 | 🟡 | **Desktop ships one bundle:** all 11 pages are statically imported in `App.tsx`, so recharts + bklit charts + jsPDF + every page are in the initial load (Tauri mitigates cold-start, but HMR/updates are heavy). | `React.lazy()` per page + `Suspense` skeleton (the shared PageHeader already provides a shell). |
| S4 | 🟡 | **Mobile has no foreground refetch.** `refetchOnWindowFocus:false` is web/desktop semantics; on RN nothing listens to `AppState`, so data goes stale while the app sits open until the user remounts a screen past staleTime. | Wire `AppState.addEventListener` → `queryClient.refetchQueries({ type: 'active', stale: true })` on `active` in `MobileQueryProvider`. |
| S5 | 🟢 | Dashboard stock/low-stock report: `rows.find(...)` inside a `map` over all products is O(products × rows) in JS (`dashboard.ts:~384`) — build a `Map<productId, row>` like the code already does for `productById`. | one-liner |
| S6 | 🟢 | `ilike '%term%'` searches (invoices, products, parties) can't use the btree indexes — full scans. Fine at current scale; add `pg_trgm` GIN indexes if search latency grows. | future |
| S7 | 🟢 | Mobile billing re-renders the whole screen per keystroke (see mobile audit 3.2) and keeps `pageSize: 500` catalog in memory — overlaps with S1. | memoize fields/rows |

### Priority order

1. **C1** — stale-stock cache bug (one-line, correctness)
2. **C3 + S4** — per-query staleTime + mobile foreground refetch (kills the "loading again" UX)
3. **S2** — slim invoice list payload (also shrinks Redis entries)
4. **S1** — server-side product search for pickers
5. **S3** — desktop route-level code splitting
6. **C2, C4, C5, S5–S7** — hygiene
