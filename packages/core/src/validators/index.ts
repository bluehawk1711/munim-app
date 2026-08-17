/**
 * Shared zod validation schemas — the single source of truth for request
 * bodies across the NestJS API (`apps/api`) and the web app (`apps/web`).
 * Move any new schema here instead of defining it in an app.
 */
import { z } from "zod";

/* ── Products ─────────────────────────────────────────────────── */

export const productSchema = z.object({
  name: z.string().min(1, "Product name is required").max(120),
  color: z.string().max(40).optional().or(z.literal("")),
  size: z.string().min(1, "Size is required").max(40),
  category: z.string().max(40).optional().or(z.literal("")),
  barcode: z.string().max(80).optional().or(z.literal("")),
  /** Weight in milligrams (mg). */
  weight: z.coerce.number().min(0, "Weight cannot be negative").optional(),
  imageUrl: z.string().max(1000).optional().or(z.literal("")),
  stock: z.coerce.number().min(0, "Stock cannot be negative"),
  purchasePrice: z.coerce.number().min(0, "Purchase price cannot be negative"),
  sellingPrice: z.coerce.number().min(0, "Selling price cannot be negative"),
  lowStockThreshold: z.coerce.number().min(0).optional(),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export type ProductFormValues = z.infer<typeof productSchema>;

export const stockAdjustmentSchema = z.object({
  adjustment: z.coerce.number().refine((v) => v !== 0, "Adjustment cannot be zero"),
  reason: z.string().max(200).optional().or(z.literal("")),
});

export type StockAdjustmentValues = z.infer<typeof stockAdjustmentSchema>;

/* ── Sales (quick sale) ───────────────────────────────────────── */

export const saleSchema = z.object({
  productId: z.string().min(1, "Please select a product"),
  color: z.string().min(1, "Please select a color"),
  size: z.string().min(1, "Please select a size"),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
});

export type SaleFormValues = z.infer<typeof saleSchema>;

/* ── Invoices / bills ─────────────────────────────────────────── */

export const invoiceItemSchema = z.object({
  productId: z.string().optional(),
  productName: z.string().min(1, "Item name is required"),
  sku: z.string().optional(),
  color: z.string().optional(),
  size: z.string().optional(),
  description: z.string().optional(),
  quantity: z.coerce.number().positive("Quantity must be positive"),
  price: z.coerce.number().min(0),
});

export type InvoiceItemValues = z.infer<typeof invoiceItemSchema>;

export const invoiceSchema = z.object({
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerAddress: z.string().optional(),
  partyId: z.string().optional(),
  date: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, "At least one line item is required"),
  deliveryCharge: z.coerce.number().min(0).optional(),
  discount: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
  shopDetails: z
    .object({
      name: z.string(),
      address: z.string(),
      phones: z.array(z.string()),
      email: z.string(),
    })
    .optional(),
  // Bill template snapshot (template / classic color / 2-in-1) — validated
  // against the shared BillTemplateSettings model instead of a JSON blob.
  templateSettings: z
    .object({
      template: z.enum(["jewellery", "ecommerce"]),
      classicColor: z.enum(["red", "yellow"]),
      twoInOne: z.boolean(),
      mode: z.enum(["duplicate", "distinct"]),
    })
    .optional(),
  amountPaid: z.coerce.number().min(0).optional(),
  paymentMethod: z.string().optional(),
});

export type InvoiceFormValues = z.infer<typeof invoiceSchema>;

export const recordPaymentSchema = z.object({
  invoiceId: z.string().min(1, "Invoice is required"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  method: z.string().optional(),
  date: z.string().optional(),
  note: z.string().optional(),
});

export type RecordPaymentValues = z.infer<typeof recordPaymentSchema>;

/* ── Parties (khata) ──────────────────────────────────────────── */

export const partySchema = z.object({
  name: z.string().min(1, "Party name is required").max(120),
  phone: z.string().max(40).optional().or(z.literal("")),
  email: z.email("Invalid email").optional().or(z.literal("")),
  address: z.string().max(300).optional().or(z.literal("")),
  type: z.enum(["CUSTOMER", "SUPPLIER", "WORKER", "OTHER"]).default("CUSTOMER"),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export type PartyFormValues = z.infer<typeof partySchema>;

/* ── Payments (money in/out against a party) ──────────────────── */

export const paymentSchema = z.object({
  partyId: z.string().optional(),
  invoiceId: z.string().optional(),
  direction: z.enum(["IN", "OUT"]),
  amount: z.coerce.number().positive("Amount must be positive"),
  method: z.string().max(40).optional().or(z.literal("")),
  date: z.string().optional(),
  note: z.string().max(300).optional().or(z.literal("")),
});

export type PaymentFormValues = z.infer<typeof paymentSchema>;

/* ── Advances ─────────────────────────────────────────────────── */

export const advanceSchema = z.object({
  partyId: z.string().min(1, "Party is required"),
  direction: z.enum(["GIVEN", "TAKEN"]),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  date: z.string().optional(),
  note: z.string().max(300).optional().or(z.literal("")),
});

export type AdvanceFormValues = z.infer<typeof advanceSchema>;

/* ── Job letters ──────────────────────────────────────────────── */

export const jobLetterSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  employeeName: z.string().max(120).optional().or(z.literal("")),
  position: z.string().max(120).optional().or(z.literal("")),
  monthlySalary: z.coerce.number().min(0).optional(),
  data: z.record(z.string(), z.unknown()).default({}),
});

export type JobLetterFormValues = z.infer<typeof jobLetterSchema>;

/* ── Settings ─────────────────────────────────────────────────── */

export const settingsSchema = z.object({
  shopName: z.string().min(1).max(120).optional(),
  shopAddress: z.string().max(300).optional(),
  shopPhones: z.array(z.string().max(20)).optional(),
  shopEmail: z.string().max(120).optional().or(z.literal("")),
  lowStockThreshold: z.coerce.number().min(0).optional(),
  currency: z.string().max(10).optional(),
  defaultTemplate: z.record(z.string(), z.unknown()).optional(),
});

export type SettingsFormValues = z.infer<typeof settingsSchema>;

/* ── Reports ──────────────────────────────────────────────────── */

export const reportQuerySchema = z.object({
  type: z.enum(["daily", "weekly", "monthly", "yearly", "stock", "low_stock", "sold"]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type ReportQueryValues = z.infer<typeof reportQuerySchema>;
