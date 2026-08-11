import {
  pgTable,
  text,
  timestamp,
  doublePrecision,
  json,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { newId } from "../utils/id";

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
 * PRODUCTS & STOCK
 * ──────────────────────────────────────────────────────────────── */

export const products = pgTable(
  "products",
  {
    id: id(),
    sku: text("sku").notNull().unique(),
    name: text("name").notNull(),
    barcode: text("barcode"),
    imageUrl: text("image_url"),
    stock: doublePrecision("stock").notNull().default(0),
    purchasePrice: doublePrecision("purchase_price").notNull().default(0),
    sellingPrice: doublePrecision("selling_price").notNull().default(0),
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
    templateSettings: json("template_settings").$type<Record<string, unknown>>(),
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
    quantity: doublePrecision("quantity").notNull().default(1),
    price: doublePrecision("price").notNull().default(0),
    total: doublePrecision("total").notNull().default(0),
  },
  (t) => [index("invoice_items_invoice_idx").on(t.invoiceId)],
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
export type StockMovement = typeof stockMovements.$inferSelect;
export type Party = typeof parties.$inferSelect;
export type Advance = typeof advances.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type JobLetter = typeof jobLetters.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type ActivityLog = typeof activityLogs.$inferSelect;
