# React Doctor — Cleanup Checklist

> Tracked from `pnpm doctor` (react-doctor) runs in each app. Baseline scores as of
> **2026-08-16** (commit `e6ac0ef`): **web 50/100 · desktop 42/100 · mobile 59/100**.
> The 🔴 bug-category items were all fixed in the same session (now committed); the
> scores below the fold reflect the remaining 🟡/🟠 items. No app currently has
> *actionable* errors (see the two false positives below).

This is a living checklist — tick items off as they're fixed. Each row links the
rule name (so you can look it up in react-doctor's docs) and the exact
file:line where it fires.

---

## Baseline summary

| App    | Score | Errors | Warnings | Notable false positives |
| ------ | ----- | ------ | -------- | ----------------------- |
| web    | 50    | 0      | 57       | —                       |
| desktop| 42    | 1      | 26       | artifact-env-leak (drizzle bundle) |
| mobile | 59    | 0      | 90       | —                       |

## How to run

```bash
pnpm --filter @munim/web doctor      # or: cd apps/web && pnpm doctor
pnpm --filter @munim/desktop doctor
pnpm --filter @munim/mobile doctor
```

---

## ✅ Already fixed (for reference)

- **Desktop `artifact-env-leak` (error, src)** — error message literal
  `VITE_DATABASE_URL` removed from `apps/desktop/src/lib/core.ts`. **Still
  flagged on `dist/`** because drizzle-orm's own bundled URL-parsing regex and
  the Settings placeholder contain `postgresql://` — verified no real
  credential is inlined; inherent false positive, ignore.
- **Desktop `deslop/unused-dependency` (4)** — removed `drizzle-orm`,
  `next-themes`, `class-variance-authority` from `apps/desktop/package.json`.
  (`tailwindcss` kept — used via `@import "tailwindcss"` + Vite plugin;
  depcheck misses CSS usage.)
- **Web `deslop/unused-file` (3)** — deleted `apps/web/src/lib/activity.ts`,
  `lookups.ts`, `sku.ts`.
- **Web `no-fetch-response-used-without-status-check` (1/2)** — product image
  upload in `product-form-dialog.tsx` now checks `res.ok` before reading body.
- **Mobile `no-loading-flag-reset-outside-finally` (4)** — PIN handlers in
  `SettingsScreen.tsx` now reset `pinBusy` in `finally`.
- **Mobile `rn-no-renderitem-key` (1)** — removed redundant `key` from the
  Card inside `InvoicesScreen.tsx` `renderItem`.
- **Reports duplicate-key error** — core `getReport` merges renamed-product
  rows by `productId`; web table uses a composite key.

---

## 🔴 High-value (bugs / correctness)

### Web
- [x] **`no-fetch-response-used-without-status-check`** — `apps/web/src/lib/api-client.ts:21`
  `apiFetch` now checks `!res.ok` immediately after fetch, throws with the
  parsed error body, and only then reads the success body.
- [x] **`no-unguarded-throwing-parse-call`** — `apps/web/src/app/layout.tsx:45`
  `new URL(appUrl)` is now wrapped in try/catch into a guarded `appUrlBase`
  used by `metadataBase`.
- [x] **`server-sequential-independent-await`** — `apps/web/src/app/api/dashboard/route.ts:12`
  `getDashboard` + `getPartyBalances` now run via `Promise.all`.
- [x] **`zod-v4-prefer-top-level-string-formats`** — `apps/web/src/app/api/parties/route.ts:38`
  `z.string().email(...)` → `z.email(...)` (v4 top-level format).

### Desktop
- [x] **`context-provider-value-from-unmemoized-local-literal`** — `apps/desktop/src/components/theme-provider.tsx:69`
  context value memoized with `useMemo` + `useCallback`; the storage listener
  now calls the state setter directly.
- [x] **`rerender-state-only-in-handlers`** — `apps/desktop/src/pages/settings.tsx:55`
  the one-time form-population guard `loaded` is now a `useRef`.
- [x] **`rerender-lazy-state-init`** — `apps/desktop/src/pages/settings.tsx:57`
  `dbUrl` now uses a lazy initializer `useState(() => getSavedDatabaseUrl() ?? "")`.

### Mobile
- [x] **`server-sequential-independent-await`** — `apps/mobile/src/lib/pin.ts:115`
  `verifyCredentials` reads EMAIL_KEY + PASSWORD_KEY via `Promise.all`.
- [x] **`rerender-state-only-in-handlers`** — `apps/mobile/src/screens/ProductsScreen.tsx:95`
  the scan re-entry guard `scanning` is now a `useRef`.

---

## 🟡 Performance

### Web
- [x] **`prefer-dynamic-import` (2)** — recharts is **already lazy-loaded**: the
  dashboard imports every chart via `dynamic(() => import("@/components/charts"),
  { ssr: false })`, and `ui/chart.tsx` is only imported by that module. The
  react-doctor warning is a **false positive** (the rule only sees the static
  recharts import inside the module, not the dynamic boundary around it).
- [x] **`use-lazy-motion` (5)** — `app-shell.tsx`, `app-topbar.tsx`,
  `shared.tsx`, `stat-card.tsx`, `settings-view.tsx` converted to the
  `LazyMotion` code-split: `AppShell` wraps the tree in
  `<LazyMotion features={domMax}>`, components use `m` from
  `motion/react-m` (hooks stay on `motion/react`). Verified in-browser —
  view transitions + charts animate normally.
- [x] **`nextjs-no-img-element` (4)** — `product-form-dialog.tsx`,
  `products-table.tsx`, `sell-product-dialog.tsx` (×2) now use `next/image`;
  `next.config.ts` added Cloudinary `remotePatterns` for `res.cloudinary.com`.

### Desktop
- [x] **`use-lazy-motion` (4)** — `App.tsx`, `app-shell.tsx`, `sidebar.tsx`,
  `dashboard.tsx` converted to `LazyMotion` + `m` from `motion/react-m`;
  `App` wraps the tree in `<LazyMotion features={domMax}>` (needed for
  `whileHover` gestures + the sidebar `layoutId`).
- [ ] **`no-transition-all`** — `apps/desktop/src/pages/dashboard.tsx:32` —
  `transition: all` animates everything; scope it to `transition-property`.

### Mobile
- [ ] **`rn-prefer-expo-image`** — `apps/mobile/src/screens/ProductsScreen.tsx:4`
  uses RN `Image` for product thumbnails; `expo-image` is better (caching,
  placeholders). ⚠️ **Needs a new dev build** — adds a native module, so
  batch it with the next native-library change (mobile build is manual-only).
- [ ] **`rn-no-legacy-shadow-styles`** — `apps/mobile/src/components/theme-toggle.tsx:36`
  — use the new `boxShadow` style instead of legacy `shadow*` props.

---

## 🟠 Maintainability

### Web
- [ ] **`deslop/unused-dependency` (11)** — radix packages + `drizzle-orm` +
  `class-variance-authority` + `@tailwindcss/postcss` + `tw-animate-css` in
  `apps/web/package.json` are no longer imported by web source — they moved
  to `@munim/ui` / `@munim/core`. Verify each against
  `depcheck --ignores='@types/*,tailwindcss,next'` and prune (keep any used
  transitively by config files).
- [ ] **`deslop/unused-export` (10)** — `shared.tsx:94,134,141`,
  `theme-picker.tsx:9`, `use-invoices.ts:28`, `use-parties.ts:56,80,101`,
  `lib/billing/types.ts:12`, `lib/format.ts:33` — remove or mark `@internal`.
- [ ] **`no-giant-component` (5)** — `product-form-dialog.tsx:29`,
  `sell-product-dialog.tsx:38`, `billing-view.tsx:45`, `products-view.tsx:40`,
  `settings-view.tsx:62` — split into subcomponents.
- [ ] **`no-adjust-state-on-prop-change` (2)** — `product-form-dialog.tsx:68,69`
  — the `useEffect` reset on `open`/`product` change; prefer `key`-based
  remount or derive state.
- [ ] **`prefer-useReducer`** — `billing-view.tsx:45` — many related
  `useState` calls; group into a reducer.
- [ ] **`js-combine-iterations` (2)** — `billing-view.tsx:224,242` — chained
  `.map`/`.filter` over the same array; combine into one pass.
- [ ] **`no-array-index-as-key`** — `billing-view.tsx:626` — use a stable id.
- [ ] **`no-transition-all`** — `sidebar-nav.tsx:105` — scope the transition.
- [ ] **`no-placeholder-only-field`** — `billing-view.tsx:490` — add a visible
  label/aria-label.
- [ ] **`dangerous-html-sink`** — `lib/label-pdf.ts:23` — innerHTML with
  dynamic product data; escape or use a sanitizer (only if data is
  user-entered).
- [ ] **`control-has-associated-label` (5)** — `job-letter-view.tsx:177,183,230,238,245`
  — add labels/aria-labels.
- [ ] **`no-async-event-handler-without-reentry-guard`** — `parties-view.tsx:297`
  — guard against double-submit while the handler is running.

### Desktop
- [ ] **`deslop/unused-dependency` (1)** — the remaining flag is `tailwindcss`
  + `prettier-plugin-tailwindcss` — **both false positives** (depcheck misses
  `@import "tailwindcss"` in CSS and the `.prettierrc` plugins array).
  Nothing to remove in the desktop app.
- [ ] **`deslop/unused-file`** — `apps/desktop/src/lib/dates.ts` — delete or
  wire up (mobile has the same file, see below).
- [ ] **`deslop/unused-export`** — `theme-swatches.tsx:8`.
- [ ] **`no-giant-component` (3)** — `billing.tsx:108`, `parties.tsx:36`,
  `products.tsx:63`.
- [ ] **`prefer-useReducer` (3)** — `billing.tsx:108`, `parties.tsx:36`,
  `settings.tsx:41`.
- [ ] **`prefer-module-scope-pure-function`** — `billing.tsx:187`.
- [ ] **`js-combine-iterations` (2)** — `billing.tsx:188`, `parties.tsx:359`.
- [ ] **`no-array-index-as-key` (3)** — `billing.tsx:496,511,692`.
- [ ] **`dangerous-html-sink`** — `lib/labelPdf.ts:23` (same as web).
- [ ] **`prefer-use-sync-external-store`** — `lib/navigation.ts:12` — hand-rolled
  store subscription; use `useSyncExternalStore`.
- [ ] **`public-env-secret-name`** — `lib/env.ts:9` — `VITE_DATABASE_URL` looks
  secret-ish; rename to a non-secret-sounding name (e.g. `VITE_NEON_DATABASE_URL`)
  or document that it's a public build-time default.

### Mobile
- [ ] **`deslop/unused-dependency` (1)** — `@react-native/new-app-screen` in
  `apps/mobile/package.json` (leftover from the RN template; delete it). The
  other depcheck hits (`@babel/*`, `@react-native-community/cli*`,
  `@react-native/codegen`/`gradle-plugin`/`metro-config`, `react-test-renderer`)
  are used by the build tooling and tests — keep.
- [ ] **`deslop/unused-file`** — `apps/mobile/src/lib/dates.ts` (duplicate of
  the desktop one) — delete.
- [ ] **`deslop/unused-export` (2)** — `apps/mobile/src/lib/format.ts:7`.
- [ ] **`only-export-components` (3)** — `components/date-field.tsx:33`,
  `components/ui.tsx:31`, `theme.tsx:39` — non-component exports in component
  files; split them out.
- [ ] **`no-giant-component` (4)** — `AdvancesScreen.tsx:50`,
  `BillingScreen.tsx:180`, `ProductsScreen.tsx:74`, `SettingsScreen.tsx:24`.
- [ ] **`prefer-useReducer` (3)** — `BillingScreen.tsx:180`,
  `ProductsScreen.tsx:74`, `SettingsScreen.tsx:24`.
- [ ] **`prefer-module-scope-pure-function` (2)** — `BillingScreen.tsx:243`,
  `InvoicesScreen.tsx:149`.
- [ ] **`js-combine-iterations` (2)** — `BillingScreen.tsx:244`,
  `PartiesScreen.tsx:65`.
- [ ] **`no-array-index-as-key` (5)** — `BillingScreen.tsx:148`,
  `PinLockScreen.tsx:256,260,271`, `ReportsScreen.tsx:120`.
- [ ] **`rn-no-inline-flatlist-renderitem` (7)** — `AdvancesScreen.tsx:375`,
  `BillingScreen.tsx:106`, `InvoicesScreen.tsx:222`, `JobLettersScreen.tsx:107`,
  `PartiesScreen.tsx:175`, `ProductsScreen.tsx:395`, `SalesScreen.tsx:145` —
  hoist `renderItem` out of the component (or memoize).
- [ ] **`rn-list-callback-per-row` (17)** — inline handlers in every screen's
  `renderItem` (AdvancesScreen 1, BillingScreen 1, InvoicesScreen 2,
  JobLettersScreen 2, PartiesScreen 8, ProductsScreen 4, SalesScreen 1) —
  hoist to named functions.
- [ ] **`rn-no-inline-object-in-list-item` (39)** — inline style/object literals
  in list items across all screens — extract to memoized components or styles.

---

## ⚪ Won't-fix / accepted

- **Desktop `artifact-env-leak` on `dist/`** — drizzle-orm bundles its own
  `postgresql://` URL-parsing regex; no credential is inlined. False positive.
- **Web `public-env-secret-name`** — only if you keep `VITE_DATABASE_URL`;
  the desktop app reads the URL from Settings at runtime, the build-time value
  is a convenience default. Rename if you want a clean scan (see above).
- **Mobile list-perf trio** (inline `renderItem` / callbacks / objects) —
  ~63 warnings. Worth fixing for large lists, but low urgency for a shop's
  typical invoice/party list sizes; group with the next mobile refactor pass.

---

## Suggested order of attack

1. **Bugs (🔴)** — cheapest wins, real correctness: web `api-client.ts`,
   layout parse, `Promise.all` awaits; desktop theme-provider memo.
2. **Dead code (🟠 depcheck/unused)** — prune ~12 deps and ~14 exports/files
   across apps; zero risk, removes noise from every future scan.
3. **Perf (🟡)** — DONE: recharts already lazy (verified false positive); motion converted to `LazyMotion` + `m` on web + desktop; product images now `next/image`. Remaining: desktop `no-transition-all`, mobile `expo-image` + shadow styles.
4. **Maintainability (🟠)** — giant-component splits and `useReducer` groups.
5. **Mobile list perf** — dedicated pass; batch `expo-image` with the next
   native-module change (needs a dev build).
