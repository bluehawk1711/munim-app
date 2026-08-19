# Munim Desktop Fixes Plan

## Issue 1: Invoice Print Template Mismatch

**Root cause**: Web has rich jsPDF drawing templates (805 lines, ornate borders, watermarks, gold accents). Desktop uses plain HTML from `@munim/core` rasterized via html2canvas. They look completely different.

**Fix**: Move `generateBillPDF()` from `apps/web/src/lib/billing/generatePDF.ts` into `packages/core/src/billing/generatePDF.ts`. Both web and desktop import from `@munim/core`.

### Files
- `packages/core/src/billing/generatePDF.ts` — new file (moved from web)
- `packages/core/src/billing/index.ts` — re-export `generateBillPDF`
- `apps/web/src/lib/billing/generatePDF.ts` — delete (replaced by core import)
- `apps/web/src/views/billing-view.tsx` — update import
- `apps/desktop/src/lib/billPdf.ts` — rewrite to use `generateBillPDF` from core
- `apps/desktop/src/pages/billing.tsx` — update import

---

## Issue 2: Desktop Forms/Dialogs Missing Loading States

### HIGH priority (no loading/disabled state at all)

| # | Page | Dialog/Form | Line | Fix |
|---|------|------------|------|-----|
| 1 | `parties.tsx` | Add Party | 396 | Add `saving` state + `disabled` + `Loader2` spinner |
| 2 | `products.tsx` | Adjust Stock | 566 | Add `adjusting` state + `disabled` + `Loader2` spinner |
| 3 | `billing.tsx` | Record Payment | 620 | Add `saving` state + `disabled` + `Loader2` spinner |
| 4 | `settings.tsx` | Shop Profile save | 227 | Add `saving` state + `disabled` + `Loader2` spinner |
| 5 | `invoices.tsx` | Delete Invoice | 232 | Wire `setSaving(true/false)` in `confirmDelete()` |

### MEDIUM/LOW priority (missing spinner icons)

| # | Page | Button | Fix |
|---|------|--------|-----|
| 6 | `parties.tsx` | Delete Party | Add `Loader2` + "Deleting..." text |
| 7 | `settings.tsx` | Save & Reconnect | Add `saving` state + `disabled` |
| 8 | `catalog.tsx` | Add/Rename submit | Add `Loader2` spinner |
| 9 | `products.tsx` | Add/Edit submit | Add `Loader2` spinner |
| 10 | `job-letters.tsx` | Save + Save & Download | Add `Loader2` spinners |
| 11 | `billing.tsx` | Create Bill submit | Add `Loader2` spinner |
| 12 | `sales.tsx` | Quick Sale submit | Add `Loader2` spinner |

---

## Issue 3: Filtering Loading Skeletons

**Root cause**: `useQueryState()` only exposes `isLoading` (no cached data), not `isFetching` (refetching). With `placeholderData`, `isLoading` is always `false` on filter change.

**3 pages affected**: Sales, Invoices, Products

### Files
- `packages/query/src/use-query-state.ts` — add `refetching` to return type
- `apps/desktop/src/pages/sales.tsx` — add refetch indicator
- `apps/desktop/src/pages/invoices.tsx` — add refetch indicator
- `apps/desktop/src/pages/products.tsx` — add refetch indicator

---

## Execution Order
1. Invoice template (move to core, update both apps)
2. Loading states (HIGH priority forms first, then MEDIUM/LOW)
3. Filtering loading (expose `isFetching`, add indicators)
