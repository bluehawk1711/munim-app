import {
  pgTable,
  text,
  timestamp,
  doublePrecision,
  boolean,
  integer,
  json,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { newId } from "../utils/id.js";
import type { BillTemplateSettings } from "../billing/index.js";

const id = () => text("id").primaryKey().$defaultFn(newId);

/* ────────────────────────────────────────────────────────────────
 * LOOKUPS
 * ──────────────────────────────────────────────────────────────── */

export const colors = pgTable(
  "colors",
  {
    id: id(),
    name: text("name").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("colors_name_idx").on(t.name)],
);

export const sizes = pgTable(
  "sizes",
  {
    id: id(),
    name: text("name").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("sizes_name_idx").on(t.name)],
);

export const categories = pgTable(
  "categories",
  {
    id: id(),
    name: text("name").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("categories_name_idx").on(t.name)],
);

/* ────────────────────────────────────────────────────────────────
 * GOLD RATES (dynamic karat-wise pricing)
 * ──────────────────────────────────────────────────────────────── */

/**
 * The shop's own gold rate table — one row per karat the shop explicitly
 * quotes (see `packages/core/src/pricing/gold.ts`).
 *
 * - `karat` is 0–24 (integer). A karat WITHOUT a row is DERIVED from the
 *   highest quoted karat: `rate(k) = baseRate × k / baseKarat`.
 * - `ratePerGram` is the shop's retail rate for that karat (not scaled again
 *   by purity — Indian jewellers quote a 22K rate directly).
 * - A rate edit re-prices every auto-priced gold product on read (the price is
 *   never materialised on the product row), so old invoices keep their totals.
 */
export const goldRates = pgTable(
  "gold_rates",
  {
    id: id(),
    /** Karat 0–24. */
    karat: integer("karat").notNull(),
    /** Shop's ₹ per gram rate for this karat. */
    ratePerGram: doublePrecision("rate_per_gram").notNull().default(0),
    /** true → quoted by the shop; false → derived from the base karat. */
    isCustom: boolean("is_custom").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("gold_rates_karat_idx").on(t.karat)],
);

/* ────────────────────────────────────────────────────────────────
 * PRODUCTS & STOCK
 * ──────────────────────────────────────────────────────────────── */

export const products = pgTable(
  "products",
  {
    id: id(),
    sku: text("sku").notNull().unique(),
    name: text("name").notNull(),
    /** Product type: Gold, Silver, Diamond, Platinum, Other. */
    type: text("type").notNull().default("Gold"),
    barcode: text("barcode"),
    /** Weight value — unit determined by `weightUnit` (mg or gm). */
    weight: doublePrecision("weight"),
    /** Display & calculation unit: "mg" or "gm". Default "gm". */
    weightUnit: text("weight_unit").notNull().default("gm"),
    /** Jewelry-specific weight fields (free text for formulas like "10+5"). */
    grossWeight: text("gross_weight"),
    /** Unit for the nag-less + chejat pair (own toggle — independent of
     *  `weightUnit`, which covers weight/net weight). */
    nagUnit: text("nag_unit", { enum: ["mg", "gm"] }).notNull().default("gm"),
    nagLessWeight: text("nag_less_weight"),
    /** Flat ₹ nag charge added to the GOLD auto price (a price field, not a
     *  weight — parsed like a number, never part of the weight-unit toggle). */
    nagRate: text("nag_rate"),
    chejatWeight: text("chejat_weight"),
    netWeight: text("net_weight"),
    /** Metal purity stamp — e.g. "24K", "22K", "916", "925". Free text so
     * shops can use whatever hallmark convention they follow. */
    purity: text("purity"),
    imageUrl: text("image_url"),
    stock: doublePrecision("stock").notNull().default(0),
    purchasePrice: doublePrecision("purchase_price").notNull().default(0),
    sellingPrice: doublePrecision("selling_price").notNull().default(0),
    /** Silver purity percentage — e.g. 90 means 90% silver content. Used to
     *  compute effective weight for pricing (weight × silverPercentage / 100). */
    silverPercentage: doublePrecision("silver_percentage").notNull().default(100),
    /** Per-product silver ₹/gram — takes precedence over the shop-wide
     *  `settings.silver_rate_per_gram`. NULL → follow the shop rate (so a
     *  global silver change recalculates every non-custom product live). */
    silverRatePerGram: doublePrecision("silver_rate_per_gram"),
    /** Flat ₹ povayi charge added to the auto price (gold + silver). */
    povayiRate: doublePrecision("povayi_rate"),
    /** Flat ₹ other charges added to the auto price (gold + silver). */
    otherCharges: doublePrecision("other_charges"),
    /** Gold karat 0–24 for dynamic pricing (null → not karat-priced).
     *  Only meaningful when `type` is "Gold". */
    goldKarat: integer("gold_karat"),
    /** Labour-cost METHOD for this product: PERCENT (% of metal value),
     *  FIXED (flat ₹) or PER_GRAM (₹/g × weight). Applies whenever
     *  `labourValue` is set; renamed from the old percent-only column. */
    labourType: text("labour_type", { enum: ["PERCENT", "FIXED", "PER_GRAM"] })
      .notNull()
      .default("PERCENT"),
    /** Labour rate/amount. NULL → Gold falls back to the shop default
     *  (`settings.default_labour_*`); Silver has NO shop default (per-product
     *  only) → unset means no labour. */
    labourValue: doublePrecision("labour_value"),
    /** "auto" → price = metal value (GOLD: net weight × karat rate;
     *  SILVER: weight × purity × silver rate) + labour;
     *  "manual" → price = `sellingPrice` (default keeps legacy behaviour).
     *  Applies to Gold AND Silver (renamed from `gold_price_mode`). */
    priceMode: text("price_mode", { enum: ["auto", "manual"] }).notNull().default("manual"),
    notes: text("notes"),
    lowStockThreshold: doublePrecision("low_stock_threshold").notNull().default(5),
    colorId: text("color_id").references(() => colors.id, { onDelete: "set null" }),
    sizeId: text("size_id").references(() => sizes.id, { onDelete: "set null" }),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("products_name_idx").on(t.name),
    index("products_barcode_idx").on(t.barcode),
    index("products_color_idx").on(t.colorId),
    index("products_size_idx").on(t.sizeId),
    index("products_category_idx").on(t.categoryId),
  ],
);

/** Every change to a product's stock level — a full audit trail. */
export const stockMovements = pgTable(
  "stock_movements",
  {
    id: id(),
    productId: text("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
    type: text("type", { enum: ["PURCHASE", "SALE", "ADJUSTMENT", "RETURN", "WASTE"] }).notNull(),
    quantity: doublePrecision("quantity").notNull(),
    /** Balance after this movement. */
    stockAfter: doublePrecision("stock_after").notNull(),
    referenceType: text("reference_type"), // "invoice" | "sale" | null
    referenceId: text("reference_id"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("stock_movements_product_idx").on(t.productId),
    index("stock_movements_created_idx").on(t.createdAt),
  ],
);

/* ────────────────────────────────────────────────────────────────
 * PARTIES (customers, suppliers, workers — the khata)
 * ──────────────────────────────────────────────────────────────── */

export const parties = pgTable(
  "parties",
  {
    id: id(),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    type: text("type", { enum: ["CUSTOMER", "SUPPLIER", "WORKER", "OTHER"] }).notNull().default("CUSTOMER"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("parties_name_idx").on(t.name)],
);

/**
 * Advances (khata) — two directions:
 *  GIVEN  → money the shop owner handed to the party (they owe us ⇒ receivable)
 *  TAKEN  → money the party handed to the shop owner (we owe them ⇒ payable)
 */
export const advances = pgTable(
  "advances",
  {
    id: id(),
    partyId: text("party_id").references(() => parties.id, { onDelete: "cascade" }).notNull(),
    direction: text("direction", { enum: ["GIVEN", "TAKEN"] }).notNull(),
    amount: doublePrecision("amount").notNull(),
    date: timestamp("date", { withTimezone: true }).defaultNow().notNull(),
    note: text("note"),
    status: text("status", { enum: ["OPEN", "SETTLED"] }).notNull().default("OPEN"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("advances_party_idx").on(t.partyId), index("advances_date_idx").on(t.date)],
);

/* ────────────────────────────────────────────────────────────────
 * INVOICES / BILLS
 * ──────────────────────────────────────────────────────────────── */

export const invoices = pgTable(
  "invoices",
  {
    id: id(),
    invoiceNumber: text("invoice_number").notNull().unique(),
    partyId: text("party_id").references(() => parties.id, { onDelete: "set null" }),
    customerName: text("customer_name"),
    customerPhone: text("customer_phone"),
    customerAddress: text("customer_address"),
    date: timestamp("date", { withTimezone: true }).defaultNow().notNull(),
    status: text("status", { enum: ["DRAFT", "UNPAID", "PARTIAL", "PAID"] }).notNull().default("UNPAID"),
    subtotal: doublePrecision("subtotal").notNull().default(0),
    deliveryCharge: doublePrecision("delivery_charge").notNull().default(0),
    discount: doublePrecision("discount").notNull().default(0),
    /** Material returned by customer — free text weight, e.g. "5gm". */
    materialReturnedWeight: text("material_returned_weight"),
    /** Monetary value of material returned (deducted from total). */
    materialReturnedValue: doublePrecision("material_returned_value").notNull().default(0),
    total: doublePrecision("total").notNull().default(0),
    amountPaid: doublePrecision("amount_paid").notNull().default(0),
    notes: text("notes"),
    /** Snapshot of the shop header used on the printed bill. */
    shopDetails: json("shop_details").$type<{
      name: string;
      address: string;
      phones: string[];
      email: string;
    }>(),
    /** Snapshot of the bill template settings (template, mode, classicColor, twoInOne…). */
    templateSettings: json("template_settings").$type<BillTemplateSettings | null>(),
    /** Gold base ₹/gram used for THIS bill (null → the shop's current rate). */
    goldRate: doublePrecision("gold_rate"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("invoices_party_idx").on(t.partyId),
    index("invoices_date_idx").on(t.date),
    index("invoices_status_idx").on(t.status),
    uniqueIndex("invoices_number_idx").on(t.invoiceNumber),
  ],
);

export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: id(),
    invoiceId: text("invoice_id").references(() => invoices.id, { onDelete: "cascade" }).notNull(),
    productId: text("product_id").references(() => products.id, { onDelete: "set null" }),
    productName: text("product_name").notNull(),
    sku: text("sku"),
    color: text("color"),
    size: text("size"),
    description: text("description"),
    /** Product weight + unit snapshot — drives the bill's WEIGHT column. */
    weight: doublePrecision("weight"),
    weightUnit: text("weight_unit"),
    quantity: doublePrecision("quantity").notNull().default(1),
    price: doublePrecision("price").notNull().default(0),
    total: doublePrecision("total").notNull().default(0),
    /** Frozen pricing inputs at sale time (rate used, labour method + amount,
     *  metal value) so a reprint can explain the number even after gold/silver
     *  rates change. NULL for legacy/manual lines — `price` stays authoritative. */
    pricing: json("pricing").$type<{
      metal: "Gold" | "Silver";
      ratePerGram: number;
      karat?: number | null;
      silverPercentage?: number | null;
      weightGm?: number | null;
      metalValue?: number | null;
      labourType?: string | null;
      labourValue?: number | null;
      labourAmount?: number | null;
    } | null>(),
  },
  (t) => [index("invoice_items_invoice_idx").on(t.invoiceId)],
);

/* ────────────────────────────────────────────────────────────────
 * ORDERS (write down an order now → generate the bill later)
 * ──────────────────────────────────────────────────────────────── */

/**
 * A customer order recorded at the counter. Numbers are a short 4-char code
 * (e.g. "7K2M", shown as ORD-7K2M in UIs); generating a bill maps the lines
 * into an invoice and links it via `invoiceId`.
 */
export const orders = pgTable(
  "orders",
  {
    id: id(),
    /** Short 4-char code, unique — `generateOrderNumber` (codes.ts). */
    orderNumber: text("order_number").notNull().unique(),
    partyId: text("party_id").references(() => parties.id, { onDelete: "set null" }),
    customerName: text("customer_name"),
    customerPhone: text("customer_phone"),
    customerAddress: text("customer_address"),
    status: text("status", { enum: ["OPEN", "COMPLETED", "CANCELLED"] })
      .notNull()
      .default("OPEN"),
    /** When the order was placed (business date). */
    date: timestamp("date", { withTimezone: true }).defaultNow().notNull(),
    subtotal: doublePrecision("subtotal").notNull().default(0),
    deliveryCharge: doublePrecision("delivery_charge").notNull().default(0),
    discount: doublePrecision("discount").notNull().default(0),
    total: doublePrecision("total").notNull().default(0),
    notes: text("notes"),
    /** Set once a bill has been generated from this order. */
    invoiceId: text("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("orders_party_idx").on(t.partyId),
    index("orders_status_idx").on(t.status),
    index("orders_date_idx").on(t.date),
    uniqueIndex("orders_number_idx").on(t.orderNumber),
  ],
);

/** Order lines — same snapshot style as `invoice_items` (no pricing freeze:
 *  an order's price is re-derived at bill time from the current rate). */
export const orderItems = pgTable(
  "order_items",
  {
    id: id(),
    orderId: text("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
    productId: text("product_id").references(() => products.id, { onDelete: "set null" }),
    productName: text("product_name").notNull(),
    sku: text("sku"),
    color: text("color"),
    size: text("size"),
    description: text("description"),
    /** Product weight + unit snapshot — same as `invoice_items` (WEIGHT column). */
    weight: doublePrecision("weight"),
    weightUnit: text("weight_unit"),
    quantity: doublePrecision("quantity").notNull().default(1),
    price: doublePrecision("price").notNull().default(0),
    total: doublePrecision("total").notNull().default(0),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

/** Money moving in or out — against a party and/or an invoice. */
export const payments = pgTable(
  "payments",
  {
    id: id(),
    partyId: text("party_id").references(() => parties.id, { onDelete: "cascade" }),
    invoiceId: text("invoice_id").references(() => invoices.id, { onDelete: "cascade" }),
    /** IN = money received, OUT = money paid out. */
    direction: text("direction", { enum: ["IN", "OUT"] }).notNull(),
    amount: doublePrecision("amount").notNull(),
    method: text("method"), // cash | upi | bank | card
    date: timestamp("date", { withTimezone: true }).defaultNow().notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("payments_party_idx").on(t.partyId),
    index("payments_invoice_idx").on(t.invoiceId),
    index("payments_date_idx").on(t.date),
  ],
);

/* ────────────────────────────────────────────────────────────────
 * JOB LETTERS
 * ──────────────────────────────────────────────────────────────── */

export const jobLetters = pgTable(
  "job_letters",
  {
    id: id(),
    title: text("title").notNull(),
    employeeName: text("employee_name"),
    position: text("position"),
    monthlySalary: doublePrecision("monthly_salary").notNull().default(0),
    /** Full typed data snapshot so historical letters render identically. */
    data: json("data").notNull().$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("job_letters_created_idx").on(t.createdAt)],
);

/* ────────────────────────────────────────────────────────────────
 * SETTINGS & ACTIVITY
 * ──────────────────────────────────────────────────────────────── */

export const settings = pgTable(
  "settings",
  {
    id: id(),
    shopName: text("shop_name").notNull().default("My Shop"),
    shopAddress: text("shop_address"),
    shopPhones: json("shop_phones").$type<string[]>().notNull().default([]),
    shopEmail: text("shop_email"),
    lowStockThreshold: doublePrecision("low_stock_threshold").notNull().default(5),
    currency: text("currency").notNull().default("₹"),
    /** Default bill template settings applied to new bills. */
    defaultTemplate: json("default_template").$type<Record<string, unknown>>().notNull().default({}),
    /** Accent theme shared across web, desktop & mobile ("apple" | "ocean" | "forest" | "rose" | "midnight"). */
    theme: text("theme").notNull().default("apple"),
    /** Light/dark mode shared across apps ("light" | "dark" | "system"). */
    mode: text("mode").notNull().default("system"),
    /** Allow creating invoices with a total of ₹0 (default: true). */
    allowZeroTotal: boolean("allow_zero_total").notNull().default(true),
    /** Default labour METHOD for auto-priced GOLD products whose own
     *  `labourValue` is null. Silver never reads this (per-product only). */
    defaultLabourType: text("default_labour_type", { enum: ["PERCENT", "FIXED", "PER_GRAM"] })
      .notNull()
      .default("PERCENT"),
    /** Default labour rate/amount (meaning depends on `defaultLabourType`).
     *  0 → no default labour (renamed from `gold_making_charge_percent`). */
    defaultLabourValue: doublePrecision("default_labour_value").notNull().default(0),
    /** Shop-wide silver ₹ per gram for auto-priced silver products
     *  (0 → silver never auto-prices and falls back to sellingPrice).
     *  Products with their own `silver_rate_per_gram` ignore this. */
    silverRatePerGram: doublePrecision("silver_rate_per_gram").notNull().default(0),
    /** Rates-editor display/entry unit: "gm" (₹/gram) or "10gm" (₹/10 grams).
     *  Storage always stays per-gram — the toggle converts on the way in/out. */
    rateDisplayUnit: text("rate_display_unit", { enum: ["gm", "10gm"] })
      .notNull()
      .default("gm"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
);

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: id(),
    action: text("action").notNull(),
    detail: text("detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("activity_logs_created_idx").on(t.createdAt)],
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type GoldRate = typeof goldRates.$inferSelect;
export type NewGoldRate = typeof goldRates.$inferInsert;
export type StockMovement = typeof stockMovements.$inferSelect;
export type Party = typeof parties.$inferSelect;
export type Advance = typeof advances.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type JobLetter = typeof jobLetters.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type ActivityLog = typeof activityLogs.$inferSelect;
