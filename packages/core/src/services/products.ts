import { and, desc, eq, ilike, inArray, isNull, or, sql, type SQLWrapper } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import * as schema from "../db/schema.js";
import { isGoldKarat, round2 } from "../pricing/gold.js";
import { generateSku } from "../utils/codes.js";
import { generateEan13 } from "../utils/barcode.js";
import { logActivity } from "./activity.js";

/* ── Inventory aggregates (products page header) ──────────────── */

export type InventoryStats = {
  /** Distinct SKUs in the catalog. */
  totalSkus: number;
  /** Sum of `stock` across all products (units, not value). */
  totalUnits: number;
  /**
   * Sum of `stock * weight` in **grams** — total physical material on hand.
   * Every row is normalized from its own `weightUnit` via `weightGmSql`
   * (mg rows ÷ 1000). Renamed from `totalWeightMg` — the old value was in
   * mixed units despite the name.
   */
  totalWeightGm: number;
  /**
   * On-hand material split by product type — the "total gold / total silver"
   * breakdown behind the inventory analytics. Grams, unit-normalized like
   * `totalWeightGm`; types with zero weighted stock are omitted and the list
   * is sorted heaviest-first.
   */
  weightByTypeGm: { type: string; weightGm: number }[];
  /** Sum of `stock * purchase_price` — capital tied up in inventory. */
  stockValuationPurchase: number;
  /** Sum of `stock * selling_price` — retail value of current inventory. */
  stockValuationSelling: number;
  /** Distinct SKUs that are in stock (`stock > low_stock_threshold`). */
  inStockCount: number;
  /** Distinct SKUs at or below their threshold (still > 0). */
  lowStockCount: number;
  /** Distinct SKUs with `stock <= 0`. */
  outOfStockCount: number;
  /** Products with a non-empty barcode (for the "barcode coverage" tile). */
  withBarcodeCount: number;
};

/** A single slice of the inventory pie — per category totals. */
export type CategoryBreakdown = {
  /** Category name (empty string → uncategorized). */
  category: string;
  /** Number of distinct SKUs in this category. */
  skuCount: number;
  /** Sum of `stock` in this category. */
  units: number;
  /** Sum of `stock * weight` in **grams** (weight-unit normalized). */
  weightGm: number;
  /** Sum of `stock * selling_price` for this category. */
  value: number;
  /** Pie slice color (deterministic from the category name). */
  color: string;
};

/**
 * Header aggregates for the products page — computed in a single round trip so
 * the page renders instantly with the list. Mirrors `getDashboard` shape but
 * scoped to the catalog (no invoices/sales).
 */
export async function getInventoryStats(db: DbClient): Promise<InventoryStats> {
  // Single aggregate query — Postgres can fold all of these into one scan.
  const rows = await db
    .select({
      // Aliases are MANDATORY: Neon's HTTP rows are objects, so unaliased
      // fragments sharing a PG column name ("coalesce", "count") silently
      // collapse to the LAST one's value. See db/client.ts guard.
      totalSkus: sql<number>`count(*)::int`.as("total_skus"),
      totalUnits: sql<number>`coalesce(sum(${schema.products.stock}), 0)::double precision`.as("total_units"),
      totalWeightGm: sql<number>`coalesce(sum(${schema.products.stock} * (${weightGmSql})), 0)::double precision`.as("total_weight_gm"),
      stockValuationPurchase: sql<number>`coalesce(sum(${schema.products.stock} * ${schema.products.purchasePrice}), 0)::double precision`.as("stock_valuation_purchase"),
      stockValuationSelling: sql<number>`coalesce(sum(${schema.products.stock} * ${effectivePriceSql}), 0)::double precision`.as("stock_valuation_selling"),
      inStockCount: sql<number>`count(*) filter (where ${schema.products.stock} > ${schema.products.lowStockThreshold})::int`.as("in_stock_count"),
      lowStockCount: sql<number>`count(*) filter (where ${schema.products.stock} > 0 and ${schema.products.stock} <= ${schema.products.lowStockThreshold})::int`.as("low_stock_count"),
      outOfStockCount: sql<number>`count(*) filter (where ${schema.products.stock} <= 0)::int`.as("out_of_stock_count"),
      withBarcodeCount: sql<number>`count(*) filter (where ${schema.products.barcode} is not null and length(${schema.products.barcode}) > 0)::int`.as("with_barcode_count"),
    })
    .from(schema.products);
  // Per-type material split — the same math as totalWeightGm, grouped by type.
  const typeRows = await db
    .select({
      type: schema.products.type,
      weightGm: sql<number>`coalesce(sum(${schema.products.stock} * (${weightGmSql})), 0)::double precision`.as("weight_gm"),
    })
    .from(schema.products)
    .groupBy(schema.products.type)
    .orderBy(desc(sql`coalesce(sum(${schema.products.stock} * (${weightGmSql})), 0)`));
  const row = rows[0];
  return {
    totalSkus: row?.totalSkus ?? 0,
    totalUnits: row?.totalUnits ?? 0,
    totalWeightGm: row?.totalWeightGm ?? 0,
    weightByTypeGm: typeRows
      .filter((r) => r.weightGm > 0)
      .map((r) => ({ type: r.type, weightGm: r.weightGm })),
    stockValuationPurchase: row?.stockValuationPurchase ?? 0,
    stockValuationSelling: row?.stockValuationSelling ?? 0,
    inStockCount: row?.inStockCount ?? 0,
    lowStockCount: row?.lowStockCount ?? 0,
    outOfStockCount: row?.outOfStockCount ?? 0,
    withBarcodeCount: row?.withBarcodeCount ?? 0,
  };
}

/**
 * Pie chart data for the products page — per-category inventory value.
 * Drives the donut on the redesigned desktop inventory page. Categories with
 * no products are omitted; the uncategorized bucket (no `categoryId`) is
 * surfaced under "Uncategorized" so the pie always sums to 100% of value.
 */
export async function getCategoryBreakdown(db: DbClient): Promise<CategoryBreakdown[]> {
  const rows = await db
    .select({
      // Every fragment aliased — unaliased coalesce/count columns collapse in
      // the Neon object-row transport (category used to come back as `value`).
      category: sql<string>`coalesce(${schema.categories.name}, 'Uncategorized')`.as("category"),
      skuCount: sql<number>`count(${schema.products.id})::int`.as("sku_count"),
      units: sql<number>`coalesce(sum(${schema.products.stock}), 0)::double precision`.as("units"),
      weightGm: sql<number>`coalesce(sum(${schema.products.stock} * (${weightGmSql})), 0)::double precision`.as("weight_gm"),
      value: sql<number>`coalesce(sum(${schema.products.stock} * ${effectivePriceSql}), 0)::double precision`.as("value"),
    })
    .from(schema.products)
    .leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
    .groupBy(schema.categories.name)
    .orderBy(desc(sql`coalesce(sum(${schema.products.stock} * ${effectivePriceSql}), 0)`));

  return rows.map((r, i) => ({
    category: r.category ?? "Uncategorized",
    skuCount: r.skuCount,
    units: r.units,
    weightGm: r.weightGm,
    value: r.value,
    color: categoryColor(r.category ?? "Uncategorized", i),
  }));
}

/** Deterministic colour per category — keeps the donut slices stable across reloads. */
function categoryColor(name: string, index: number): string {
  // Matches the Tailwind theme chart tokens the dashboard pie uses, plus a
  // neutral fallback for the uncategorized bucket.
  const palette = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
    "var(--chart-foreground-muted)",
  ] as const;
  // Stable hash → palette index so the same category always gets the same hue.
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  if (name === "Uncategorized") {
    return palette[palette.length - 1]!;
  }
  const idx = hash % (palette.length - 1);
  // Keep `index` in the signature (used by future debugging) without affecting
  // the deterministic colour assignment.
  void index;
  return palette[idx] ?? palette[0]!;
}

/* ── Lookup resolvers (colors, sizes, categories) ─────────────── */

export async function resolveColorId(db: DbClient, name: string): Promise<string> {
  const trimmed = name.trim();
  const existing = await db.query.colors.findFirst({ where: eq(schema.colors.name, trimmed) });
  if (existing) return existing.id;
  const [created] = await db.insert(schema.colors).values({ name: trimmed }).returning();
  if (!created) throw new Error(`Failed to create color "${trimmed}"`);
  return created.id;
}

export async function resolveSizeId(db: DbClient, name: string): Promise<string> {
  const trimmed = name.trim();
  const existing = await db.query.sizes.findFirst({ where: eq(schema.sizes.name, trimmed) });
  if (existing) return existing.id;
  const [created] = await db.insert(schema.sizes).values({ name: trimmed }).returning();
  if (!created) throw new Error(`Failed to create size "${trimmed}"`);
  return created.id;
}

export async function resolveCategoryId(db: DbClient, name: string): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const existing = await db.query.categories.findFirst({ where: eq(schema.categories.name, trimmed) });
  if (existing) return existing.id;
  const [created] = await db.insert(schema.categories).values({ name: trimmed }).returning();
  if (!created) throw new Error(`Failed to create category "${trimmed}"`);
  return created.id;
}

/* ── Product queries ──────────────────────────────────────────── */

export type ProductFilters = {
  search?: string;
  type?: string;
  color?: string;
  size?: string;
  category?: string;
  status?: "in_stock" | "low_stock" | "out_of_stock" | "all";
  /** Price-mode filter — "auto"/"manual" narrows, "all"/undefined matches everything. */
  priceMode?: "auto" | "manual" | "all";
  page?: number;
  pageSize?: number;
};

export type ProductWithMeta = schema.Product & {
  colorName: string | null;
  sizeName: string | null;
  categoryName: string | null;
} & ProductComputedPricing;

/* ── Gold pricing (dynamic karat-wise prices) ─────────────────── */

/**
 * Dynamic gold pricing, expressed ONCE for SQL so every list, aggregate and
 * report agrees with the form preview (which uses the same formula from
 * `pricing/gold.ts`).
 *
 * The rate lookup is a correlated subquery (not a join) so the expression can
 * be dropped into any query over `products` — including the aggregates below —
 * without touching their joins. `gold_rates` holds at most 25 rows.
 */

/**
 * Effective ₹/gram for a product's karat — the SQL twin of
 * `resolveGoldRateTable` + `rateForKarat` (pricing/gold.ts):
 *
 *   1. quoted row: `gold_rates` where `is_custom` and rate > 0 for this karat
 *   2. DERIVED: every un-quoted karat scales off the base (highest quoted
 *      karat): `rate(k) = round2(baseRate × k ÷ baseKarat)`
 *   3. nothing quoted yet → 0 (products fall back to their stored price)
 */
const quotedRateSql = sql<number>`(
  select gr.rate_per_gram from gold_rates gr
  where gr.karat = ${schema.products.goldKarat} and gr.is_custom and gr.rate_per_gram > 0
  limit 1
)`;
const baseRateSql = sql<number>`(select b.rate_per_gram from gold_rates b where b.is_custom and b.rate_per_gram > 0 order by b.karat desc limit 1)`;
const baseKaratSql = sql<number>`(select b.karat from gold_rates b where b.is_custom and b.rate_per_gram > 0 order by b.karat desc limit 1)`;

export const goldRatePerGramSql = sql<number>`coalesce(
  ${quotedRateSql},
  case
    when ${schema.products.goldKarat} is not null
      and ${baseKaratSql} is not null and ${baseKaratSql} > 0
      and ${baseRateSql} > 0
    then round((${baseRateSql} * ${schema.products.goldKarat} / ${baseKaratSql})::numeric, 2)::double precision
    else 0
  end
)`;

/** Effective silver ₹/gram — the product's OWN `silver_rate_per_gram` when
 *  set, else the shop-wide settings value. SQL twin of the silver branch's
 *  rate lookup in `priceProduct` (a global silver change recalculates every
 *  product without a custom rate on the very next read). 0 → never prices. */
export const silverRatePerGramSql = sql<number>`coalesce(
  ${schema.products.silverRatePerGram},
  (select s.silver_rate_per_gram from settings s limit 1),
  0
)`;

/** Product weight in grams — `weight` is stored in `weightUnit` (mg or gm). */
export const weightGmSql = sql<number>`(case when ${schema.products.weightUnit} = 'mg' then coalesce(${schema.products.weight}, 0) / 1000.0 else coalesce(${schema.products.weight}, 0) end)`;

/**
 * NET weight in grams — the gold auto-price basis, the SQL twin of
 * `parseNetWeight` + `weightToGrams` (pricing/gold.ts). `net_weight` is free
 * text ("9.850 gm"), so: strip every non-digit/dot char, then reject
 * exactly the inputs TS `Number()` can't parse — empty, more than one dot,
 * or no digit at all — before casting. Kept in lockstep with the TS engine
 * and proven by `scripts/verify-pricing.ts`.
 */
const netWeightCleanSql = sql<string>`nullif(regexp_replace(coalesce(${schema.products.netWeight}, ''), '[^0-9.]', '', 'g'), '')`;
const netWeightParsedSql = sql<number | null>`(
  case
    when ${netWeightCleanSql} is null then null
    when length(${netWeightCleanSql}) - length(replace(${netWeightCleanSql}, '.', '')) > 1 then null
    when ${netWeightCleanSql} !~ '[0-9]' then null
    else ${netWeightCleanSql}::double precision
  end
)`;
const netWeightGmSql = sql<number | null>`(case when ${schema.products.weightUnit} = 'mg' then ${netWeightParsedSql} / 1000.0 else ${netWeightParsedSql} end)`;

/** Silver purity %, clamped exactly like `priceProduct` (>0 → min(s,100), else 100). */
const silverPercentSql = sql<number>`(case when coalesce(${schema.products.silverPercentage}, 100) > 0 then least(${schema.products.silverPercentage}, 100) else 100 end)`;

/**
 * Flat ₹ charge columns — SQL twin of `parseCharge` (pricing/product.ts):
 * strip everything but digits/dots, reject what `Number()` can't parse
 * (empty, multiple dots, no digit), then 0 when ≤ 0. Kept in lockstep with
 * the TS engine and proven by `scripts/verify-pricing.ts`.
 */
function chargeSql(raw: SQLWrapper) {
  const cleaned = sql<string | null>`nullif(regexp_replace(coalesce(${raw}, ''), '[^0-9.]', '', 'g'), '')`;
  return sql<number>`coalesce(
    case
      when ${cleaned} is null then null
      when length(${cleaned}) - length(replace(${cleaned}, '.', '')) > 1 then null
      when ${cleaned} !~ '[0-9]' then null
      when ${cleaned}::double precision <= 0 then null
      else round(${cleaned}::numeric, 2)::double precision
    end,
    0
  )`;
}
/** Flat ₹ nag charge (gold only) — free-text column parsed like a number. */
const nagChargeSql = chargeSql(schema.products.nagRate);
/** Flat ₹ charge from a NUMERIC column — no free-text parsing (the `''`
 *  literal the text parser coalesces would 22P02 on double precision). */
function numericChargeSql(raw: SQLWrapper) {
  return sql<number>`coalesce(
    case
      when ${raw} is null then null
      when ${raw} <= 0 then null
      else round((${raw})::numeric, 2)::double precision
    end,
    0
  )`;
}
/** Flat ₹ povayi charge (gold + silver). */
const povayiChargeSql = numericChargeSql(schema.products.povayiRate);
/** Flat ₹ other charges (gold + silver). */
const otherChargeSql = numericChargeSql(schema.products.otherCharges);

/** Shop default labour for GOLD products (settings singleton). */
const defaultLabourTypeSql = sql<string>`coalesce((select s.default_labour_type from settings s limit 1), 'PERCENT')`;
const defaultLabourValueSql = sql<number>`coalesce((select s.default_labour_value from settings s limit 1), 0)`;

/**
 * Metal values (the labour PERCENT basis) — `priceProduct` rounds the metal
 * value to paisa BEFORE applying labour, so the SQL twin rounds here too.
 * Gold uses the NET weight basis; silver keeps the gross weight.
 */
const goldMetalSql = sql<number>`round((${netWeightGmSql} * ${goldRatePerGramSql})::numeric, 2)::double precision`;
const silverMetalSql = sql<number>`round((${weightGmSql} * (${silverPercentSql} / 100.0) * ${silverRatePerGramSql})::numeric, 2)::double precision`;

/** `round2` in SQL: `Math.round(x * 100) / 100` (pricing/gold.ts). */
function round2Sql(expr: ReturnType<typeof sql<number>>) {
  return sql<number>`round((${expr})::numeric, 2)::double precision`;
}

/** ₹/gram × NET weight (gold) or gross weight (silver), the PER_GRAM labour basis. */
const goldPerGramLabourSql = round2Sql(sql<number>`${netWeightGmSql} * ${schema.products.labourValue}`);
const silverPerGramLabourSql = round2Sql(sql<number>`${weightGmSql} * ${schema.products.labourValue}`);
const defaultPerGramLabourSql = round2Sql(sql<number>`${netWeightGmSql} * ${defaultLabourValueSql}`);
/** % of the (already rounded) metal value — the PERCENT labour basis. */
const goldPercentLabourSql = round2Sql(sql<number>`${goldMetalSql} * ${schema.products.labourValue} / 100.0`);
const silverPercentLabourSql = round2Sql(sql<number>`${silverMetalSql} * ${schema.products.labourValue} / 100.0`);
const defaultPercentLabourSql = round2Sql(sql<number>`${goldMetalSql} * ${defaultLabourValueSql} / 100.0`);

/**
 * Labour amount for GOLD: the product's own config when `labour_value` is
 * set, otherwise the shop default (`settings.default_labour_*`).
 * Same three methods as `computeLabour` in pricing/labour.ts, including its
 * `value <= 0 → ₹0` guard (never a negative labour, never a zero value that
 * silently switches to the shop default).
 */
const goldLabourSql = sql<number>`(
  case
    when ${schema.products.labourValue} is not null then
      case
        when ${schema.products.labourValue} <= 0 then 0
        when ${schema.products.labourType} = 'FIXED' then ${round2Sql(sql<number>`${schema.products.labourValue}`)}
        when ${schema.products.labourType} = 'PER_GRAM' then ${goldPerGramLabourSql}
        else ${goldPercentLabourSql}
      end
    else
      case
        when ${defaultLabourValueSql} <= 0 then 0
        when ${defaultLabourTypeSql} = 'FIXED' then ${round2Sql(defaultLabourValueSql)}
        when ${defaultLabourTypeSql} = 'PER_GRAM' then ${defaultPerGramLabourSql}
        else ${defaultPercentLabourSql}
      end
  end
)`;

/**
 * Labour amount for SILVER — strictly per product (no shop default): an unset
 * `labour_value` means ₹0 labour, and `value <= 0` is ₹0 exactly like
 * `computeLabour` guards it.
 */
const silverLabourSql = sql<number>`(
  case
    when ${schema.products.labourValue} is null then 0
    when ${schema.products.labourValue} <= 0 then 0
    when ${schema.products.labourType} = 'FIXED' then ${round2Sql(sql<number>`${schema.products.labourValue}`)}
    when ${schema.products.labourType} = 'PER_GRAM' then ${silverPerGramLabourSql}
    else ${silverPercentLabourSql}
  end
)`;

/**
 * Auto price — the SQL twin of `priceProduct` (pricing/product.ts):
 *
 *   Gold  (auto + karat + rate>0 + NET weight parsed>0)
 *     → round2(goldMetal + goldLabour + nag + povayi + other)
 *   Silver(auto + effective silver rate>0 + weight>0)
 *     → round2(silverMetal + silverLabour + povayi + other)
 *     (nag is gold-only; the rate is product-silver ?? shop-silver)
 *   anything else → NULL (callers fall back to `sellingPrice`, never ₹0)
 *
 * Expressed ONCE so every list, aggregate and report agrees with the form
 * preview; `scripts/verify-pricing.ts` proves the two implementations match.
 * The rate lookups are correlated subqueries (not joins) so the expression
 * can be dropped into any query over `products`. `gold_rates` ≤ 25 rows and
 * `settings` is a single row — both cheap.
 */
export const autoPriceSql = sql<number | null>`(
  case
    when ${schema.products.type} = 'Gold'
      and ${schema.products.priceMode} = 'auto'
      and ${schema.products.goldKarat} is not null
      and ${goldRatePerGramSql} > 0
      and ${netWeightGmSql} > 0
    then round((${goldMetalSql} + ${goldLabourSql} + ${nagChargeSql} + ${povayiChargeSql} + ${otherChargeSql})::numeric, 2)::double precision
    when ${schema.products.type} = 'Silver'
      and ${schema.products.priceMode} = 'auto'
      and ${silverRatePerGramSql} > 0
      and ${weightGmSql} > 0
    then round((${silverMetalSql} + ${silverLabourSql} + ${povayiChargeSql} + ${otherChargeSql})::numeric, 2)::double precision
    else null
  end
)`;

/** THE price: the computed auto price when available, else the stored one. */
export const effectivePriceSql = sql<number>`coalesce(${autoPriceSql}, ${schema.products.sellingPrice})`;

/** SQL-computed pricing columns — present on every product query row. */
export type ProductComputedPricing = {
  /** Effective ₹/gram for the product's karat (0 when not karat-priced). */
  goldRatePerGram: number;
  /** Effective silver ₹/gram the silver branch used — product override ?? shop
   *  rate (0 → silver not priced). The RAW per-product rate rides along as
   *  `productSilverRatePerGram` for form round-trips. */
  silverRatePerGram: number;
  /** RAW per-product silver ₹/gram column (null → follow the shop rate). */
  productSilverRatePerGram: number | null;
  /** Computed auto price (null when not auto-priced). */
  autoPrice: number | null;
  /** `autoPrice ?? sellingPrice`. */
  effectivePrice: number;
};

const PRODUCT_SELECT = {
  id: schema.products.id,
  sku: schema.products.sku,
  name: schema.products.name,
  type: schema.products.type,
  barcode: schema.products.barcode,
  weight: schema.products.weight,
  weightUnit: schema.products.weightUnit,
  grossWeight: schema.products.grossWeight,
  nagUnit: schema.products.nagUnit,
  nagLessWeight: schema.products.nagLessWeight,
  nagRate: schema.products.nagRate,
  chejatWeight: schema.products.chejatWeight,
  netWeight: schema.products.netWeight,
  purity: schema.products.purity,
  imageUrl: schema.products.imageUrl,
  stock: schema.products.stock,
  purchasePrice: schema.products.purchasePrice,
  sellingPrice: schema.products.sellingPrice,
  silverPercentage: schema.products.silverPercentage,
  /** RAW per-product silver rate (null → follow the shop rate). */
  productSilverRatePerGram: schema.products.silverRatePerGram,
  povayiRate: schema.products.povayiRate,
  otherCharges: schema.products.otherCharges,
  goldKarat: schema.products.goldKarat,
  labourType: schema.products.labourType,
  labourValue: schema.products.labourValue,
  priceMode: schema.products.priceMode,
  notes: schema.products.notes,
  lowStockThreshold: schema.products.lowStockThreshold,
  colorId: schema.products.colorId,
  sizeId: schema.products.sizeId,
  categoryId: schema.products.categoryId,
  createdAt: schema.products.createdAt,
  updatedAt: schema.products.updatedAt,
  // Dynamic gold pricing — computed, never stored.
  goldRatePerGram: goldRatePerGramSql.as("gold_rate_per_gram"),
  silverRatePerGram: silverRatePerGramSql.as("effective_silver_rate_per_gram"),
  autoPrice: autoPriceSql.as("auto_price"),
  effectivePrice: effectivePriceSql.as("effective_price"),
} as const;

export async function listProducts(db: DbClient, filters: ProductFilters = {}) {
  const search = filters.search?.trim() || "";
  const type = filters.type && filters.type !== "all" ? filters.type : undefined;
  const color = filters.color && filters.color !== "all" ? filters.color : undefined;
  const size = filters.size && filters.size !== "all" ? filters.size : undefined;
  const category = filters.category && filters.category !== "all" ? filters.category : undefined;
  const status = filters.status && filters.status !== "all" ? filters.status : undefined;
  const priceMode = filters.priceMode && filters.priceMode !== "all" ? filters.priceMode : undefined;
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.max(1, Math.min(1000, filters.pageSize || 20));

  const conditions = [];
  if (search) {
    conditions.push(
      or(
        ilike(schema.products.name, `%${search}%`),
        ilike(schema.products.sku, `%${search}%`),
        ilike(schema.products.barcode, `%${search}%`),
        sql`exists (select 1 from ${schema.colors} c where c.id = ${schema.products.colorId} and c.name ilike ${`%${search}%`})`,
        sql`exists (select 1 from ${schema.sizes} s where s.id = ${schema.products.sizeId} and s.name ilike ${`%${search}%`})`,
        sql`exists (select 1 from ${schema.categories} ct where ct.id = ${schema.products.categoryId} and ct.name ilike ${`%${search}%`})`,
      ),
    );
  }
  if (color) conditions.push(sql`exists (select 1 from ${schema.colors} c where c.id = ${schema.products.colorId} and c.name = ${color})`);
  if (size) conditions.push(sql`exists (select 1 from ${schema.sizes} s where s.id = ${schema.products.sizeId} and s.name = ${size})`);
  if (category) conditions.push(sql`exists (select 1 from ${schema.categories} ct where ct.id = ${schema.products.categoryId} and ct.name = ${category})`);
  if (type) conditions.push(eq(schema.products.type, type));
  if (priceMode) conditions.push(eq(schema.products.priceMode, priceMode));

  const threshold = sql`${schema.products.lowStockThreshold}`;
  if (status === "in_stock") conditions.push(sql`${schema.products.stock} > ${threshold}`);
  if (status === "low_stock") conditions.push(and(sql`${schema.products.stock} > 0`, sql`${schema.products.stock} <= ${threshold}`));
  if (status === "out_of_stock") conditions.push(sql`${schema.products.stock} <= 0`);

  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, total] = await Promise.all([
    db
      .select({
        ...PRODUCT_SELECT,
        colorName: sql<string | null>`${schema.colors.name}`.as("color_name"),
        sizeName: sql<string | null>`${schema.sizes.name}`.as("size_name"),
        categoryName: sql<string | null>`${schema.categories.name}`.as("category_name"),
      })
      .from(schema.products)
      .leftJoin(schema.colors, eq(schema.colors.id, schema.products.colorId))
      .leftJoin(schema.sizes, eq(schema.sizes.id, schema.products.sizeId))
      .leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
      .where(where)
      .orderBy(desc(schema.products.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.products)
      .where(where)
      .then((r) => r[0]?.count ?? 0),
  ]);

  return {
    products: rows,
    pagination: { page, pageSize, totalCount: total, totalPages: Math.ceil(total / pageSize) },
  };
}

export async function getProduct(db: DbClient, id: string) {
  const row = await db
    .select({
      ...PRODUCT_SELECT,
      colorName: sql<string | null>`${schema.colors.name}`.as("color_name"),
      sizeName: sql<string | null>`${schema.sizes.name}`.as("size_name"),
      categoryName: sql<string | null>`${schema.categories.name}`.as("category_name"),
    })
    .from(schema.products)
    .leftJoin(schema.colors, eq(schema.colors.id, schema.products.colorId))
    .leftJoin(schema.sizes, eq(schema.sizes.id, schema.products.sizeId))
    .leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
    .where(eq(schema.products.id, id));
  return row[0] ?? null;
}

export async function listAllProducts(db: DbClient): Promise<ProductWithMeta[]> {
  const rows = await db
    .select({
      ...PRODUCT_SELECT,
      colorName: sql<string | null>`${schema.colors.name}`.as("color_name"),
      sizeName: sql<string | null>`${schema.sizes.name}`.as("size_name"),
      categoryName: sql<string | null>`${schema.categories.name}`.as("category_name"),
    })
    .from(schema.products)
    .leftJoin(schema.colors, eq(schema.colors.id, schema.products.colorId))
    .leftJoin(schema.sizes, eq(schema.sizes.id, schema.products.sizeId))
    .leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
    .orderBy(desc(schema.products.createdAt));
  return rows;
}

/* ── Product mutations ────────────────────────────────────────── */

export type ProductInput = {
  name: string;
  /** Product type: Gold, Silver, Diamond, Platinum, Other. */
  type?: string;
  /** Optional — empty/absent means the product has no color. */
  color?: string;
  size: string;
  category?: string;
  /** Barcode value. `undefined` → keep existing (edit); `""` → clear; else set. */
  barcode?: string;
  /** Weight value — unit determined by `weightUnit` (mg or gm). */
  weight?: number;
  /** Display & calculation unit: "mg" or "gm". */
  weightUnit?: string;
  /** Jewelry-specific weight fields (free text for formulas). */
  grossWeight?: string;
  /** Unit for the nag-less + chejat pair (own toggle). */
  nagUnit?: "mg" | "gm";
  nagLessWeight?: string;
  nagRate?: string;
  chejatWeight?: string;
  netWeight?: string;
  /** Metal purity stamp — e.g. "24K", "22K", "916", "925".
   * `undefined` → keep existing (edit); `""` → clear; else set. */
  purity?: string;
  imageUrl?: string;
  stock?: number;
  purchasePrice?: number;
  sellingPrice?: number;
  /** Silver purity percentage — e.g. 90 means 90% silver content. */
  silverPercentage?: number;
  /** Per-product silver ₹/gram (undefined → keep; null → clear → shop rate). */
  silverRatePerGram?: number | null;
  /** Flat ₹ povayi charge added to the auto price (undefined → keep; null → clear). */
  povayiRate?: number | null;
  /** Flat ₹ other charges added to the auto price (undefined → keep; null → clear). */
  otherCharges?: number | null;
  /** Gold karat 0–24 (null → clear the karat / not karat-priced). */
  goldKarat?: number | null;
  /** Labour method: PERCENT (% of metal), FIXED (₹) or PER_GRAM (₹/g). */
  labourType?: "PERCENT" | "FIXED" | "PER_GRAM";
  /** Labour rate/amount (null → unset: gold falls back to shop default,
   *  silver gets no labour; undefined → keep existing on edit). */
  labourValue?: number | null;
  /** "auto" opts this metal product into dynamic pricing; "manual" uses sellingPrice. */
  priceMode?: "auto" | "manual";
  lowStockThreshold?: number;
  notes?: string;
};

export class ProductError extends Error {
  constructor(message: string, public code: string, public status = 400) {
    super(message);
  }
}

/** Karat from an untrusted value (form/API/DB) — null when absent or out of range. */
function normalizeGoldKarat(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return isGoldKarat(value) ? value : null;
}

/** Labour rate/amount — clamped to ≥ 0 (round2); null means "not configured". */
function normalizeLabourValue(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return round2(value);
}

/** Flat ₹ charge / per-product silver rate — ≥ 0 (round2); null → cleared. */
function normalizeChargeValue(value: number | null | undefined): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return round2(value);
}

/** Labour method — anything untrusted becomes PERCENT (the schema default). */
function normalizeLabourType(value: string | undefined): "PERCENT" | "FIXED" | "PER_GRAM" {
  return value === "FIXED" || value === "PER_GRAM" ? value : "PERCENT";
}

export async function createProduct(db: DbClient, input: ProductInput) {
  const [sku, barcode, colorId, sizeId, categoryId] = await Promise.all([
    generateSku(async (sku) => {
      const r = await db.select({ id: schema.products.id }).from(schema.products).where(eq(schema.products.sku, sku));
      return r.length > 0;
    }),
    // Every product gets a scannable barcode — auto-generate one when the
    // form doesn't provide it (barcode stays SEPARATE from the SKU).
    (async () => {
      if (input.barcode?.trim()) return input.barcode.trim();
      return generateEan13(async (code) => {
        const r = await db.select({ id: schema.products.id }).from(schema.products).where(eq(schema.products.barcode, code));
        return r.length > 0;
      });
    })(),
    input.color?.trim() ? resolveColorId(db, input.color) : Promise.resolve(null),
    resolveSizeId(db, input.size),
    input.category ? resolveCategoryId(db, input.category) : Promise.resolve(null),
  ]);

  const [product] = await db
    .insert(schema.products)
    .values({
      sku,
      name: input.name.trim(),
      type: input.type?.trim() || "Gold",
      barcode,
      weight: typeof input.weight === "number" && Number.isFinite(input.weight) ? input.weight : null,
      weightUnit: input.weightUnit === "mg" || input.weightUnit === "gm" ? input.weightUnit : "gm",
      grossWeight: input.grossWeight?.trim() || null,
      nagUnit: input.nagUnit === "mg" || input.nagUnit === "gm" ? input.nagUnit : "gm",
      nagLessWeight: input.nagLessWeight?.trim() || null,
      nagRate: input.nagRate?.trim() || null,
      chejatWeight: input.chejatWeight?.trim() || null,
      netWeight: input.netWeight?.trim() || null,
      purity: input.purity?.trim() || null,
      imageUrl: input.imageUrl?.trim() || null,
      stock: input.stock ?? 0,
      purchasePrice: input.purchasePrice ?? 0,
      sellingPrice: input.sellingPrice ?? 0,
      silverPercentage: typeof input.silverPercentage === "number" && input.silverPercentage > 0 ? input.silverPercentage : 100,
      silverRatePerGram: normalizeChargeValue(input.silverRatePerGram),
      povayiRate: normalizeChargeValue(input.povayiRate),
      otherCharges: normalizeChargeValue(input.otherCharges),
      goldKarat: normalizeGoldKarat(input.goldKarat),
      labourType: normalizeLabourType(input.labourType),
      labourValue: normalizeLabourValue(input.labourValue),
      priceMode: input.priceMode === "auto" ? "auto" : "manual",
      lowStockThreshold: input.lowStockThreshold ?? 5,
      notes: input.notes?.trim() || null,
      colorId,
      sizeId,
      categoryId,
    })
    .returning();
  if (!product) throw new ProductError("Failed to create product", "CREATE_FAILED", 500);

  // Initial stock purchase movement
  if ((input.stock ?? 0) > 0) {
    await db.insert(schema.stockMovements).values({
      productId: product.id,
      type: "PURCHASE",
      quantity: input.stock!,
      stockAfter: input.stock!,
      note: "Initial stock",
    });
  }

  await logActivity(db, "PRODUCT_CREATED", `Created "${product.name}" (${product.sku}) with stock ${product.stock}`);
  return getProduct(db, product.id);
}

export async function updateProduct(db: DbClient, id: string, input: ProductInput) {
  const existing = await getProduct(db, id);
  if (!existing) throw new ProductError("Product not found", "NOT_FOUND", 404);

  const [colorId, sizeId, categoryId] = await Promise.all([
    // Empty/absent color clears it; a real value resolves (or creates) the color.
    input.color?.trim() ? resolveColorId(db, input.color) : Promise.resolve(null),
    resolveSizeId(db, input.size),
    input.category ? resolveCategoryId(db, input.category) : Promise.resolve(existing.categoryId),
  ]);

  // undefined → keep the existing barcode (forms that omit the field must not
  // wipe it, e.g. the mobile form which has no barcode input); "" → clear.
  const barcode =
    input.barcode === undefined ? existing.barcode : input.barcode?.trim() || null;

  await db
    .update(schema.products)
    .set({
      name: input.name.trim(),
      type: input.type === undefined ? existing.type : input.type?.trim() || "Gold",
      barcode,
      weight:
        input.weight === undefined
          ? existing.weight
          : typeof input.weight === "number" && Number.isFinite(input.weight)
            ? input.weight
            : null,
      weightUnit: input.weightUnit === "mg" || input.weightUnit === "gm"
        ? input.weightUnit
        : existing.weightUnit ?? "gm",
      grossWeight: input.grossWeight === undefined ? existing.grossWeight : input.grossWeight?.trim() || null,
      nagUnit: input.nagUnit === undefined
        ? existing.nagUnit ?? "gm"
        : input.nagUnit === "mg" || input.nagUnit === "gm"
          ? input.nagUnit
          : "gm",
      nagLessWeight: input.nagLessWeight === undefined ? existing.nagLessWeight : input.nagLessWeight?.trim() || null,
      nagRate: input.nagRate === undefined ? existing.nagRate : input.nagRate?.trim() || null,
      chejatWeight: input.chejatWeight === undefined ? existing.chejatWeight : input.chejatWeight?.trim() || null,
      netWeight: input.netWeight === undefined ? existing.netWeight : input.netWeight?.trim() || null,
      purity: input.purity === undefined ? existing.purity : input.purity?.trim() || null,
      imageUrl: input.imageUrl?.trim() || null,
      stock: input.stock ?? existing.stock,
      purchasePrice: input.purchasePrice ?? existing.purchasePrice,
      sellingPrice: input.sellingPrice ?? existing.sellingPrice,
      silverPercentage: input.silverPercentage === undefined
        ? existing.silverPercentage
        : typeof input.silverPercentage === "number" && input.silverPercentage > 0
          ? input.silverPercentage
          : 100,
      // undefined → keep (legacy forms omit these); null → clear (shop rate
      // / no charge); number → set.
      silverRatePerGram: input.silverRatePerGram === undefined
        ? existing.productSilverRatePerGram
        : normalizeChargeValue(input.silverRatePerGram),
      povayiRate: input.povayiRate === undefined ? existing.povayiRate : normalizeChargeValue(input.povayiRate),
      otherCharges: input.otherCharges === undefined ? existing.otherCharges : normalizeChargeValue(input.otherCharges),
      // undefined → keep (mobile/legacy forms omit metal fields); null → clear.
      goldKarat: input.goldKarat === undefined ? existing.goldKarat : normalizeGoldKarat(input.goldKarat),
      labourType:
        input.labourType === undefined ? existing.labourType : normalizeLabourType(input.labourType),
      labourValue:
        input.labourValue === undefined
          ? existing.labourValue
          : normalizeLabourValue(input.labourValue),
      priceMode:
        input.priceMode === undefined
          ? existing.priceMode
          : input.priceMode === "auto"
            ? "auto"
            : "manual",
      lowStockThreshold: input.lowStockThreshold ?? existing.lowStockThreshold,
      notes: input.notes?.trim() || null,
      colorId,
      sizeId,
      categoryId,
      updatedAt: new Date(),
    })
    .where(eq(schema.products.id, id));

  await logActivity(db, "PRODUCT_UPDATED", `Updated "${existing.name}" (${existing.sku})`);
  return getProduct(db, id);
}

export async function deleteProduct(db: DbClient, id: string) {
  const existing = await getProduct(db, id);
  if (!existing) throw new ProductError("Product not found", "NOT_FOUND", 404);
  await db.delete(schema.products).where(eq(schema.products.id, id));
  await logActivity(db, "PRODUCT_DELETED", `Deleted "${existing.name}" (${existing.sku})`);
  return { success: true };
}

/* ── Stock adjustments with audit trail ───────────────────────── */

export type StockAdjustmentInput = {
  adjustment: number; // can be negative
  reason?: string;
};

export async function adjustStock(db: DbClient, id: string, input: StockAdjustmentInput) {
  if (input.adjustment === 0) throw new ProductError("Adjustment cannot be zero", "INVALID_ADJUSTMENT");
  const existing = await getProduct(db, id);
  if (!existing) throw new ProductError("Product not found", "NOT_FOUND", 404);

  const newStock = existing.stock + input.adjustment;
  if (newStock < 0) throw new ProductError("Adjustment would result in negative stock", "NEGATIVE_STOCK");

  await db
    .update(schema.products)
    .set({ stock: newStock, updatedAt: new Date() })
    .where(eq(schema.products.id, id));
  await db.insert(schema.stockMovements).values({
    productId: id,
    type: "ADJUSTMENT",
    quantity: input.adjustment,
    stockAfter: newStock,
    note: input.reason?.trim() || null,
  });

  await logActivity(
    db,
    "STOCK_ADJUSTED",
    `Adjusted "${existing.name}" (${existing.sku}) by ${input.adjustment > 0 ? "+" : ""}${input.adjustment}${input.reason ? ` — ${input.reason}` : ""}. New stock: ${newStock}`,
  );
  return getProduct(db, id);
}

export async function listStockMovements(db: DbClient, productId?: string, limit = 50) {
  return db
    .select()
    .from(schema.stockMovements)
    .where(productId ? eq(schema.stockMovements.productId, productId) : undefined)
    .orderBy(desc(schema.stockMovements.createdAt))
    .limit(limit);
}

/* ── Barcode lookup & backfill ───────────────────────────────── */

/**
 * Fast exact barcode lookup — the shop-counter path. Indexed on
 * products.barcode; returns the product (with color/size/category names) or
 * null. Use for scanner hits and exact-match search before falling back to
 * fuzzy name/SKU search.
 */
export async function findProductByBarcode(db: DbClient, barcode: string) {
  const code = barcode.replace(/[^0-9A-Za-z]/g, "");
  if (!code) return null;
  const row = await db
    .select({
      ...PRODUCT_SELECT,
      colorName: sql<string | null>`${schema.colors.name}`.as("color_name"),
      sizeName: sql<string | null>`${schema.sizes.name}`.as("size_name"),
      categoryName: sql<string | null>`${schema.categories.name}`.as("category_name"),
    })
    .from(schema.products)
    .leftJoin(schema.colors, eq(schema.colors.id, schema.products.colorId))
    .leftJoin(schema.sizes, eq(schema.sizes.id, schema.products.sizeId))
    .leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
    .where(eq(schema.products.barcode, code))
    .limit(1);
  return row[0] ?? null;
}

/**
 * Looks a product up by EITHER its barcode OR its SKU (case-insensitive) —
 * the counter's fast-entry path on desktop/web billing: type/scan a code,
 * press Enter, get the product. Barcode is matched against both the raw
 * trimmed input and its alphanumeric-only form (so `4006-3813` and
 * `40063813` both hit); SKU is matched trimmed + case-insensitively
 * (`PRD-AB12CD` === `prd-ab12cd`). Keep in lockstep with
 * {@link productMatchesCode}, the in-memory twin used before this fallback.
 */
export async function findProductByCode(db: DbClient, code: string) {
  const trimmed = code.trim();
  if (!trimmed) return null;
  const stripped = trimmed.replace(/[^0-9A-Za-z]/g, "");
  const row = await db
    .select({
      ...PRODUCT_SELECT,
      colorName: sql<string | null>`${schema.colors.name}`.as("color_name"),
      sizeName: sql<string | null>`${schema.sizes.name}`.as("size_name"),
      categoryName: sql<string | null>`${schema.categories.name}`.as("category_name"),
    })
    .from(schema.products)
    .leftJoin(schema.colors, eq(schema.colors.id, schema.products.colorId))
    .leftJoin(schema.sizes, eq(schema.sizes.id, schema.products.sizeId))
    .leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
    .where(
      or(
        eq(schema.products.barcode, stripped),
        eq(schema.products.barcode, trimmed),
        sql`lower(trim(${schema.products.sku})) = lower(${trimmed})`,
      ),
    )
    .limit(1);
  return row[0] ?? null;
}

/**
 * In-memory twin of the barcode/SKU match in {@link findProductByCode} —
 * search an ALREADY-FETCHED product list with the exact same rule the API
 * fallback applies (barcode: raw + alphanumeric-stripped equality; SKU:
 * trimmed + case-insensitive). Keep the two in lockstep.
 */
export function productMatchesCode(
  product: { barcode?: string | null; sku?: string | null },
  code: string,
): boolean {
  const trimmed = code.trim();
  if (!trimmed) return false;
  const stripped = trimmed.replace(/[^0-9A-Za-z]/g, "");
  const barcode = product.barcode ?? "";
  if (barcode && (barcode === trimmed || barcode === stripped)) return true;
  return (product.sku ?? "").trim().toLowerCase() === trimmed.toLowerCase();
}

/**
 * "Update all prices" (Products page action): freezes the CURRENT dynamic
 * price into `selling_price` for every auto-priced metal product.
 *
 * Auto prices are computed on read, so this is a deliberate snapshot — e.g.
 * before quoting a customer from a printed list, or to keep exports and
 * fallbacks on today's price. Rows whose computed price already equals the
 * stored one are skipped (idempotent; safe to re-run).
 */
export async function syncProductPrices(db: DbClient): Promise<{ updated: number; scanned: number }> {
  const [scannedRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.products)
    .where(eq(schema.products.priceMode, "auto"));

  const updated = await db
    .update(schema.products)
    .set({ sellingPrice: effectivePriceSql, updatedAt: new Date() })
    .where(
      and(
        eq(schema.products.priceMode, "auto"),
        sql`${schema.products.sellingPrice} is distinct from ${effectivePriceSql}`,
      ),
    )
    .returning({ id: schema.products.id });

  if (updated.length > 0) {
    await logActivity(
      db,
      "PRODUCT_PRICES_SYNCED",
      `Re-priced ${updated.length} auto product(s) from current gold/silver rates`,
    );
  }
  return { updated: updated.length, scanned: scannedRow?.n ?? 0 };
}


/**
 * Assigns a generated EAN-13 barcode to every product that doesn't have one.
 * Safe backfill for existing data — never touches products that already have
 * a barcode. Returns how many were updated.
 */
export async function backfillBarcodes(db: DbClient): Promise<{ updated: number; total: number }> {
  const missing = await db
    .select({ id: schema.products.id })
    .from(schema.products)
    .where(or(isNull(schema.products.barcode), eq(schema.products.barcode, "")));

  let updated = 0;
  for (const row of missing) {
    const code = await generateEan13(async (code) => {
      const r = await db.select({ id: schema.products.id }).from(schema.products).where(eq(schema.products.barcode, code));
      return r.length > 0;
    });
    await db.update(schema.products).set({ barcode: code }).where(eq(schema.products.id, row.id));
    updated++;
  }

  if (updated > 0) {
    await logActivity(db, "BARCODES_BACKFILLED", `Generated barcodes for ${updated} product(s)`);
  }
  return { updated, total: updated };
}

/* ── Seed sample data ─────────────────────────────────────────── */

export async function seedProducts(db: DbClient) {
  const count = await db.select({ count: sql<number>`count(*)::int` }).from(schema.products);
  if ((count[0]?.count ?? 0) > 0) return { success: false, count: 0 };

  const samples: ProductInput[] = [
    { name: "Gold Necklace Set", color: "Gold", size: "Standard", category: "Jewellery", stock: 12, purchasePrice: 24500, sellingPrice: 32000, lowStockThreshold: 4, weight: 24500 },
    { name: "Silver Anklet", color: "Silver", size: "Small", category: "Jewellery", stock: 30, purchasePrice: 850, sellingPrice: 1250, lowStockThreshold: 8, weight: 18500 },
    { name: "Diamond Ring", color: "White", size: "12", category: "Jewellery", stock: 6, purchasePrice: 38000, sellingPrice: 45500, lowStockThreshold: 2, weight: 3200 },
    { name: "Pearl Earrings", color: "Pearl", size: "Standard", category: "Jewellery", stock: 18, purchasePrice: 3200, sellingPrice: 4600, lowStockThreshold: 5, weight: 4100 },
    { name: "Cotton Kurti", color: "Red", size: "M", category: "Apparel", stock: 25, purchasePrice: 420, sellingPrice: 650, lowStockThreshold: 6, weight: 350000 },
    { name: "Silk Saree", color: "Maroon", size: "Free", category: "Apparel", stock: 9, purchasePrice: 1800, sellingPrice: 2600, lowStockThreshold: 3, weight: 550000 },
    { name: "Brass Diya Set", color: "Brass", size: "Large", category: "Home Decor", stock: 40, purchasePrice: 180, sellingPrice: 320, lowStockThreshold: 10, weight: 750000 },
  ];

  for (const s of samples) await createProduct(db, s);
  await logActivity(db, "SEEDED", "Loaded sample products");
  return { success: true, count: samples.length };
}

export async function listMeta(db: DbClient) {
  const [colorsRows, sizesRows, categoriesRows] = await Promise.all([
    db.select().from(schema.colors).orderBy(schema.colors.name),
    db.select().from(schema.sizes).orderBy(schema.sizes.name),
    db.select().from(schema.categories).orderBy(schema.categories.name),
  ]);
  return {
    colors: colorsRows.map((c) => c.name),
    sizes: sizesRows.map((s) => s.name),
    categories: categoriesRows.map((c) => c.name),
  };
}

export async function addColor(db: DbClient, name: string) {
  const trimmed = name.trim();
  const existing = await db.query.colors.findFirst({ where: eq(schema.colors.name, trimmed) });
  if (existing) throw new ProductError(`Color "${trimmed}" already exists`, "DUPLICATE", 409);
  const [row] = await db.insert(schema.colors).values({ name: trimmed }).returning();
  await logActivity(db, "COLOR_CREATED", `Created color "${trimmed}"`);
  return row;
}

export async function addSize(db: DbClient, name: string) {
  const trimmed = name.trim();
  const existing = await db.query.sizes.findFirst({ where: eq(schema.sizes.name, trimmed) });
  if (existing) throw new ProductError(`Size "${trimmed}" already exists`, "DUPLICATE", 409);
  const [row] = await db.insert(schema.sizes).values({ name: trimmed }).returning();
  await logActivity(db, "SIZE_CREATED", `Created size "${trimmed}"`);
  return row;
}

export async function addCategory(db: DbClient, name: string) {
  const trimmed = name.trim();
  const existing = await db.query.categories.findFirst({ where: eq(schema.categories.name, trimmed) });
  if (existing) throw new ProductError(`Category "${trimmed}" already exists`, "DUPLICATE", 409);
  const [row] = await db.insert(schema.categories).values({ name: trimmed }).returning();
  await logActivity(db, "CATEGORY_CREATED", `Created category "${trimmed}"`);
  return row;
}
