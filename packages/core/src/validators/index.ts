/**
 * Shared zod validation schemas — the single source of truth for request
 * bodies across the NestJS API (`apps/api`) and the web app (`apps/web`).
 * Move any new schema here instead of defining it in an app.
 */
import { z } from "zod";

/* ── Shared field helpers ─────────────────────────────────────── */

/**
 * Karat 0–24 that also tolerates the ways a form/round-trip clears it
 * (`""` or `null`) — both normalize to `null`, so the services can tell
 * "clear this field" apart from "field absent" (`undefined`).
 */
const goldKaratField = z.union([
  z.literal("").transform((): null => null),
  z.null(),
  z.coerce
    .number()
    .int("Karat must be a whole number")
    .min(0, "Karat cannot be negative")
    .max(24, "Karat cannot exceed 24"),
]);

/** Labour rate/amount — `""`/null → unset; ≥0 (₹ or ₹/g values can exceed 100). */
const labourValueField = z.union([
  z.literal("").transform((): null => null),
  z.null(),
  z.coerce.number().min(0, "Cannot be negative"),
]);

/** Flat ₹ charge (nag/povayi/other) — same round-trip shape as labour:
 *  `""`/null → unset (₹0 / shop rate), number → set. */
const chargeField = labourValueField;

/* ── Products ─────────────────────────────────────────────────── */

export const productSchema = z.object({
  name: z.string().min(1, "Product name is required").max(120),
  type: z.enum(["Gold", "Silver", "Diamond", "Platinum", "Other"]).default("Gold"),
  color: z.string().max(40).optional().or(z.literal("")),
  size: z.string().min(1, "Size is required").max(40),
  category: z.string().max(40).optional().or(z.literal("")),
  /** Article (design) name — resolved find-or-create like `category`. */
  article: z.string().max(40).optional().or(z.literal("")),
  barcode: z.string().max(80).optional().or(z.literal("")),
  /** Weight in milligrams (mg). */
  weight: z.coerce.number().min(0, "Weight cannot be negative").optional(),
  weightUnit: z.enum(["mg", "gm"]).default("gm"),
  /** Jewelry-specific weight fields (free text for formulas). */
  grossWeight: z.string().max(40).optional().or(z.literal("")),
  /** Unit of the nag-less + chejat pair — their own toggle beside the fields. */
  nagUnit: z.enum(["mg", "gm"]).default("gm"),
  nagLessWeight: z.string().max(40).optional().or(z.literal("")),
  /** Flat ₹ nag charge (gold price) — a price field, never unit-converted. */
  nagRate: z.string().max(40).optional().or(z.literal("")),
  chejatWeight: z.string().max(40).optional().or(z.literal("")),
  netWeight: z.string().max(40).optional().or(z.literal("")),
  /** Metal purity stamp — e.g. "24K", "22K", "916", "925". */
  purity: z.string().max(20).optional().or(z.literal("")),
  imageUrl: z.string().max(1000).optional().or(z.literal("")),
  stock: z.coerce.number().min(0, "Stock cannot be negative"),
  purchasePrice: z.coerce.number().min(0).optional(),
  sellingPrice: z.coerce.number().min(0).optional(),
  silverPercentage: z.coerce.number().min(0).max(100).optional(),
  /** Per-product silver ₹/gram (write key; the READ key on ProductDto is
   *  `productSilverRatePerGram`). ""/null → clear → follow the shop rate. */
  silverRatePerGram: chargeField.optional(),
  /** Flat ₹ povayi charge added to the auto price. */
  povayiRate: chargeField.optional(),
  /** Flat ₹ other charges added to the auto price. */
  otherCharges: chargeField.optional(),
  /** Gold karat 0–24 — enables dynamic karat pricing for gold products. */
  goldKarat: goldKaratField.optional(),
  /** Labour method: PERCENT (% of metal value), FIXED (₹) or PER_GRAM (₹/g). */
  labourType: z.enum(["PERCENT", "FIXED", "PER_GRAM"]).optional(),
  /** Labour rate/amount (null/"" → unset: gold uses the shop default, silver none). */
  labourValue: labourValueField.optional(),
  /** "auto" → price from the rate tables; "manual" → `sellingPrice`. */
  priceMode: z.enum(["auto", "manual"]).optional(),
  lowStockThreshold: z.coerce.number().min(0).optional(),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export type ProductFormValues = z.infer<typeof productSchema>;

export const stockAdjustmentSchema = z.object({
  adjustment: z.coerce.number().refine((v) => v !== 0, "Adjustment cannot be zero"),
  reason: z.string().max(200).optional().or(z.literal("")),
});

export type StockAdjustmentValues = z.infer<typeof stockAdjustmentSchema>;

/* ── Bulk product edit (multi-select → one patch) ────────────── */

/** One field-set a bulk edit may change. Omitted keys stay untouched; `""`
 * clears category/article; `stockDelta` must be non-zero. */
export const bulkProductPatchSchema = z
  .object({
    category: z.string().max(40).optional(),
    article: z.string().max(40).optional(),
    priceMode: z.enum(["auto", "manual"]).optional(),
    labourType: z.enum(["PERCENT", "FIXED", "PER_GRAM"]).optional(),
    labourValue: z.coerce.number().min(0).nullable().optional(),
    silverPercentage: z.coerce.number().positive().optional(),
    stockDelta: z.coerce
      .number()
      .refine((v) => v !== 0, "Stock delta cannot be zero")
      .optional(),
    lowStockThreshold: z.coerce.number().min(0).optional(),
    notes: z.string().max(500).optional().or(z.literal("")),
  })
  .refine((p) => Object.values(p).some((v) => v !== undefined), {
    message: "Nothing to update",
  });

export const bulkProductSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "Select at least one product"),
  patch: bulkProductPatchSchema,
});

export type BulkProductFormValues = z.infer<typeof bulkProductSchema>;

/* ── Sales (quick sale) ───────────────────────────────────────── */

export const saleSchema = z.object({
  productId: z.string().min(1, "Please select a product"),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  // Optional — the web quick-sale form sends color+size; the desktop form
  // sends the full SaleInput (price override, customer, paid, notes). The
  // schema mirrors core's SaleInput so the API accepts both call shapes.
  color: z.string().optional(),
  size: z.string().optional(),
  sellingPrice: z.coerce.number().min(0).optional(),
  customerName: z.string().max(120).optional(),
  customerPhone: z.string().max(20).optional(),
  paid: z.boolean().optional(),
  paymentMethod: z.string().max(20).optional(),
  notes: z.string().max(500).optional(),
});

export type SaleFormValues = z.infer<typeof saleSchema>;

/* ── Invoices / bills ─────────────────────────────────────────── */

/** Frozen per-line pricing snapshot (mirrors `InvoiceItemPricing`) — the bill
 *  screen sends its edited line's snapshot (rate/labour/povayi) so the printed
 *  bill matches what the operator saw. Omitted → server freezes its own. */
export const invoiceItemPricingSchema = z.object({
  metal: z.enum(["Gold", "Silver"]),
  ratePerGram: z.coerce.number().min(0),
  karat: z.coerce.number().nullish(),
  silverPercentage: z.coerce.number().nullish(),
  weightGm: z.coerce.number().nullish(),
  metalValue: z.coerce.number().nullish(),
  labourType: z.string().max(16).nullish(),
  labourValue: z.coerce.number().nullish(),
  labourAmount: z.coerce.number().nullish(),
  povayi: z.coerce.number().nullish(),
  nag: z.coerce.number().nullish(),
  other: z.coerce.number().nullish(),
});

export type InvoiceItemPricingValues = z.infer<typeof invoiceItemPricingSchema>;

export const invoiceItemSchema = z.object({
  productId: z.string().optional(),
  productName: z.string().min(1, "Item name is required"),
  sku: z.string().optional(),
  color: z.string().optional(),
  size: z.string().optional(),
  description: z.string().optional(),
  /** Per-line purity stamp printed in the Purity column (dropdown on the
   *  bill screens). */
  purity: z.string().max(24).optional(),
  /** Gross-weight free text snapshot from the product (bill G.Wt. column). */
  grossWeight: z.string().max(30).optional(),
  /** Bill line's nag-less weight in GRAMS (gold net-weight derivation input). */
  nagLessWeight: z.coerce.number().nullish(),
  /** Bill line's chejat (stone) weight in GRAMS (derivation input). */
  chejatWeight: z.coerce.number().nullish(),
  weight: z.coerce.number().min(0).nullish(),
  weightUnit: z.enum(["gm", "mg"]).nullish(),
  quantity: z.coerce.number().positive("Quantity must be positive"),
  price: z.coerce.number().min(0),
  /** Client-computed pricing snapshot (per-line rate/labour/charge edits) —
   *  optional; clients that omit it keep the server-side product freeze. */
  pricing: invoiceItemPricingSchema.nullish(),
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
  materialReturnedWeight: z.string().optional(),
  materialReturnedValue: z.coerce.number().min(0).optional(),
  /** Per-bill label for the deduction row (blank → "Material Returned"). */
  materialReturnedTitle: z.string().max(60).optional(),
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
      // Per-bill display toggles — default ON (older snapshots omit them).
      weightAfterName: z.boolean().default(true),
      goldRateLine: z.boolean().default(true),
      silverRateLine: z.boolean().default(true),
      // Chejat/Nag direction marks — ON prints "Chejat: 0.100 +" / "Nag:
      // 0.200 −". Default ON (client's ask); old snapshots parse to true.
      signSuffix: z.boolean().default(true),
      // Purity line under the gold rate row — omitted by older snapshots /
      // payload builders → undefined, and mergeBillTemplateSettings lands
      // on "base" (legacy base-karat line). `.optional()` (NOT `.default`)
      // so the OUTPUT type stays optional, matching the model field.
      goldRateKaratMode: z.enum(["off", "base", "product", "custom"]).optional(),
      goldRateKaratText: z.string().max(80).optional(),
      // Estimate columns turned off on the New Bill screen — per metal
      // (gold grid ≠ silver field list). Omitted by older snapshots / web
      // payloads → both sides [] (nothing hidden).
      // `.optional()` (NOT `.default(...)`) so the OUTPUT type stays
      // optional, matching `BillTemplateSettings.hiddenColumns` — a
      // `.default()` here would make the parsed type REQUIRED and reject
      // every payload builder that spreads a `BillTemplateSettings`
      // (desktop/mobile) or omits the key entirely (mobile SalesScreen).
      // The per-metal arrays keep their inner `.default([])`: when the key
      // IS present, a missing side still parses to [].
      hiddenColumns: z
        .object({
          gold: z
            .array(
              z.enum([
                "description",
                "purity",
                "weight",
                "netWeight",
                "chejatNag",
                "rate",
                "labour",
                "otherCharges",
                "amount",
              ]),
            )
            .default([]),
          silver: z
            .array(
              z.enum([
                "description",
                "purity",
                "weight",
                "netWeight",
                "chejatNag",
                "rate",
                "labour",
                "otherCharges",
                "amount",
              ]),
            )
            .default([]),
        })
        .optional(),
    })
    .optional(),
  amountPaid: z.coerce.number().min(0).optional(),
  paymentMethod: z.string().max(40).optional(),
  // Optional reference for the advance (UPI ref / txn id / "cash hand").
  paymentNote: z.string().max(120).optional(),
  // Gold ₹/gram this bill was created at — reprints must show THIS rate,
  // not whatever today's shop rate happens to be. Optional (older bills: null).
  goldRate: z.coerce.number().min(0).optional(),
  // Silver ₹/gram this bill was created at (bill-level override). Optional.
  silverRate: z.coerce.number().min(0).optional(),
});

export type InvoiceFormValues = z.infer<typeof invoiceSchema>;

/** PUT /api/invoices/:id — editing a bill re-submits the WHOLE bill (the
 *  desktop/mobile edit screens are the create screens in edit mode), so the
 *  update validator IS the create validator: same fields, same rules. The
 *  service ignores the invoice number / createdAt and reconciles stock +
 *  payments instead (see `updateInvoice` in services/invoices.ts). */
export const invoiceUpdateSchema = invoiceSchema;

export type InvoiceUpdateValues = InvoiceFormValues;

export const recordPaymentSchema = z.object({
  invoiceId: z.string().min(1, "Invoice is required"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  method: z.string().optional(),
  date: z.string().optional(),
  note: z.string().optional(),
});

export type RecordPaymentValues = z.infer<typeof recordPaymentSchema>;

/** Payment against a specific invoice (invoice id comes from the URL). */
export const invoicePaymentSchema = z.object({
  amount: z.coerce.number().positive("Payment amount must be positive"),
  method: z.string().max(40).optional().or(z.literal("")),
  date: z.string().optional(),
  note: z.string().max(300).optional().or(z.literal("")),
});

export type InvoicePaymentValues = z.infer<typeof invoicePaymentSchema>;

/* ── Orders (quote now, bill later) ──────────────────────────── */

/** Order line — same shape as an invoice line, but `price` is the QUOTED
 *  price carried into the bill as-is (no re-pricing at bill time). */
export const orderItemSchema = z.object({
  productId: z.string().optional(),
  productName: z.string().min(1, "Item name is required"),
  sku: z.string().optional(),
  color: z.string().optional(),
  size: z.string().optional(),
  description: z.string().optional(),
  weight: z.coerce.number().min(0).nullish(),
  weightUnit: z.enum(["gm", "mg"]).nullish(),
  quantity: z.coerce.number().positive("Quantity must be positive"),
  price: z.coerce.number().min(0),
});

export type OrderItemValues = z.infer<typeof orderItemSchema>;

export const orderSchema = z.object({
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerAddress: z.string().optional(),
  partyId: z.string().optional(),
  date: z.string().optional(),
  items: z.array(orderItemSchema).min(1, "At least one line item is required"),
  deliveryCharge: z.coerce.number().min(0).optional(),
  discount: z.coerce.number().min(0).optional(),
  /** Advance taken on the order (clamped to the order total in the service). */
  amountPaid: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
});

export type OrderFormValues = z.infer<typeof orderSchema>;

export const orderUpdateSchema = orderSchema
  .partial()
  .extend({
    items: z.array(orderItemSchema).min(1, "At least one line item is required").optional(),
    status: z.enum(["OPEN", "COMPLETED", "CANCELLED"]).optional(),
  });

export type OrderUpdateValues = z.infer<typeof orderUpdateSchema>;

/** POST /api/orders/:id/pay — an advance / part-payment on an unbilled order. */
export const orderPaymentSchema = z.object({
  amount: z.coerce.number().positive("Payment must be more than zero"),
  /** How it was paid — free text (backend keeps legacy values working). */
  method: z.string().max(40).optional(),
  note: z.string().optional(),
});

export type OrderPaymentValues = z.infer<typeof orderPaymentSchema>;

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

/** Partial update — all fields optional (mirrors `updateParty(db, id, Partial<PartyInput>)`). */
export const partyUpdateSchema = z.object({
  name: z.string().min(1, "Party name is required").max(120).optional(),
  phone: z.string().max(40).optional().or(z.literal("")),
  email: z.email("Invalid email").optional().or(z.literal("")),
  address: z.string().max(300).optional().or(z.literal("")),
  type: z.enum(["CUSTOMER", "SUPPLIER", "WORKER", "OTHER"]).optional(),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export type PartyUpdateValues = z.infer<typeof partyUpdateSchema>;

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

/* ── Gold rates (dynamic karat-wise pricing) ──────────────────── */

/** One karat row of a PUT /api/gold-rates body. */
export const goldRateSaveSchema = z.object({
  karat: z.coerce
    .number()
    .int("Karat must be a whole number")
    .min(0, "Karat cannot be negative")
    .max(24, "Karat cannot exceed 24"),
  ratePerGram: z.coerce.number().min(0, "Rate cannot be negative").max(10_000_000, "Rate looks too large"),
  /** false → reset this karat to its derived rate. */
  isCustom: z.boolean().default(true),
});

export type GoldRateSaveValues = z.infer<typeof goldRateSaveSchema>;

/** PUT /api/gold-rates — the whole 0–24 table in one save. */
export const goldRatesSchema = z.object({
  rates: z
    .array(goldRateSaveSchema)
    .min(1, "Send at least one karat")
    .max(25, "Only karats 0–24 are supported"),
});

export type GoldRatesValues = z.infer<typeof goldRatesSchema>;

/* ── Settings ─────────────────────────────────────────────────── */

// Settings fields round-trip the raw DB row, where any of these can be NULL.
// The schema accepts null (a GET→PUT save must not 400 on its own output)
// but normalizes it to `undefined` so the service skips unchanged fields.
// Every field is also `.optional()` at the OUTPUT level so the inferred
// `SettingsFormValues` keeps all-optional properties (matching ShopSettingsInput).
const settingsString = (max: number, min = 0) =>
  z
    .string()
    .min(min)
    .max(max)
    .nullish()
    .transform((v) => v ?? undefined)
    .optional();

/** Allowed rates-editor display units (storage always stays per-gram). */
export const RATE_DISPLAY_UNITS = ["gm", "10gm"] as const;
/** Entry/display unit for the shop silver rate in the rates editor. */
export type RateDisplayUnit = (typeof RATE_DISPLAY_UNITS)[number];

export const settingsSchema = z.object({
  shopName: settingsString(120, 1),
  shopAddress: settingsString(300),
  shopPhones: z
    .array(z.string().max(20))
    .nullish()
    .transform((v) => v ?? undefined)
    .optional(),
  shopEmail: settingsString(120),
  lowStockThreshold: z.coerce
    .number()
    .min(0)
    .nullish()
    .transform((v) => v ?? undefined)
    .optional(),
  currency: settingsString(10),
  defaultTemplate: z
    .record(z.string(), z.unknown())
    .nullish()
    .transform((v) => v ?? undefined)
    .optional(),
  allowZeroTotal: z.boolean().optional(),
  /** Default labour method for auto-priced GOLD products (silver is per-product). */
  defaultLabourType: z.enum(["PERCENT", "FIXED", "PER_GRAM"]).optional(),
  /** Default labour rate/amount (meaning depends on the method). */
  defaultLabourValue: labourValueField
    .nullish()
    .transform((v) => v ?? undefined)
    .optional(),
  /** Shop-wide silver ₹/gram (0 → silver never auto-prices). */
  silverRatePerGram: z.coerce
    .number()
    .min(0)
    .nullish()
    .transform((v) => v ?? undefined)
    .optional(),
  /** Rates-editor display/entry unit — storage stays per-gram. */
  rateDisplayUnit: z.enum(RATE_DISPLAY_UNITS).optional(),
});

export type SettingsFormValues = z.infer<typeof settingsSchema>;

/* ── Reports ──────────────────────────────────────────────────── */

export const reportQuerySchema = z.object({
  type: z.enum(["daily", "weekly", "monthly", "yearly", "stock", "low_stock", "sold"]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type ReportQueryValues = z.infer<typeof reportQuerySchema>;
