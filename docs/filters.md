# Filter matrix — web / desktop / mobile

Single source of truth for **every data-narrowing control on every page** of
every app. Use it to spot holes instantly: a filter listed for one platform and
missing on another is a **parity bug**.

> **Mandatory:** whenever you add, remove, rename, move, or change the behaviour
> of any filter, search box, sort control, date range, status chip, pagination
> control, or analytics toggle — update this file **in the same change**.
> Review this matrix after every edit to a page, hook, or list query. See
> `AGENTS.md` §4b/§7.

Legend: **S** = server-side (query param reaches the API), **C** = client-side
(only the rows already loaded).

## Parity summary (gaps at a glance)

| Area | Web | Desktop | Mobile | Notes |
| --- | --- | --- | --- | --- |
| Dashboard period chips + custom range | ✅ S | ✅ S | ✅ S | KPIs scoped only; charts global |
| Dashboard: Weight sold drill-down | ✅ C | ✅ C | ✅ C | Tile opens a per-day product weight breakdown; grouped client-side from `period.weightBreakdown` (`groupWeightByDay` in core), so it follows the period chips |
| Products: search | ✅ S | ✅ S | ⚠️ C | Mobile search is local to loaded pages |
| Products: status (in/low/out) | ✅ S | ⚠️ C | ⚠️ C | Desktop filters current page; mobile never sends `status` |
| Products: type (Gold/Silver/…) | ✅ S | ✅ S | ✅ S | Mobile exposes Gold/Silver only |
| Products: pricing mode | ✅ S | ✅ S | ✅ S | |
| Products: article | ✅ S | ✅ S | ❌ | Missing on mobile |
| Products: category / color / size | ✅ S | ❌ | ❌ | Missing on desktop + mobile |
| Products: purity / karat / weight range | ❌ | ❌ | ❌ | **Not available anywhere** |
| Products: page size selector | ❌ | ❌ | ❌ | Fixed per platform |
| Articles: analytics period | ✅ S | ✅ S | ✅ S | |
| Articles: sort | ✅ C | ✅ C | ✅ C | |
| Articles: search | ❌ | ❌ | ❌ | Missing everywhere |
| Catalog: search | ❌ | ✅ C | ✅ C | Missing on web |
| Catalog: master chips (in-use/unused) | ❌ | ✅ C | ❌ | Desktop only |
| Invoices: search | ✅ S | ✅ S | ✅ S | |
| Invoices: status | ✅ S | ✅ S | ✅ S | |
| Invoices: date range | ❌ | ❌ | ❌ | API supports it; UI does not |
| Invoices: party filter | ❌ | ❌ | ❌ | API supports it; UI does not |
| Orders: search | ✅ S | ✅ S | ✅ S | |
| Orders: status | ✅ S | ✅ S | ✅ S | |
| Orders: date range / party | ❌ | ❌ | ❌ | API supports it; UI does not |
| Sales/POS: search | ✅ S | n/a | n/a (Billing) | Desktop Sales page removed — New Bill + Invoices replace it |
| Sales/POS: date range | ✅ S | n/a | n/a (Billing) | Desktop Sales page removed; Invoices has status, not dates |
| Parties: search | ✅ S | ⚠️ C | ❌ | Desktop local; mobile has no search |
| Parties: type filter | ✅ S | ❌ | ❌ | Web only |
| Parties: balance chips | ❌ | ✅ C | ✅ C | Missing on web |
| Advances: movement chips | ❌ | ✅ C | ✅ C (balance) | Different semantics |
| Job letters: search | ❌ | ❌ | ❌ | Missing everywhere |
| Reports: type | ✅ | ✅ | ✅ | `REPORT_TYPES` |
| Reports: date range + quick ranges | ✅ | ✅ | ✅ | Shared panel / sheet |
| Reports: row search | ✅ | ✅ | ✅ | Server-side `search` (desktop's old row-only search kept as a local table filter) |
| Reports: article/category/color/size/type | ✅ | ✅ | ✅ | Shared `ReportFilterPanel` (web/desktop) + `ReportFilterSheet` (mobile) |
| Reports: metal / karat / silver / weight | ✅ | ✅ | ✅ | Same shared filter model |
| Reports: sold state / payment status | ✅ | ✅ | ✅ | Same shared filter model |
| Reports: party | ✅ | ✅ | ✅ | Same shared filter model |
| Reports: sub-category + all-party pickers | ✅ | ✅ | ✅ | `categoryId` + `subCategoryId` |
| Help search | ✅ C | ✅ C | ✅ C | Static content |
| Page-size selector | ❌ | ❌ | ❌ | Fixed: products 20/40/40, invoices 15, orders 15, catalog 8, desktop recent 6 |

---

## Web — `apps/web/src/views/*`

| Page | Control | Scope | File |
| --- | --- | --- | --- |
| Dashboard | Period chips Today / Week / Month / Custom | S (`from`,`to`) | `dashboard-view.tsx:41-137` |
| Dashboard | Custom From/To dates | S | `dashboard-view.tsx:119-137` |
| Dashboard | Weight sold tile → drill-down dialog (days × products) | C | `dashboard-view.tsx` (`groupWeightByDay`) |
| Products | Search (name, SKU, barcode, color) | S | `products-view.tsx:402-410` |
| Products | Barcode lookup + camera | S | `products-view.tsx:413-419` |
| Products | Color / Size / Category / Article selects | S | `products-view.tsx:457-551` |
| Products | Type (Gold/Silver/Diamond/Platinum/Other) | S | `products-view.tsx:506-518` |
| Products | Stock status (All/In/Low/Out) | S | `products-view.tsx:519-529` |
| Products | Pricing (All/Auto/Manual) | S | `products-view.tsx:530-539` |
| Products | Table sort (per page) | C | `products-table.tsx:353-357` |
| Products | Prev/Next (`pageSize: 20`) | S | `products-table.tsx:415-435` |
| Articles | Analytics period pills | S (`preset`) | `articles-view.tsx:74-75` |
| Articles | Sort Revenue/Weight/Stock value | C | `articles-view.tsx:62-68` |
| Catalog | Per-card pagination (8 rows) | C | `catalog-view.tsx:277-303` |
| Invoices | Search | S | `invoices-view.tsx:181-190` |
| Invoices | Status pills | S | `invoices-view.tsx:193-212` |
| Invoices | Prev/Next (`pageSize: 15`) | S | `invoices-view.tsx:330-340` |
| Orders | Search | S | `orders-view.tsx:863-875` |
| Orders | Status select | S | `orders-view.tsx:877-893` |
| Orders | Prev/Next (`pageSize: 15`) | S | `orders-view.tsx:1085-1107` |
| Parties | Search | S | `parties-view.tsx:75-78` |
| Parties | Type (customer/supplier/worker/other) | S | `parties-view.tsx:80-89` |
| Sales | Search | S | `sales-view.tsx:107-116` |
| Sales | Date range (today/7d/30d/month/year/all) | S | `sales-view.tsx:118-135` |
| Sales | Table sort + pagination (10) | C | `sales-table.tsx:131-196` |
| Reports | Report type buttons | S | `reports-view.tsx` (`REPORT_OPTIONS`) |
| Reports | Full filter panel — search, article/category/sub-category, color/size, product type/metal, karat/silver/weight ranges, sold state, payment status, party, dates + quick ranges, Generate | S | Shared `ReportFilterPanel` (`packages/ui/src/components/report-filter-panel.tsx`), state via core `toReportFilters` |
| Reports | Itemized table (Article/Category/Type columns), sort | S | `reports-view.tsx` |
| Billing | Product search, barcode, party selects | C / S lookup | `billing-view.tsx:1660-1706` |
| Job letters | — (unfiltered, last 10) | — | `job-letter-view.tsx:199-214` |
| Settings | — (config, not list filters) | — | `settings-view.tsx` |
| Help | Static help search | C | `help-center.tsx:158-166` |
| Global | Topbar product search → Products | S | `app-topbar.tsx:83-104` |

## Desktop — `apps/desktop/src/pages/*`

| Page | Control | Scope | File |
| --- | --- | --- | --- |
| Dashboard | Period chips + custom From/To | S | `dashboard.tsx:177-195, 352-387` |
| Dashboard | Weight sold tile → drill-down dialog (days × products) | C | `dashboard.tsx` (`groupWeightByDay`) |
| Dashboard | Chart mode Monthly/Quantity | C | `dashboard.tsx:469-481` |
| Dashboard | Recent invoices Prev/Next (6) | S | `dashboard.tsx:738-753` |
| Products | Search | S | `products.tsx:1058-1063` |
| Products | Article / Pricing selects | S | `products.tsx:1065-1091` |
| Products | Chips All/In/Low/Out/Gold/Silver/Uncategorized | mixed | `products.tsx:551-564, 1092-1123` |
| Products | Show/Hide analytics | C (localStorage) | `products.tsx:1129-1132` |
| Products | Barcode lookup | S | `products.tsx:1149` |
| Products | Prev/Next (`pageSize: 40`) | S | `products.tsx:1498-1509` |
| Articles | Analytics period pills | S | `articles.tsx:88, 169` |
| Articles | Sort Revenue/Weight/Stock value | C | `articles.tsx:172-190` |
| Catalog | Search masters | C | `catalog.tsx:335-353` |
| Catalog | Chips All/In use/Unused/Idle | C | `catalog.tsx:313-317` |
| Catalog | Show/Hide analytics | C | `catalog.tsx:355-367` |
| Invoices | Status pills + Status select | S | `invoices.tsx:304-356` |
| Invoices | Search | S | `invoices.tsx:332-341` |
| Invoices | Prev/Next (`pageSize: 15`) | S | `invoices.tsx:496-506` |
| Orders | Status pills + Search + Prev/Next | S | `orders.tsx:894-931, 1096-1111` |
| Parties | Search (local) + balance chips + client paging (6) | C | `parties.tsx:331-365, 466-478` |
| Advances | Daybook chips + client paging (8) | C | `advances.tsx:329-355, 449-458` |
| Job letters | — | — | `job-letters.tsx:145-193` |
| Reports | Type tabs + full filter panel (search, article/category/sub-category, color/size, product type/metal, karat/silver/weight ranges, sold state, payment status, party, dates + quick ranges, Generate) | S | Shared `ReportFilterPanel` + `REPORT_TYPES` |
| Reports | Row search (loaded rows only: product/SKU/article/category/sub-category/type/colour/size/purity/karat/silver %) | C | `reports.tsx` |
| Reports | Shop-wide dashboard charts | — | hidden while `hasReportNarrowing(active)` |
| Billing | Product search, barcode, party selects | C / S lookup | `billing.tsx:1458-1476` |
| Settings | Config controls only | — | `settings.tsx` |
| Help | Static help search | C | `help-center.tsx` |

## Mobile — `apps/mobile/src/screens/*`

> The 2026-11-01/02 visual overhaul (Billing / Bills / Stock / product sheet /
> Articles / Reports / Settings) changed presentation only — Stock keeps one
> horizontally scrollable badge row (status + type + pricing), Reports uses
> uniform compact pills, and Billing line items are an accordion — but every
> query param, scope and filter set below is unchanged.

| Screen | Control | Scope | File |
| --- | --- | --- | --- |
| Home | Period chips + custom From/To | S | `HomeScreen.tsx:253-287` |
| Home | Weight sold tile → drill-down sheet (days × products) | C | `HomeScreen.tsx` (`weightSheetOpen`, `groupWeightByDay`) |
| Home | Status chips (navigate only) | — | `HomeScreen.tsx:203-217` |
| Products | Search (local over loaded pages) | C | `ProductsScreen.tsx` (`search` + `allProducts`) |
| Products | Single horizontally scrollable badge row: stock status (local, with counts + dots) → type Gold/Silver → price Auto/Manual | C / S | `ProductsScreen.tsx:488-549` |
| Products | Infinite scroll (`pageSize: 40`) | S | `ProductsScreen.tsx:566-569` |
| Catalog | Colors/Sizes/Categories tabs | tab switch | `CatalogScreen.tsx:192-213` |
| Catalog | Search (local) | C | `CatalogScreen.tsx:154-157` |
| Articles | Period tabs | S | `ArticlesScreen.tsx:220` |
| Articles | Sort tabs | C | `ArticlesScreen.tsx:234` |
| Bills | Search (filter sheet) | S | `InvoicesScreen.tsx` (`setSearchFilter`) |
| Bills | Status tabs (page counts) | S | `InvoicesScreen.tsx:321` |
| Bills | Prev/Next (15) | S | `InvoicesScreen.tsx:386-408` |
| Orders | Search / status chips / paging | S | `OrdersScreen.tsx` |
| Orders | Per-order **…** action menu (estimate / payment / history / edit / bill / cancel / delete) | C | `OrdersScreen.tsx` (`actionOrder` + `orderActions`) |
| Parties/Advances | Balance chips | C | `AdvancesScreen.tsx:241-249` |
| Job letters | — | — | `JobLettersScreen.tsx:82-106` |
| Reports | Type pills + filter sheet — search, article/category/sub-category/color/size/party pickers, product type/metal/sold/payment chips, karat/silver/weight ranges, dates + quick ranges, Run | S | `ReportFilterSheet.tsx` (same core `toReportFilters`, Gorhom sheet + controlled `SheetPicker`), opened from `ReportsScreen.tsx` window card |
| Reports | Row search over the loaded report (product/SKU/article/category/sub-category/type/colour/size/purity/karat/silver %) | C | `ReportsScreen.tsx` (`rowQuery`, deferred) |
| Reports | Sort Revenue/Profit/Qty | C | `ReportsScreen.tsx` |
| Reports | Dashboard charts (shop-wide) | — | hidden while `hasReportNarrowing(active)` — they cannot honour narrowing facets |
| Billing | Product picker search (server) + barcode | S | `BillingScreen.tsx:263-284, 393-430` |
| Settings | Group tabs Profile / Rates & Metal / Bill Formats / Appearance (local) | C | `SettingsScreen.tsx:493` |
| Settings | Silver display unit ₹/gm or ₹/10gm (config) | — | `SettingsScreen.tsx:605` |
| Help | Static help search | C | `HelpScreen.tsx:136-139` |

---

## Shared report filter model

Reports now accept a single filter object, defined **once** in
`packages/core/src/services/reports.ts` and consumed by the API, all three
apps, the CSV/Excel/PDF exports, and the shared `@munim/ui` filter panel:

| Field | Meaning |
| --- | --- |
| `type` | `daily \| weekly \| monthly \| yearly \| stock \| low_stock \| sold` |
| `startDate` / `endDate` | Inclusive period bounds (`yyyy-mm-dd`) |
| `search` | Product name / SKU / snapshot name |
| `articleId` | Article (design) |
| `categoryId` / `subCategoryId` | Category / sub-category |
| `color` / `size` | Master names |
| `productType` | `gold \| silver \| diamond \| platinum \| other` |
| `metal` | Sales line metal (`gold` / `silver` / …) |
| `goldKaratMin` / `goldKaratMax` | Karat range (line snapshot first, product fallback) |
| `silverPurityMin` / `silverPurityMax` | Silver % range |
| `weightMinGm` / `weightMaxGm` | Sold weight range in grams |
| `soldState` | `sold \| unsold \| all` |
| `paymentStatus` | `any \| paid \| partial \| unpaid \| draft` |
| `partyId` | Customer / party |

All fields are optional; an empty object reproduces the legacy behaviour.
