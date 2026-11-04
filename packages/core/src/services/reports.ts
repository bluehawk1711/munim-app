import { and, eq, gte, ilike, lte, sql, type SQL } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import * as schema from "../db/schema.js";
import { startOfDay, startOfMonth } from "../utils/format.js";
// These are the product's per-piece weight (gold = net weight) — not this
// module's own `materialWeightGm` for the bill's free-text "material returned".
import { productWeightGm, productWeightInUnit } from "../pricing/product.js";

/* ── Report vocabulary (shared by every platform's filter UI) ──── */

export const REPORT_TYPES = ["daily", "weekly", "monthly", "yearly", "stock", "low_stock", "sold"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_PRODUCT_TYPES = ["gold", "silver", "diamond", "platinum", "other"] as const;
export type ReportProductType = (typeof REPORT_PRODUCT_TYPES)[number];

export const REPORT_METALS = ["Gold", "Silver"] as const;
export type ReportMetal = (typeof REPORT_METALS)[number];

export const REPORT_SOLD_STATES = ["all", "sold", "unsold"] as const;
export type ReportSoldState = (typeof REPORT_SOLD_STATES)[number];

export const REPORT_PAYMENT_STATUSES = ["any", "paid", "partial", "unpaid", "draft"] as const;
export type ReportPaymentStatus = (typeof REPORT_PAYMENT_STATUSES)[number];

/** Free-text material-returned weight ("5gm", "500mg", "5.2") → GRAMS.
 *  `parseNetWeight` strips the unit, so the unit is read from the TEXT itself
 *  ("…mg" → milligrams, anything else → grams). Unparseable → 0. */
export function materialWeightGm(text: string | null | undefined): number {
  if (!text) return 0;
  const cleaned = text.replace(/[^0-9.]/g, "");
  if (cleaned === "") return 0;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return 0;
  const grams = /mg/i.test(text) ? value / 1000 : value;
  return Math.round(grams * 10000) / 10000;
}

/**
 * Every filter a report can be narrowed by. One shape shared by the API
 * validator, web/desktop/mobile filter UIs, the query hook and the CSV/Excel
 * exports — so all three platforms ask the database the same question.
 * All fields are optional; `{}` reproduces the legacy type + date report.
 */
export type ReportFilters = {
  type: ReportType;
  /** Inclusive lower bound (yyyy-mm-dd or ISO). */
  startDate?: string;
  /** Inclusive upper bound (yyyy-mm-dd or ISO). */
  endDate?: string;
  /** Product name / SKU / bill-line snapshot name. */
  search?: string;
  articleId?: string;
  categoryId?: string;
  subCategoryId?: string;
  /** Master color name (bill-line snapshot first, current product fallback). */
  color?: string;
  /** Master size name (bill-line snapshot first, current product fallback). */
  size?: string;
  productType?: ReportProductType;
  /** Bill-line metal — from the frozen pricing snapshot, product type fallback. */
  metal?: ReportMetal;
  goldKaratMin?: number;
  goldKaratMax?: number;
  silverPurityMin?: number;
  silverPurityMax?: number;
  /** Sold line weight range in GRAMS. */
  weightMinGm?: number;
  weightMaxGm?: number;
  /** Applies to stock / low-stock reports; sales reports are inherently sold. */
  soldState?: ReportSoldState;
  paymentStatus?: ReportPaymentStatus;
  partyId?: string;
};

/** Backwards-compatible alias — a filter object always carries its type. */
export type ReportQuery = ReportFilters;

/**
 * String-only filter state used by the report forms (web, desktop AND mobile).
 * Numeric ranges stay strings so an empty input means "no bound" — one shape
 * for every platform's controls, converted by `toReportFilters`.
 */
export type ReportFilterFormValues = {
  search: string;
  articleId: string;
  categoryId: string;
  subCategoryId: string;
  color: string;
  size: string;
  productType: ReportProductType | "";
  metal: ReportMetal | "";
  goldKaratMin: string;
  goldKaratMax: string;
  silverPurityMin: string;
  silverPurityMax: string;
  weightMinGm: string;
  weightMaxGm: string;
  soldState: ReportSoldState;
  paymentStatus: ReportPaymentStatus;
  partyId: string;
  startDate: string;
  endDate: string;
};

export function emptyReportFilterForm(): ReportFilterFormValues {
  return {
    search: "",
    articleId: "",
    categoryId: "",
    subCategoryId: "",
    color: "",
    size: "",
    productType: "",
    metal: "",
    goldKaratMin: "",
    goldKaratMax: "",
    silverPurityMin: "",
    silverPurityMax: "",
    weightMinGm: "",
    weightMaxGm: "",
    soldState: "all",
    paymentStatus: "any",
    partyId: "",
    startDate: "",
    endDate: "",
  };
}

function rangeNumber(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Form state → API filter object. Empty controls become `undefined`. */
export function toReportFilters(type: ReportType, form: ReportFilterFormValues): ReportFilters {
  return {
    type,
    startDate: form.startDate || undefined,
    endDate: form.endDate || undefined,
    search: form.search.trim() || undefined,
    articleId: form.articleId || undefined,
    categoryId: form.categoryId || undefined,
    subCategoryId: form.subCategoryId || undefined,
    color: form.color || undefined,
    size: form.size || undefined,
    productType: form.productType || undefined,
    metal: form.metal || undefined,
    goldKaratMin: rangeNumber(form.goldKaratMin),
    goldKaratMax: rangeNumber(form.goldKaratMax),
    silverPurityMin: rangeNumber(form.silverPurityMin),
    silverPurityMax: rangeNumber(form.silverPurityMax),
    weightMinGm: rangeNumber(form.weightMinGm),
    weightMaxGm: rangeNumber(form.weightMaxGm),
    soldState: form.soldState,
    paymentStatus: form.paymentStatus,
    partyId: form.partyId || undefined,
  };
}

/**
 * True when an APPLIED filter set narrows the report beyond its type/period —
 * dashboard charts (turnover, category split, units) are shop-wide and cannot
 * honour these facets, so platforms hide them while a narrowing filter is on.
 */
export function hasReportNarrowing(filters: ReportFilters | null | undefined): boolean {
  if (!filters) return false;
  return Boolean(
    filters.startDate ||
      filters.endDate ||
      filters.search ||
      filters.articleId ||
      filters.categoryId ||
      filters.subCategoryId ||
      filters.color ||
      filters.size ||
      filters.productType ||
      filters.metal ||
      filters.goldKaratMin != null ||
      filters.goldKaratMax != null ||
      filters.silverPurityMin != null ||
      filters.silverPurityMax != null ||
      filters.weightMinGm != null ||
      filters.weightMaxGm != null ||
      (filters.soldState != null && filters.soldState !== "all") ||
      (filters.paymentStatus != null && filters.paymentStatus !== "any") ||
      filters.partyId,
  );
}

/** How many narrowing facets are active — drives the "Filters (n)" badge. */
export function countActiveReportFilters(form: ReportFilterFormValues): number {
  let count = 0;
  if (form.search.trim()) count += 1;
  if (form.articleId) count += 1;
  if (form.categoryId) count += 1;
  if (form.subCategoryId) count += 1;
  if (form.color) count += 1;
  if (form.size) count += 1;
  if (form.productType) count += 1;
  if (form.metal) count += 1;
  if (rangeNumber(form.goldKaratMin) != null || rangeNumber(form.goldKaratMax) != null) count += 1;
  if (rangeNumber(form.silverPurityMin) != null || rangeNumber(form.silverPurityMax) != null) count += 1;
  if (rangeNumber(form.weightMinGm) != null || rangeNumber(form.weightMaxGm) != null) count += 1;
  if (form.soldState !== "all") count += 1;
  if (form.paymentStatus !== "any") count += 1;
  if (form.partyId) count += 1;
  if (form.startDate || form.endDate) count += 1;
  return count;
}

export type ReportRow = {
  productId: string | null;
  productName: string;
  sku: string | null;
  /** Facets from the current product (null for deleted products). */
  articleName: string | null;
  categoryName: string | null;
  subCategoryName: string | null;
  productType: string | null;
  purity: string | null;
  goldKarat: number | null;
  silverPercentage: number | null;
  color: string | null;
  size: string | null;
  stock: number;
  soldQuantity: number;
  /** Unit weight (null when the product has no weight set). */
  weight: number | null;
  /** Display unit: "mg" or "gm". */
  weightUnit: string;
  /** Total weight sold (quantity × unit weight). */
  soldWeight: number;
  /** Line-level weight sold in GRAMS — frozen `pricing.weightGm` × quantity
   *  (line weight snapshot as fallback); independent of later product edits. */
  soldWeightGm: number;
  revenue: number;
  profit: number;
};

/** One day's section of the day-wise Daily Sales report — a header (the day
 *  and what it did) plus the products sold THAT day. Only `daily` fills this;
 *  every other report type returns []. */
export type ReportDayGroup = {
  /** ISO date (yyyy-mm-dd). */
  day: string;
  /** Human day label — "20 Oct 2026". */
  label: string;
  /** Invoices raised that day (a day with sales has ≥ 1). */
  invoices: number;
  daySoldQuantity: number;
  dayRevenue: number;
  rows: ReportRow[];
};

export type ReportTotals = {
  stock: number;
  soldQuantity: number;
  soldWeight: number;
  weightSoldGm: number;
  revenue: number;
  profit: number;
  materialReceivedGm: number;
  materialReceivedValue: number;
};

export type ReportResult = {
  type: ReportType;
  title: string;
  generatedAt: string;
  periodLabel: string;
  rows: ReportRow[];
  /** Day sections — populated for `daily` only (see `ReportDayGroup`). */
  days: ReportDayGroup[];
  totals: ReportTotals;
};

const PAYMENT_STATUS_DB: Record<Exclude<ReportPaymentStatus, "any">, "DRAFT" | "UNPAID" | "PARTIAL" | "PAID"> = {
  draft: "DRAFT",
  unpaid: "UNPAID",
  partial: "PARTIAL",
  paid: "PAID",
};

function rangeLabel(start: Date, end: Date): string {
  const opts = { day: "2-digit", month: "short", year: "numeric" } as const;
  const s = start.toLocaleDateString("en-IN", opts);
  const e = end.toLocaleDateString("en-IN", opts);
  return s === e ? s : `${s} – ${e}`;
}

/** `yyyy-mm-dd` → local midnight (avoids UTC shift from `new Date("yyyy-mm-dd")`). */
function parseDay(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (y && m && d) return new Date(y, m - 1, d);
  const fallback = new Date(value);
  fallback.setHours(0, 0, 0, 0);
  return fallback;
}

/** Aggregated bill line weight in GRAMS — frozen snapshot first, column fallback. */
const lineWeightGm = sql<number>`coalesce(
  (${schema.invoiceItems.pricing} ->> 'weightGm')::float8,
  case when ${schema.invoiceItems.weightUnit} = 'mg' then ${schema.invoiceItems.weight} / 1000.0
       else ${schema.invoiceItems.weight} end
)`;

/** Bill-line conditions shared by every sales aggregation. */
function lineConditions(filters: ReportFilters): SQL[] {
  const conditions: SQL[] = [];
  const search = filters.search?.trim() ?? "";
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      sql`(
        ${schema.invoiceItems.productName} ilike ${pattern}
        or coalesce(${schema.invoiceItems.sku}, '') ilike ${pattern}
        or exists (
          select 1 from ${schema.products} rp
          where rp.id = ${schema.invoiceItems.productId}
            and (rp.name ilike ${pattern} or rp.sku ilike ${pattern})
        )
      )`,
    );
  }
  if (filters.color) {
    conditions.push(
      sql`(
        lower(${schema.invoiceItems.color}) = lower(${filters.color})
        or (
          ${schema.invoiceItems.color} is null
          and exists (
            select 1 from ${schema.products} rp
            join ${schema.colors} rc on rc.id = rp.color_id
            where rp.id = ${schema.invoiceItems.productId} and lower(rc.name) = lower(${filters.color})
          )
        )
      )`,
    );
  }
  if (filters.size) {
    conditions.push(
      sql`(
        lower(${schema.invoiceItems.size}) = lower(${filters.size})
        or (
          ${schema.invoiceItems.size} is null
          and exists (
            select 1 from ${schema.products} rp
            join ${schema.sizes} rs on rs.id = rp.size_id
            where rp.id = ${schema.invoiceItems.productId} and lower(rs.name) = lower(${filters.size})
          )
        )
      )`,
    );
  }
  if (filters.articleId) {
    conditions.push(
      sql`exists (select 1 from ${schema.products} rp where rp.id = ${schema.invoiceItems.productId} and rp.article_id = ${filters.articleId})`,
    );
  }
  if (filters.categoryId) {
    conditions.push(
      sql`exists (select 1 from ${schema.products} rp where rp.id = ${schema.invoiceItems.productId} and rp.category_id = ${filters.categoryId})`,
    );
  }
  if (filters.subCategoryId) {
    conditions.push(
      sql`exists (select 1 from ${schema.products} rp where rp.id = ${schema.invoiceItems.productId} and rp.sub_category_id = ${filters.subCategoryId})`,
    );
  }
  if (filters.productType) {
    conditions.push(
      sql`exists (select 1 from ${schema.products} rp where rp.id = ${schema.invoiceItems.productId} and lower(rp.type) = ${filters.productType})`,
    );
  }
  if (filters.metal) {
    conditions.push(
      sql`exists (
        select 1 from ${schema.products} rp
        where rp.id = ${schema.invoiceItems.productId}
          and lower(coalesce((${schema.invoiceItems.pricing} ->> 'metal'), rp.type)) = lower(${filters.metal})
      )`,
    );
  }
  if (filters.goldKaratMin != null) {
    conditions.push(
      sql`exists (
        select 1 from ${schema.products} rp
        where rp.id = ${schema.invoiceItems.productId}
          and coalesce((${schema.invoiceItems.pricing} ->> 'karat')::float8, rp.gold_karat) >= ${filters.goldKaratMin}
      )`,
    );
  }
  if (filters.goldKaratMax != null) {
    conditions.push(
      sql`exists (
        select 1 from ${schema.products} rp
        where rp.id = ${schema.invoiceItems.productId}
          and coalesce((${schema.invoiceItems.pricing} ->> 'karat')::float8, rp.gold_karat) <= ${filters.goldKaratMax}
      )`,
    );
  }
  if (filters.silverPurityMin != null) {
    conditions.push(
      sql`exists (
        select 1 from ${schema.products} rp
        where rp.id = ${schema.invoiceItems.productId}
          and coalesce((${schema.invoiceItems.pricing} ->> 'silverPercentage')::float8, rp.silver_percentage) >= ${filters.silverPurityMin}
      )`,
    );
  }
  if (filters.silverPurityMax != null) {
    conditions.push(
      sql`exists (
        select 1 from ${schema.products} rp
        where rp.id = ${schema.invoiceItems.productId}
          and coalesce((${schema.invoiceItems.pricing} ->> 'silverPercentage')::float8, rp.silver_percentage) <= ${filters.silverPurityMax}
      )`,
    );
  }
  if (filters.weightMinGm != null) conditions.push(sql`${lineWeightGm} >= ${filters.weightMinGm}`);
  if (filters.weightMaxGm != null) conditions.push(sql`${lineWeightGm} <= ${filters.weightMaxGm}`);
  return conditions;
}

/** Invoice-level conditions (party / payment status) — also used for material. */
function invoiceConditions(filters: ReportFilters): SQL[] {
  const conditions: SQL[] = [];
  if (filters.paymentStatus && filters.paymentStatus !== "any") {
    conditions.push(eq(schema.invoices.status, PAYMENT_STATUS_DB[filters.paymentStatus]));
  }
  if (filters.partyId) conditions.push(eq(schema.invoices.partyId, filters.partyId));
  return conditions;
}

type StockProduct = {
  id: string;
  sku: string;
  name: string;
  type: string;
  purity: string | null;
  goldKarat: number | null;
  silverPercentage: number;
  stock: number;
  weight: number | null;
  weightUnit: string;
  /** Free-text net weight — gold's weight basis (see `productWeightGm`). */
  netWeight: string | null;
  purchasePrice: number;
  lowStockThreshold: number;
  articleId: string | null;
  categoryId: string | null;
  subCategoryId: string | null;
  colorName: string | null;
  sizeName: string | null;
  categoryName: string | null;
  subCategoryName: string | null;
  articleName: string | null;
};

/** JS-side narrowing for product-first reports (stock / low_stock). */
function matchesStockFilters(p: StockProduct, filters: ReportFilters): boolean {
  const search = filters.search?.trim().toLowerCase() ?? "";
  if (search) {
    const haystack = [p.name, p.sku, p.type, p.purity, p.colorName, p.sizeName, p.categoryName, p.subCategoryName, p.articleName]
      .filter((v): v is string => !!v)
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(search)) return false;
  }
  if (filters.articleId && p.articleId !== filters.articleId) return false;
  if (filters.categoryId && p.categoryId !== filters.categoryId) return false;
  if (filters.subCategoryId && p.subCategoryId !== filters.subCategoryId) return false;
  if (filters.color && p.colorName?.toLowerCase() !== filters.color.toLowerCase()) return false;
  if (filters.size && p.sizeName?.toLowerCase() !== filters.size.toLowerCase()) return false;
  if (filters.productType && p.type.toLowerCase() !== filters.productType) return false;
  if (filters.metal && p.type.toLowerCase() !== filters.metal.toLowerCase()) return false;
  if (filters.goldKaratMin != null && (p.goldKarat == null || p.goldKarat < filters.goldKaratMin)) return false;
  if (filters.goldKaratMax != null && (p.goldKarat == null || p.goldKarat > filters.goldKaratMax)) return false;
  if (filters.silverPurityMin != null && p.silverPercentage < filters.silverPurityMin) return false;
  if (filters.silverPurityMax != null && p.silverPercentage > filters.silverPurityMax) return false;
  if (filters.weightMinGm != null || filters.weightMaxGm != null) {
    // Gold weighs its net weight, so a gold product with only `net_weight` set
    // must still pass a weight range (it used to be filtered out entirely).
    const grams = productWeightGm(p);
    if (grams <= 0) return false;
    if (filters.weightMinGm != null && grams < filters.weightMinGm) return false;
    if (filters.weightMaxGm != null && grams > filters.weightMaxGm) return false;
  }
  return true;
}

/**
 * Builds the period-scoped product report used by all three apps.
 *
 * Legacy call shape `getReport(db, type, startDate?, endDate?)` still works;
 * new callers pass a full `ReportFilters` object.
 */
export async function getReport(
  db: DbClient,
  query: ReportFilters | ReportType,
  startDate?: string,
  endDate?: string,
): Promise<ReportResult> {
  const filters: ReportFilters = typeof query === "string" ? { type: query, startDate, endDate } : query;
  const type = filters.type;
  const now = new Date();
  let periodStart: Date;
  let periodEnd: Date = now;
  let title = "";
  let periodLabel = "";

  switch (type) {
    case "daily": {
      periodStart = startOfDay(now);
      title = "Daily Sales Report";
      periodLabel = rangeLabel(periodStart, now);
      break;
    }
    case "weekly": {
      periodStart = startOfDay(new Date(now.getTime() - 6 * 86400000));
      title = "Weekly Sales Report";
      periodLabel = `${periodStart.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} – ${now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`;
      break;
    }
    case "monthly": {
      periodStart = startOfMonth(now);
      title = "Monthly Sales Report";
      periodLabel = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
      break;
    }
    case "yearly": {
      periodStart = new Date(now.getFullYear(), 0, 1);
      title = "Yearly Sales Report";
      periodLabel = String(now.getFullYear());
      break;
    }
    case "sold": {
      periodStart = startOfMonth(now);
      title = "Sold Products Report";
      periodLabel = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
      break;
    }
    default: {
      periodStart = startOfMonth(now);
    }
  }

  const hasCustomStart = !!filters.startDate;
  const hasCustomEnd = !!filters.endDate;
  if (filters.startDate) periodStart = parseDay(filters.startDate);
  if (filters.endDate) {
    periodEnd = parseDay(filters.endDate);
    periodEnd.setHours(23, 59, 59, 999);
  }
  // A custom window always names itself, whatever the report type's default.
  if (hasCustomStart || hasCustomEnd) periodLabel = rangeLabel(periodStart, periodEnd);

  const salesConditions = [gte(schema.invoices.date, periodStart), lte(schema.invoices.date, periodEnd)];
  const lineFilterConditions = lineConditions(filters);
  const invoiceFilterConditions = invoiceConditions(filters);
  const aggregateWhere = and(...salesConditions, ...invoiceFilterConditions, ...lineFilterConditions);

  // Aggregate invoice items in the period, grouped by product
  const rows = await db
    .select({
      productId: schema.invoiceItems.productId,
      productName: schema.invoiceItems.productName,
      soldQuantity: sql<number>`coalesce(sum(${schema.invoiceItems.quantity}),0)::float8`.as("sold_quantity"),
      weightGm: sql<number>`coalesce(sum(${lineWeightGm} * ${schema.invoiceItems.quantity}), 0)::float8`.as("weight_gm"),
      revenue: sql<number>`coalesce(sum(${schema.invoiceItems.total}),0)::float8`.as("revenue"),
    })
    .from(schema.invoiceItems)
    .innerJoin(schema.invoices, eq(schema.invoices.id, schema.invoiceItems.invoiceId))
    .where(aggregateWhere)
    .groupBy(schema.invoiceItems.productId, schema.invoiceItems.productName);

  // Current product facets + stock + purchase price (never filtered: enrichment)
  const allProducts: StockProduct[] = await db
    .select({
      id: schema.products.id,
      sku: schema.products.sku,
      name: schema.products.name,
      type: schema.products.type,
      purity: schema.products.purity,
      goldKarat: schema.products.goldKarat,
      silverPercentage: schema.products.silverPercentage,
      stock: schema.products.stock,
      weight: schema.products.weight,
      weightUnit: schema.products.weightUnit,
      netWeight: schema.products.netWeight,
      purchasePrice: schema.products.purchasePrice,
      lowStockThreshold: schema.products.lowStockThreshold,
      articleId: schema.products.articleId,
      categoryId: schema.products.categoryId,
      subCategoryId: schema.products.subCategoryId,
      colorName: sql<string | null>`${schema.colors.name}`.as("color_name"),
      sizeName: sql<string | null>`${schema.sizes.name}`.as("size_name"),
      categoryName: sql<string | null>`${schema.categories.name}`.as("category_name"),
      subCategoryName: sql<string | null>`(select sc.name from ${schema.categories} sc where sc.id = ${schema.products.subCategoryId})`.as("sub_category_name"),
      articleName: sql<string | null>`${schema.articles.name}`.as("article_name"),
    })
    .from(schema.products)
    .leftJoin(schema.colors, eq(schema.colors.id, schema.products.colorId))
    .leftJoin(schema.sizes, eq(schema.sizes.id, schema.products.sizeId))
    .leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
    .leftJoin(schema.articles, eq(schema.articles.id, schema.products.articleId));

  const productById = new Map(allProducts.map((p) => [p.id, p]));

  const facetsOf = (p: StockProduct | undefined) => ({
    articleName: p?.articleName ?? null,
    categoryName: p?.categoryName ?? null,
    subCategoryName: p?.subCategoryName ?? null,
    productType: p?.type ?? null,
    purity: p?.purity ?? null,
    goldKarat: p?.goldKarat ?? null,
    silverPercentage: p?.silverPercentage ?? null,
  });

  // ── Day-wise aggregation (Daily Sales only) ────────────────────────────
  // One section per DATE with the products sold that day — the shop asked to
  // see, day by day, what is actually selling. Rows merge by productId (same
  // rename-safe rule as the flat report above); stock/weight/profit come from
  // the CURRENT product like everywhere else.
  const dayGroups: ReportDayGroup[] = [];
  if (type === "daily") {
    const dayRows = await db
      .select({
        day: sql<string>`to_char(${schema.invoices.date}, 'YYYY-MM-DD')`.as("day"),
        productId: schema.invoiceItems.productId,
        productName: schema.invoiceItems.productName,
        invoices: sql<number>`count(distinct ${schema.invoices.id})::float8`.as("invoices"),
        soldQuantity: sql<number>`coalesce(sum(${schema.invoiceItems.quantity}),0)::float8`.as("sold_quantity"),
        weightGm: sql<number>`coalesce(sum(${lineWeightGm} * ${schema.invoiceItems.quantity}), 0)::float8`.as("weight_gm"),
        revenue: sql<number>`coalesce(sum(${schema.invoiceItems.total}),0)::float8`.as("revenue"),
      })
      .from(schema.invoiceItems)
      .innerJoin(schema.invoices, eq(schema.invoices.id, schema.invoiceItems.invoiceId))
      .where(aggregateWhere)
      .groupBy(sql`to_char(${schema.invoices.date}, 'YYYY-MM-DD')`, schema.invoiceItems.productId, schema.invoiceItems.productName)
      .orderBy(sql`to_char(${schema.invoices.date}, 'YYYY-MM-DD')`);

    const byDay = new Map<string, { rows: Map<string, ReportRow>; invoices: number }>();
    for (const r of dayRows) {
      const entry = byDay.get(r.day) ?? { rows: new Map<string, ReportRow>(), invoices: 0 };
      byDay.set(r.day, entry);
      entry.invoices += r.invoices;
      const p = r.productId ? productById.get(r.productId) : undefined;
      const existing = r.productId ? entry.rows.get(r.productId) : undefined;
      // Deleted products (no current row) still count — key by the snapshot
      // name so they never collide.
      const key = r.productId ?? `name:${r.productName}`;
      const soldWeight = p ? r.soldQuantity * (productWeightInUnit(p) ?? 0) : 0;
      const soldQuantity = (existing?.soldQuantity ?? 0) + r.soldQuantity;
      const revenue = (existing?.revenue ?? 0) + r.revenue;
      entry.rows.set(key, {
        productId: r.productId,
        productName: existing?.productName ?? p?.name ?? r.productName,
        sku: p?.sku ?? null,
        ...facetsOf(p),
        color: p?.colorName ?? null,
        size: p?.sizeName ?? null,
        stock: p?.stock ?? 0,
        weight: p ? productWeightInUnit(p) : null,
        weightUnit: p?.weightUnit ?? "gm",
        soldWeight: (existing?.soldWeight ?? 0) + soldWeight,
        soldWeightGm: (existing?.soldWeightGm ?? 0) + (r.weightGm ?? 0),
        soldQuantity,
        revenue,
        profit: revenue - soldQuantity * (p?.purchasePrice ?? 0),
      });
    }
    for (const [day, entry] of [...byDay.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
      const rows = [...entry.rows.values()].sort((a, b) => b.revenue - a.revenue);
      dayGroups.push({
        day,
        label: new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
        invoices: entry.invoices,
        daySoldQuantity: rows.reduce((s, r) => s + r.soldQuantity, 0),
        dayRevenue: rows.reduce((s, r) => s + r.revenue, 0),
        rows,
      });
    }
  }

  let reportRows: ReportRow[] = [];
  if (type === "stock" || type === "low_stock") {
    const soldState = filters.soldState ?? "all";
    reportRows = allProducts
      .filter((p) => {
        if (type === "low_stock" && p.stock > p.lowStockThreshold) return false;
        if (!matchesStockFilters(p, filters)) return false;
        const sold = rows.find((r) => r.productId === p.id);
        const soldQuantity = sold?.soldQuantity ?? 0;
        if (soldState === "sold" && soldQuantity <= 0) return false;
        if (soldState === "unsold" && soldQuantity > 0) return false;
        return true;
      })
      .map((p) => {
        const sold = rows.find((r) => r.productId === p.id);
        const soldQuantity = sold?.soldQuantity ?? 0;
        return {
          productId: p.id,
          productName: p.name,
          sku: p.sku,
          ...facetsOf(p),
          color: p.colorName,
          size: p.sizeName,
          stock: p.stock,
          weight: productWeightInUnit(p),
          weightUnit: p.weightUnit ?? "gm",
          soldWeight: soldQuantity * (productWeightInUnit(p) ?? 0),
          soldWeightGm: sold?.weightGm ?? 0,
          soldQuantity,
          revenue: sold?.revenue ?? 0,
          profit: (sold?.revenue ?? 0) - soldQuantity * p.purchasePrice,
        };
      });
    title = type === "stock" ? "Product Stock Report" : "Low Stock Report";
    if (!hasCustomStart && !hasCustomEnd) periodLabel = rangeLabel(startOfDay(now), now);
  } else {
    // The SQL groups by (productId, productName), so a product that was
    // renamed mid-period produces one row per name snapshot (old invoices keep
    // the old snapshot). Merge by productId so the report shows ONE row per
    // product with its CURRENT name — this also keeps row keys unique across
    // web, desktop & mobile (a shared SKU previously caused duplicate-key
    // console errors in the reports tables).
    const merged = new Map<string, ReportRow>();
    for (const r of rows) {
      if (!r.productId) continue;
      const p = productById.get(r.productId);
      const soldWeight = p ? r.soldQuantity * (productWeightInUnit(p) ?? 0) : 0;
      const existing = merged.get(r.productId);
      const soldQuantity = (existing?.soldQuantity ?? 0) + r.soldQuantity;
      const revenue = (existing?.revenue ?? 0) + r.revenue;
      merged.set(r.productId, {
        productId: r.productId,
        // Current product name wins; fall back to the first snapshot seen for
        // products that were deleted after being sold.
        productName: existing?.productName ?? p?.name ?? r.productName,
        sku: p?.sku ?? null,
        ...facetsOf(p),
        color: p?.colorName ?? null,
        size: p?.sizeName ?? null,
        stock: p?.stock ?? 0,
        weight: p ? productWeightInUnit(p) : null,
        weightUnit: p?.weightUnit ?? "gm",
        soldWeight: (existing?.soldWeight ?? 0) + soldWeight,
        soldWeightGm: (existing?.soldWeightGm ?? 0) + (r.weightGm ?? 0),
        soldQuantity,
        revenue,
        profit: revenue - soldQuantity * (p?.purchasePrice ?? 0),
      });
    }
    reportRows = [...merged.values()];
  }

  reportRows.sort((a, b) => b.revenue - a.revenue);

  // Material received in the same period (bill's "Material Returned" free
  // text + assessed value) — the other half of the weight story.
  const materialRows = await db
    .select({
      weight: schema.invoices.materialReturnedWeight,
      value: schema.invoices.materialReturnedValue,
    })
    .from(schema.invoices)
    .where(
      and(
        gte(schema.invoices.date, periodStart),
        lte(schema.invoices.date, periodEnd),
        ...invoiceFilterConditions,
        sql`(${schema.invoices.materialReturnedValue} > 0 or ${schema.invoices.materialReturnedWeight} is not null)`,
      ),
    );

  const totals = reportRows.reduce<ReportTotals>(
    (acc, r) => {
      acc.stock += r.stock;
      acc.soldQuantity += r.soldQuantity;
      // Normalize to grams so mixed-unit totals are meaningful.
      acc.soldWeight += r.weightUnit === "mg" ? r.soldWeight / 1000 : r.soldWeight;
      acc.weightSoldGm += r.soldWeightGm;
      acc.revenue += r.revenue;
      acc.profit += r.profit;
      return acc;
    },
    { stock: 0, soldQuantity: 0, soldWeight: 0, weightSoldGm: 0, revenue: 0, profit: 0, materialReceivedGm: 0, materialReceivedValue: 0 },
  );
  totals.weightSoldGm = Math.round(totals.weightSoldGm * 100) / 100;
  totals.materialReceivedGm =
    Math.round(materialRows.reduce((s, r) => s + materialWeightGm(r.weight), 0) * 100) / 100;
  totals.materialReceivedValue =
    Math.round(materialRows.reduce((s, r) => s + (r.value || 0), 0) * 100) / 100;

  return {
    type,
    title,
    generatedAt: now.toISOString(),
    periodLabel,
    rows: reportRows,
    days: dayGroups,
    totals,
  };
}

/**
 * Serializes a report into RFC-4180 CSV (quoted, escaped, CRLF line endings).
 * Shared by web, desktop AND mobile so every platform exports the same file.
 * Day-wise reports (Daily Sales) emit one row per product per DAY with a
 * leading Date column; flat reports keep the classic columns.
 */
export function reportToCsv(report: {
  title: string;
  rows: ReportRow[];
  days?: ReportDayGroup[];
  totals: {
    stock: number;
    soldQuantity: number;
    soldWeight: number;
    revenue: number;
    profit: number;
    /** Line-level weight sold (gm) — falls back to soldWeight when absent. */
    weightSoldGm?: number;
    materialReceivedGm?: number;
    materialReceivedValue?: number;
  };
}): string {
  const dayWise = (report.days?.length ?? 0) > 0;
  const facetHeader = ["Article", "Category", "Type", "Purity", "Karat"];
  const baseHeader = ["Product", "SKU", ...facetHeader, "Color", "Size", "Stock", "Sold Qty", "Sold Wt (gm)", "Revenue", "Profit", "Material Wt (gm)", "Material Recvd (₹)"];
  const header = dayWise ? ["Date", ...baseHeader] : baseHeader;
  const quote = (v: string | number): string => `"${String(v).replace(/"/g, '""')}"`;
  const rowCells = (r: ReportRow, date = ""): string =>
    [
      ...(dayWise ? [date] : []),
      r.productName,
      r.sku ?? "",
      r.articleName ?? "",
      r.categoryName ?? "",
      r.productType ?? "",
      r.purity ?? "",
      r.goldKarat ?? "",
      r.color ?? "",
      r.size ?? "",
      r.stock,
      r.soldQuantity,
      Math.round(r.soldWeightGm * 1000) / 1000,
      r.revenue,
      r.profit,
      "",
      "",
    ]
      .map(quote)
      .join(",");
  const t = report.totals;
  // Totals row — the aggregates the reports screen shows, incl. material in.
  // "Total" lands in Date (daywise) or Product (flat); the remaining name
  // columns are padded so the cell count always matches the header.
  const padCount = dayWise ? 9 : 8; // identity columns after the cell holding "Total"
  const totalsCells = [
    "Total",
    ...Array.from({ length: padCount }, () => ""),
    t.stock,
    t.soldQuantity,
    Math.round((t.weightSoldGm ?? t.soldWeight) * 1000) / 1000,
    t.revenue,
    t.profit,
    t.materialReceivedGm ?? 0,
    t.materialReceivedValue ?? 0,
  ];
  const lines = [
    header.join(","),
    ...(dayWise
      ? (report.days ?? []).flatMap((d) => d.rows.map((r) => rowCells(r, d.day)))
      : report.rows.map((r) => rowCells(r))),
    totalsCells.map(quote).join(","),
  ];
  return lines.join("\r\n");
}
