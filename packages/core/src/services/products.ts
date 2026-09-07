import { and, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import * as schema from "../db/schema.js";
import { generateSku } from "../utils/codes.js";
import { generateEan13 } from "../utils/barcode.js";
import { logActivity } from "./activity.js";

/* ── Inventory aggregates (products page header) ──────────────── */

export type InventoryStats = {
  /** Distinct SKUs in the catalog. */
  totalSkus: number;
  /** Sum of `stock` across all products (units, not value). */
  totalUnits: number;
  /** Sum of `stock * weight` in milligrams — total physical material on hand. */
  totalWeightMg: number;
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
  /** Sum of `stock * weight` in milligrams. */
  weightMg: number;
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
      totalSkus: sql<number>`count(*)::int`,
      totalUnits: sql<number>`coalesce(sum(${schema.products.stock}), 0)::double precision`,
      totalWeightMg: sql<number>`coalesce(sum(${schema.products.stock} * coalesce(${schema.products.weight}, 0)), 0)::double precision`,
      stockValuationPurchase: sql<number>`coalesce(sum(${schema.products.stock} * ${schema.products.purchasePrice}), 0)::double precision`,
      stockValuationSelling: sql<number>`coalesce(sum(${schema.products.stock} * ${schema.products.sellingPrice}), 0)::double precision`,
      inStockCount: sql<number>`count(*) filter (where ${schema.products.stock} > ${schema.products.lowStockThreshold})::int`,
      lowStockCount: sql<number>`count(*) filter (where ${schema.products.stock} > 0 and ${schema.products.stock} <= ${schema.products.lowStockThreshold})::int`,
      outOfStockCount: sql<number>`count(*) filter (where ${schema.products.stock} <= 0)::int`,
      withBarcodeCount: sql<number>`count(*) filter (where ${schema.products.barcode} is not null and length(${schema.products.barcode}) > 0)::int`,
    })
    .from(schema.products);
  const row = rows[0];
  return {
    totalSkus: row?.totalSkus ?? 0,
    totalUnits: row?.totalUnits ?? 0,
    totalWeightMg: row?.totalWeightMg ?? 0,
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
      category: sql<string>`coalesce(${schema.categories.name}, 'Uncategorized')`,
      skuCount: sql<number>`count(${schema.products.id})::int`,
      units: sql<number>`coalesce(sum(${schema.products.stock}), 0)::double precision`,
      weightMg: sql<number>`coalesce(sum(${schema.products.stock} * coalesce(${schema.products.weight}, 0)), 0)::double precision`,
      value: sql<number>`coalesce(sum(${schema.products.stock} * ${schema.products.sellingPrice}), 0)::double precision`,
    })
    .from(schema.products)
    .leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
    .groupBy(schema.categories.name)
    .orderBy(desc(sql`coalesce(sum(${schema.products.stock} * ${schema.products.sellingPrice}), 0)`));

  return rows.map((r, i) => ({
    category: r.category ?? "Uncategorized",
    skuCount: r.skuCount,
    units: r.units,
    weightMg: r.weightMg,
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
  color?: string;
  size?: string;
  category?: string;
  status?: "in_stock" | "low_stock" | "out_of_stock" | "all";
  page?: number;
  pageSize?: number;
};

export type ProductWithMeta = schema.Product & {
  colorName: string | null;
  sizeName: string | null;
  categoryName: string | null;
};

const PRODUCT_SELECT = {
  id: schema.products.id,
  sku: schema.products.sku,
  name: schema.products.name,
  barcode: schema.products.barcode,
  weight: schema.products.weight,
  purity: schema.products.purity,
  imageUrl: schema.products.imageUrl,
  stock: schema.products.stock,
  purchasePrice: schema.products.purchasePrice,
  sellingPrice: schema.products.sellingPrice,
  notes: schema.products.notes,
  lowStockThreshold: schema.products.lowStockThreshold,
  colorId: schema.products.colorId,
  sizeId: schema.products.sizeId,
  categoryId: schema.products.categoryId,
  createdAt: schema.products.createdAt,
  updatedAt: schema.products.updatedAt,
} as const;

export async function listProducts(db: DbClient, filters: ProductFilters = {}) {
  const search = filters.search?.trim() || "";
  const color = filters.color && filters.color !== "all" ? filters.color : undefined;
  const size = filters.size && filters.size !== "all" ? filters.size : undefined;
  const category = filters.category && filters.category !== "all" ? filters.category : undefined;
  const status = filters.status && filters.status !== "all" ? filters.status : undefined;
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
  /** Optional — empty/absent means the product has no color. */
  color?: string;
  size: string;
  category?: string;
  /** Barcode value. `undefined` → keep existing (edit); `""` → clear; else set. */
  barcode?: string;
  /** Weight in milligrams (mg). */
  weight?: number;
  /** Metal purity stamp — e.g. "24K", "22K", "916", "925".
   * `undefined` → keep existing (edit); `""` → clear; else set. */
  purity?: string;
  imageUrl?: string;
  stock?: number;
  purchasePrice?: number;
  sellingPrice?: number;
  lowStockThreshold?: number;
  notes?: string;
};

export class ProductError extends Error {
  constructor(message: string, public code: string, public status = 400) {
    super(message);
  }
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
      barcode,
      weight: typeof input.weight === "number" && Number.isFinite(input.weight) ? input.weight : null,
      purity: input.purity?.trim() || null,
      imageUrl: input.imageUrl?.trim() || null,
      stock: input.stock ?? 0,
      purchasePrice: input.purchasePrice ?? 0,
      sellingPrice: input.sellingPrice ?? 0,
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
      barcode,
      weight:
        input.weight === undefined
          ? existing.weight
          : typeof input.weight === "number" && Number.isFinite(input.weight)
            ? input.weight
            : null,
      purity: input.purity === undefined ? existing.purity : input.purity?.trim() || null,
      imageUrl: input.imageUrl?.trim() || null,
      stock: input.stock ?? existing.stock,
      purchasePrice: input.purchasePrice ?? existing.purchasePrice,
      sellingPrice: input.sellingPrice ?? existing.sellingPrice,
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
