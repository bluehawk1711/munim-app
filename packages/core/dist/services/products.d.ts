import type { DbClient } from "../db/client.js";
import * as schema from "../db/schema.js";
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
export declare function getInventoryStats(db: DbClient): Promise<InventoryStats>;
/**
 * Pie chart data for the products page — per-category inventory value.
 * Drives the donut on the redesigned desktop inventory page. Categories with
 * no products are omitted; the uncategorized bucket (no `categoryId`) is
 * surfaced under "Uncategorized" so the pie always sums to 100% of value.
 */
export declare function getCategoryBreakdown(db: DbClient): Promise<CategoryBreakdown[]>;
export declare function resolveColorId(db: DbClient, name: string): Promise<string>;
export declare function resolveSizeId(db: DbClient, name: string): Promise<string>;
export declare function resolveCategoryId(db: DbClient, name: string): Promise<string | null>;
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
export declare const goldRatePerGramSql: import("drizzle-orm").SQL<number>;
/** Effective silver ₹/gram — the product's OWN `silver_rate_per_gram` when
 *  set, else the shop-wide settings value. SQL twin of the silver branch's
 *  rate lookup in `priceProduct` (a global silver change recalculates every
 *  product without a custom rate on the very next read). 0 → never prices. */
export declare const silverRatePerGramSql: import("drizzle-orm").SQL<number>;
/** Product weight in grams — `weight` is stored in `weightUnit` (mg or gm). */
export declare const weightGmSql: import("drizzle-orm").SQL<number>;
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
export declare const autoPriceSql: import("drizzle-orm").SQL<number | null>;
/** THE price: the computed auto price when available, else the stored one. */
export declare const effectivePriceSql: import("drizzle-orm").SQL<number>;
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
export declare function listProducts(db: DbClient, filters?: ProductFilters): Promise<{
    products: {
        colorName: string | null;
        sizeName: string | null;
        categoryName: string | null;
        id: string;
        sku: string;
        name: string;
        type: string;
        barcode: string | null;
        weight: number | null;
        weightUnit: string;
        grossWeight: string | null;
        nagUnit: "mg" | "gm";
        nagLessWeight: string | null;
        nagRate: string | null;
        chejatWeight: string | null;
        netWeight: string | null;
        purity: string | null;
        imageUrl: string | null;
        stock: number;
        purchasePrice: number;
        sellingPrice: number;
        silverPercentage: number;
        productSilverRatePerGram: number | null;
        povayiRate: number | null;
        otherCharges: number | null;
        goldKarat: number | null;
        labourType: "PER_GRAM" | "PERCENT" | "FIXED";
        labourValue: number | null;
        priceMode: "auto" | "manual";
        notes: string | null;
        lowStockThreshold: number;
        colorId: string | null;
        sizeId: string | null;
        categoryId: string | null;
        createdAt: Date;
        updatedAt: Date;
        goldRatePerGram: number;
        silverRatePerGram: number;
        autoPrice: number | null;
        effectivePrice: number;
    }[];
    pagination: {
        page: number;
        pageSize: number;
        totalCount: number;
        totalPages: number;
    };
}>;
export declare function getProduct(db: DbClient, id: string): Promise<{
    colorName: string | null;
    sizeName: string | null;
    categoryName: string | null;
    id: string;
    sku: string;
    name: string;
    type: string;
    barcode: string | null;
    weight: number | null;
    weightUnit: string;
    grossWeight: string | null;
    nagUnit: "mg" | "gm";
    nagLessWeight: string | null;
    nagRate: string | null;
    chejatWeight: string | null;
    netWeight: string | null;
    purity: string | null;
    imageUrl: string | null;
    stock: number;
    purchasePrice: number;
    sellingPrice: number;
    silverPercentage: number;
    productSilverRatePerGram: number | null;
    povayiRate: number | null;
    otherCharges: number | null;
    goldKarat: number | null;
    labourType: "PER_GRAM" | "PERCENT" | "FIXED";
    labourValue: number | null;
    priceMode: "auto" | "manual";
    notes: string | null;
    lowStockThreshold: number;
    colorId: string | null;
    sizeId: string | null;
    categoryId: string | null;
    createdAt: Date;
    updatedAt: Date;
    goldRatePerGram: number;
    silverRatePerGram: number;
    autoPrice: number | null;
    effectivePrice: number;
} | null>;
export declare function listAllProducts(db: DbClient): Promise<ProductWithMeta[]>;
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
export declare class ProductError extends Error {
    code: string;
    status: number;
    constructor(message: string, code: string, status?: number);
}
export declare function createProduct(db: DbClient, input: ProductInput): Promise<{
    colorName: string | null;
    sizeName: string | null;
    categoryName: string | null;
    id: string;
    sku: string;
    name: string;
    type: string;
    barcode: string | null;
    weight: number | null;
    weightUnit: string;
    grossWeight: string | null;
    nagUnit: "mg" | "gm";
    nagLessWeight: string | null;
    nagRate: string | null;
    chejatWeight: string | null;
    netWeight: string | null;
    purity: string | null;
    imageUrl: string | null;
    stock: number;
    purchasePrice: number;
    sellingPrice: number;
    silverPercentage: number;
    productSilverRatePerGram: number | null;
    povayiRate: number | null;
    otherCharges: number | null;
    goldKarat: number | null;
    labourType: "PER_GRAM" | "PERCENT" | "FIXED";
    labourValue: number | null;
    priceMode: "auto" | "manual";
    notes: string | null;
    lowStockThreshold: number;
    colorId: string | null;
    sizeId: string | null;
    categoryId: string | null;
    createdAt: Date;
    updatedAt: Date;
    goldRatePerGram: number;
    silverRatePerGram: number;
    autoPrice: number | null;
    effectivePrice: number;
} | null>;
export declare function updateProduct(db: DbClient, id: string, input: ProductInput): Promise<{
    colorName: string | null;
    sizeName: string | null;
    categoryName: string | null;
    id: string;
    sku: string;
    name: string;
    type: string;
    barcode: string | null;
    weight: number | null;
    weightUnit: string;
    grossWeight: string | null;
    nagUnit: "mg" | "gm";
    nagLessWeight: string | null;
    nagRate: string | null;
    chejatWeight: string | null;
    netWeight: string | null;
    purity: string | null;
    imageUrl: string | null;
    stock: number;
    purchasePrice: number;
    sellingPrice: number;
    silverPercentage: number;
    productSilverRatePerGram: number | null;
    povayiRate: number | null;
    otherCharges: number | null;
    goldKarat: number | null;
    labourType: "PER_GRAM" | "PERCENT" | "FIXED";
    labourValue: number | null;
    priceMode: "auto" | "manual";
    notes: string | null;
    lowStockThreshold: number;
    colorId: string | null;
    sizeId: string | null;
    categoryId: string | null;
    createdAt: Date;
    updatedAt: Date;
    goldRatePerGram: number;
    silverRatePerGram: number;
    autoPrice: number | null;
    effectivePrice: number;
} | null>;
export declare function deleteProduct(db: DbClient, id: string): Promise<{
    success: boolean;
}>;
export type StockAdjustmentInput = {
    adjustment: number;
    reason?: string;
};
export declare function adjustStock(db: DbClient, id: string, input: StockAdjustmentInput): Promise<{
    colorName: string | null;
    sizeName: string | null;
    categoryName: string | null;
    id: string;
    sku: string;
    name: string;
    type: string;
    barcode: string | null;
    weight: number | null;
    weightUnit: string;
    grossWeight: string | null;
    nagUnit: "mg" | "gm";
    nagLessWeight: string | null;
    nagRate: string | null;
    chejatWeight: string | null;
    netWeight: string | null;
    purity: string | null;
    imageUrl: string | null;
    stock: number;
    purchasePrice: number;
    sellingPrice: number;
    silverPercentage: number;
    productSilverRatePerGram: number | null;
    povayiRate: number | null;
    otherCharges: number | null;
    goldKarat: number | null;
    labourType: "PER_GRAM" | "PERCENT" | "FIXED";
    labourValue: number | null;
    priceMode: "auto" | "manual";
    notes: string | null;
    lowStockThreshold: number;
    colorId: string | null;
    sizeId: string | null;
    categoryId: string | null;
    createdAt: Date;
    updatedAt: Date;
    goldRatePerGram: number;
    silverRatePerGram: number;
    autoPrice: number | null;
    effectivePrice: number;
} | null>;
export declare function listStockMovements(db: DbClient, productId?: string, limit?: number): Promise<{
    id: string;
    productId: string;
    type: "PURCHASE" | "SALE" | "ADJUSTMENT" | "RETURN" | "WASTE";
    quantity: number;
    stockAfter: number;
    referenceType: string | null;
    referenceId: string | null;
    note: string | null;
    createdAt: Date;
}[]>;
/**
 * Fast exact barcode lookup — the shop-counter path. Indexed on
 * products.barcode; returns the product (with color/size/category names) or
 * null. Use for scanner hits and exact-match search before falling back to
 * fuzzy name/SKU search.
 */
export declare function findProductByBarcode(db: DbClient, barcode: string): Promise<{
    colorName: string | null;
    sizeName: string | null;
    categoryName: string | null;
    id: string;
    sku: string;
    name: string;
    type: string;
    barcode: string | null;
    weight: number | null;
    weightUnit: string;
    grossWeight: string | null;
    nagUnit: "mg" | "gm";
    nagLessWeight: string | null;
    nagRate: string | null;
    chejatWeight: string | null;
    netWeight: string | null;
    purity: string | null;
    imageUrl: string | null;
    stock: number;
    purchasePrice: number;
    sellingPrice: number;
    silverPercentage: number;
    productSilverRatePerGram: number | null;
    povayiRate: number | null;
    otherCharges: number | null;
    goldKarat: number | null;
    labourType: "PER_GRAM" | "PERCENT" | "FIXED";
    labourValue: number | null;
    priceMode: "auto" | "manual";
    notes: string | null;
    lowStockThreshold: number;
    colorId: string | null;
    sizeId: string | null;
    categoryId: string | null;
    createdAt: Date;
    updatedAt: Date;
    goldRatePerGram: number;
    silverRatePerGram: number;
    autoPrice: number | null;
    effectivePrice: number;
} | null>;
/**
 * Looks a product up by EITHER its barcode OR its SKU (case-insensitive) —
 * the counter's fast-entry path on desktop/web billing: type/scan a code,
 * press Enter, get the product. Barcode is matched against both the raw
 * trimmed input and its alphanumeric-only form (so `4006-3813` and
 * `40063813` both hit); SKU is matched trimmed + case-insensitively
 * (`PRD-AB12CD` === `prd-ab12cd`). Keep in lockstep with
 * {@link productMatchesCode}, the in-memory twin used before this fallback.
 */
export declare function findProductByCode(db: DbClient, code: string): Promise<{
    colorName: string | null;
    sizeName: string | null;
    categoryName: string | null;
    id: string;
    sku: string;
    name: string;
    type: string;
    barcode: string | null;
    weight: number | null;
    weightUnit: string;
    grossWeight: string | null;
    nagUnit: "mg" | "gm";
    nagLessWeight: string | null;
    nagRate: string | null;
    chejatWeight: string | null;
    netWeight: string | null;
    purity: string | null;
    imageUrl: string | null;
    stock: number;
    purchasePrice: number;
    sellingPrice: number;
    silverPercentage: number;
    productSilverRatePerGram: number | null;
    povayiRate: number | null;
    otherCharges: number | null;
    goldKarat: number | null;
    labourType: "PER_GRAM" | "PERCENT" | "FIXED";
    labourValue: number | null;
    priceMode: "auto" | "manual";
    notes: string | null;
    lowStockThreshold: number;
    colorId: string | null;
    sizeId: string | null;
    categoryId: string | null;
    createdAt: Date;
    updatedAt: Date;
    goldRatePerGram: number;
    silverRatePerGram: number;
    autoPrice: number | null;
    effectivePrice: number;
} | null>;
/**
 * In-memory twin of the barcode/SKU match in {@link findProductByCode} —
 * search an ALREADY-FETCHED product list with the exact same rule the API
 * fallback applies (barcode: raw + alphanumeric-stripped equality; SKU:
 * trimmed + case-insensitive). Keep the two in lockstep.
 */
export declare function productMatchesCode(product: {
    barcode?: string | null;
    sku?: string | null;
}, code: string): boolean;
/**
 * "Update all prices" (Products page action): freezes the CURRENT dynamic
 * price into `selling_price` for every auto-priced metal product.
 *
 * Auto prices are computed on read, so this is a deliberate snapshot — e.g.
 * before quoting a customer from a printed list, or to keep exports and
 * fallbacks on today's price. Rows whose computed price already equals the
 * stored one are skipped (idempotent; safe to re-run).
 */
export declare function syncProductPrices(db: DbClient): Promise<{
    updated: number;
    scanned: number;
}>;
/**
 * Assigns a generated EAN-13 barcode to every product that doesn't have one.
 * Safe backfill for existing data — never touches products that already have
 * a barcode. Returns how many were updated.
 */
export declare function backfillBarcodes(db: DbClient): Promise<{
    updated: number;
    total: number;
}>;
export declare function seedProducts(db: DbClient): Promise<{
    success: boolean;
    count: number;
}>;
export declare function listMeta(db: DbClient): Promise<{
    colors: string[];
    sizes: string[];
    categories: string[];
}>;
export declare function addColor(db: DbClient, name: string): Promise<{
    id: string;
    name: string;
    createdAt: Date;
} | undefined>;
export declare function addSize(db: DbClient, name: string): Promise<{
    id: string;
    name: string;
    createdAt: Date;
} | undefined>;
export declare function addCategory(db: DbClient, name: string): Promise<{
    id: string;
    name: string;
    createdAt: Date;
} | undefined>;
//# sourceMappingURL=products.d.ts.map