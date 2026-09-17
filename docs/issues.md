# Code Review Issues

Resolved from comprehensive review of all features. Each issue is tagged with
severity and status.

---

## Label Bugs

| # | File | Issue | Status |
|---|------|-------|--------|
| 1 | `core/billing/labelTspl.ts` | `Math.round(sellingPrice)` on silver labels rounds 0.5 → 1 | FIXED — removed `Math.round` |

## Price Validation Removed

| # | File | Issue | Status |
|---|------|-------|--------|
| 2 | `desktop/products.tsx` | `buyVal <= 0` / `sellVal <= 0` blocks saving products with ₹0 price | FIXED — removed |
| 3 | `mobile/EditProductModal.tsx` | Same buy/sell price validation | FIXED — removed |
| 4 | `web/billing-view.tsx` | `validateBill` rejects zero-price items and zero totals | FIXED — removed |
| 5 | `desktop/billing.tsx` | Bill 1 + Bill 2 zeroPrice + total checks | FIXED — removed |
| 6 | `mobile/BillingScreen.tsx` | Bill 1 + Bill 2 zeroPriceIdx + total checks | FIXED — removed |
| 7 | `mobile/SalesScreen.tsx` | `items.some(i => i.price <= 0)` rejects zero-price items | FIXED — removed |
| 8 | `core/services/invoices.ts` | `ZERO_PRICE_ITEM` guard rejects invoices with ₹0 items | FIXED — removed |

## Allow Zero-Total Toggle

| # | File | Issue | Status |
|---|------|-------|--------|
| 9 | `core/db/schema.ts` | New `allow_zero_total` boolean column on settings (default: true) | ADDED |
| 10 | `core/db/drizzle/0009_*.sql` | Migration for new column | GENERATED + PUSHED |
| 11 | `core/services/settings.ts` | `ShopSettingsInput.allowZeroTotal` + `updateSettings` writes it | ADDED |
| 12 | `core/validators/index.ts` | `settingsSchema.allowZeroTotal` | ADDED |
| 13 | `core/services/invoices.ts` | `ZERO_TOTAL` guard checks `settings.allowZeroTotal` — skips when true | UPDATED |
| 14 | `web/settings-view.tsx` | "Allow ₹0 invoices" toggle in shop profile | ADDED |
| 15 | `desktop/settings.tsx` | Same toggle | ADDED |
| 16 | `mobile/SettingsScreen.tsx` | Same toggle | ADDED |
| 17 | `core/scripts/verify-invoice-guards.ts` | Removed zero-price test case | UPDATED |

## Previous Session Fixes (from earlier review)

| # | File | Issue | Status |
|---|------|-------|--------|
| 18 | `mobile/BillingScreen.tsx` | `toBillDocument` missing material returned fields | FIXED |
| 19 | `mobile/BillingScreen.tsx` | Bill 2 API call missing material returned fields | FIXED |
| 20 | `mobile/SalesScreen.tsx` | `total` can go negative + missing material returned in PDF | FIXED |
| 21 | `web/billing-view.tsx` | `buildBill()` missing material returned fields | FIXED |
| 22 | `web/billing-view.tsx` | Silver % shows for all products, not just Silver | FIXED |
| 23 | `web/product-form-dialog.tsx` | New-product reset missing type/weightUnit/silverPercentage | FIXED |
| 24 | `desktop/billing.tsx` | `invoiceToBillDocument` missing material returned fields | FIXED |
| 25 | `mobile/BillingScreen.tsx` | Bill 2 UI missing material returned inputs | FIXED |
| 26 | `desktop/billing.tsx` | Bill 2 `createInvoice` missing material returned fields | FIXED |

## Deferred (not bugs, enhancements)

| # | File | Issue | Status |
|---|------|-------|--------|
| 27 | `desktop/products.tsx` | Gold/Silver chip counts are page-local (not server-side totals) | DEFERRED |
| 28 | `label-print-dialog.tsx` | Preview ignores prefix settings (hardcoded) | DEFERRED |
| 29 | `desktop/billing.tsx` | Per-line-item silverPercentage editable but not sent to server | DEFERRED |
| 30 | `label-print-dialog.tsx` | Prefix spacing mismatch: preview `G: ` vs TSPL `G:` | DEFERRED |
| 31 | `label-print-dialog.tsx` | pricePrefix fallback prevents empty prefix | DEFERRED |
