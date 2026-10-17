import { and, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import * as schema from "../db/schema.js";
import { generateInvoiceNumber } from "../utils/codes.js";
import type { BillTemplateSettings } from "../billing/index.js";
import { priceProduct } from "../pricing/product.js";
import { invoicePricingFromBreakdown } from "../pricing/bill-line.js";
import { getProduct } from "./products.js";
import { loadGoldPricing } from "./goldRates.js";
import { logActivity } from "./activity.js";

export class InvoiceError extends Error {
  constructor(message: string, public code: string, public status = 400) {
    super(message);
  }
}

export type SaleInput = {
  productId: string;
  quantity: number;
  sellingPrice?: number; // override price if desired
  customerName?: string;
  customerPhone?: string;
  /** true → record a full payment, invoice marked PAID */
  paid?: boolean;
  paymentMethod?: string;
  notes?: string;
};

/** Pricing inputs loaded once per save (`loadGoldPricing`). */
type PricingContext = Awaited<ReturnType<typeof loadGoldPricing>>;

/**
 * Frozen pricing inputs for an auto-priced line (null for manual lines) —
 * the rate table, silver rate and labour used to compute THIS line's price
 * at save time. Later rate edits never touch a saved invoice.
 */
function pricingSnapshotFor(
  product: NonNullable<Awaited<ReturnType<typeof getProduct>>>,
  pricingContext: PricingContext | null,
) {
  if (!pricingContext) return null;
  const breakdown = priceProduct(
    {
      type: product.type,
      priceMode: product.priceMode === "auto" ? "auto" : "manual",
      weight: product.weight,
      weightUnit: product.weightUnit,
      goldKarat: product.goldKarat,
      silverPercentage: product.silverPercentage ?? 100,
      labourType: product.labourType === "FIXED" || product.labourType === "PER_GRAM" ? product.labourType : "PERCENT",
      labourValue: product.labourValue,
      netWeight: product.netWeight,
      sellingPrice: product.sellingPrice,
    },
    {
      goldRateTable: pricingContext.table,
      silverRatePerGram: pricingContext.silverRatePerGram,
      silverRateOverride: pricingContext.silverRateOverride,
      defaultLabour: pricingContext.defaultLabour,
    },
  );
  // Single breakdown→snapshot mapping (shared with the bill screens, which
  // send their edited line's snapshot on save).
  return invoicePricingFromBreakdown(breakdown);
}

/** Quick single-product sale (like the stockPilot "sell" flow). Decrements stock. */
export async function createSale(db: DbClient, input: SaleInput) {
  const product = await getProduct(db, input.productId);
  if (!product) throw new InvoiceError("Selected product no longer exists", "PRODUCT_NOT_FOUND", 404);
  if (input.quantity <= 0) throw new InvoiceError("Quantity must be greater than 0", "INVALID_QUANTITY");

  // Auto-priced gold products sell at the dynamic price (NET weight × karat
  // rate + labour — see pricing/product.ts); manual/non-gold keep `sellingPrice`.
  const price = input.sellingPrice ?? product.effectivePrice ?? product.sellingPrice;
  const total = price * input.quantity;
  const newStock = product.stock - input.quantity;
  if (newStock < 0) throw new InvoiceError("Not enough stock available for this sale", "INSUFFICIENT_STOCK", 409);

  // Same frozen pricing snapshot createInvoice stores, so a quick sale is
  // rendered/billed exactly like a full bill line.
  const pricingContext = await loadGoldPricing(db);
  const pricing = pricingSnapshotFor(product, pricingContext);

  const invoiceNumber = await generateInvoiceNumber(async (num) => {
    const r = await db.select({ id: schema.invoices.id }).from(schema.invoices).where(eq(schema.invoices.invoiceNumber, num));
    return r.length > 0;
  });

  const [invoice] = await db
    .insert(schema.invoices)
    .values({
      invoiceNumber,
      customerName: input.customerName?.trim() || null,
      customerPhone: input.customerPhone?.trim() || null,
      status: input.paid ? "PAID" : "UNPAID",
      subtotal: total,
      deliveryCharge: 0,
      discount: 0,
      total,
      amountPaid: input.paid ? total : 0,
      notes: input.notes?.trim() || null,
    })
    .returning();
  if (!invoice) throw new InvoiceError("Failed to create invoice", "CREATE_FAILED", 500);

  await db.insert(schema.invoiceItems).values({
    invoiceId: invoice.id,
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    color: product.colorName,
    size: product.sizeName,
    weight: product.weight,
    weightUnit: product.weightUnit,
    quantity: input.quantity,
    price,
    total,
    pricing,
  });

  await db
    .update(schema.products)
    .set({ stock: newStock, updatedAt: new Date() })
    .where(eq(schema.products.id, product.id));
  await db.insert(schema.stockMovements).values({
    productId: product.id,
    type: "SALE",
    quantity: input.quantity,
    stockAfter: newStock,
    referenceType: "invoice",
    referenceId: invoice.id,
    note: `Sale ${invoiceNumber}`,
  });

  if (input.paid) {
    await db.insert(schema.payments).values({
      invoiceId: invoice.id,
      direction: "IN",
      amount: total,
      method: input.paymentMethod || "cash",
      note: `Payment for ${invoiceNumber}`,
    });
  }

  await logActivity(
    db,
    "SALE_CREATED",
    `Sold ${input.quantity} × "${product.name}" (${product.sku}) — Invoice ${invoiceNumber}`,
  );
  return getInvoice(db, invoice.id);
}

/* ── Full bill / invoice management ───────────────────────────── */

export type InvoiceItemInput = {
  productId?: string;
  productName: string;
  sku?: string;
  color?: string;
  size?: string;
  description?: string;
  /** Metal purity stamp for the bill's Purity column (dropdown on bill screens). */
  purity?: string;
  /** Gross-weight free text snapshot from the product (bill G.Wt. column). */
  grossWeight?: string;
  /** Bill line's nag-less weight in GRAMS (gold net-weight derivation input:
   *  `net = gross − nag + chejat` — the same rule as the product form). */
  nagLessWeight?: number | null;
  /** Bill line's chejat (stone) weight in GRAMS (derivation input). */
  chejatWeight?: number | null;
  /** Product weight + unit snapshot — bill WEIGHT column display only. */
  weight?: number | null;
  weightUnit?: string | null;
  /** Frozen pricing snapshot computed by the bill screen (reflects its
   *  per-line rate/labour/charge edits); null/omitted → the server freezes
   *  its own from the product at save time. */
  pricing?: schema.InvoiceItemPricing | null;
  quantity: number;
  price: number;
};

export type InvoiceInput = {
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  partyId?: string;
  date?: string | Date;
  items: InvoiceItemInput[];
  deliveryCharge?: number;
  discount?: number;
  /** Material returned by customer — free text weight, e.g. "5gm". */
  materialReturnedWeight?: string;
  /** Monetary value of material returned (deducted from total). */
  materialReturnedValue?: number;
  /** Per-bill label for the deduction row (blank → "Material Returned"). */
  materialReturnedTitle?: string;
  notes?: string;
  shopDetails?: { name: string; address: string; phones: string[]; email: string };
  /** Snapshot of the bill template settings (template / classic color / 2-in-1). */
  templateSettings?: BillTemplateSettings;
  /** Gold base ₹/gram used for THIS bill (reprint keeps it; null → current shop rate). */
  goldRate?: number;
  /** Silver ₹/gram used for THIS bill (bill-level override; null → shop rate). */
  silverRate?: number;
  /** initial payment received */
  amountPaid?: number;
  paymentMethod?: string;
  status?: "DRAFT" | "UNPAID" | "PARTIAL" | "PAID";
};

export async function createInvoice(db: DbClient, input: InvoiceInput) {
  if (!input.items.length) throw new InvoiceError("At least one line item is required", "NO_ITEMS");
  const badQty = input.items.find((it) => !(it.quantity > 0));
  if (badQty) throw new InvoiceError(`Item "${badQty.productName}" needs a quantity of at least 1`, "BAD_QUANTITY");

  const invoiceNumber = await generateInvoiceNumber(async (num) => {
    const r = await db.select({ id: schema.invoices.id }).from(schema.invoices).where(eq(schema.invoices.invoiceNumber, num));
    return r.length > 0;
  });

  const subtotal = input.items.reduce((sum, it) => sum + it.quantity * it.price, 0);
  const delivery = input.deliveryCharge ?? 0;
  const discount = input.discount ?? 0;
  const materialReturnedValue = input.materialReturnedValue ?? 0;
  const total = Math.max(0, subtotal + delivery - discount - materialReturnedValue);
  // Check if zero-total invoices are allowed (default: true)
  const settingsRow = await db.query.settings.findFirst();
  const allowZeroTotal = settingsRow?.allowZeroTotal ?? true;
  if (!allowZeroTotal && !(total > 0)) throw new InvoiceError("Invoice total must be greater than 0 — check item prices, discount and delivery charge", "ZERO_TOTAL");
  const amountPaid = Math.min(input.amountPaid ?? 0, total);

  // Validate + reserve stock
  const stockChecks = new Map<string, { qty: number; product: NonNullable<Awaited<ReturnType<typeof getProduct>>> }>();
  for (const item of input.items) {
    if (item.productId) {
      const product = await getProduct(db, item.productId);
      if (!product) throw new InvoiceError(`Product "${item.productName}" no longer exists`, "PRODUCT_NOT_FOUND", 404);
      if (product.stock < item.quantity)
        throw new InvoiceError(`Not enough stock for "${product.name}" (${product.stock} left, need ${item.quantity})`, "INSUFFICIENT_STOCK", 409);
      stockChecks.set(item.productId, { qty: item.quantity, product });
    }
  }

  const status: InvoiceInput["status"] =
    input.status ?? (amountPaid >= total && total > 0 ? "PAID" : amountPaid > 0 ? "PARTIAL" : "UNPAID");

  // Current shop pricing inputs (rate table + silver rate + gold default
  // labour) — fetched ONCE so every auto-priced line can freeze its own
  // pricing snapshot below. Rates at SAVE time; later rate edits never touch
  // this invoice (price/total stay authoritative).
  const pricingContext = input.items.some((it) => it.productId)
    ? await loadGoldPricing(db, { goldBaseRate: input.goldRate, silverBaseRate: input.silverRate })
    : null;

  const [invoice] = await db
    .insert(schema.invoices)
    .values({
      invoiceNumber,
      partyId: input.partyId ?? null,
      customerName: input.customerName?.trim() || null,
      customerPhone: input.customerPhone?.trim() || null,
      customerAddress: input.customerAddress?.trim() || null,
      date: input.date ? new Date(input.date) : new Date(),
      status: status ?? "UNPAID",
      subtotal,
      deliveryCharge: delivery,
      discount,
    materialReturnedWeight: input.materialReturnedWeight?.trim() || null,
    materialReturnedValue,
    materialReturnedTitle: input.materialReturnedTitle?.trim() || null,
      total,
      amountPaid,
      notes: input.notes?.trim() || null,
      shopDetails: input.shopDetails ?? null,
      templateSettings: input.templateSettings ?? null,
      goldRate: input.goldRate && input.goldRate > 0 ? input.goldRate : null,
      silverRate: input.silverRate && input.silverRate > 0 ? input.silverRate : null,
    })
    .returning();
  if (!invoice) throw new InvoiceError("Failed to create invoice", "CREATE_FAILED", 500);

  for (const item of input.items) {
    const product = item.productId ? await getProduct(db, item.productId) : undefined;
    await db.insert(schema.invoiceItems).values({
      invoiceId: invoice.id,
      productId: item.productId ?? null,
      productName: item.productName.trim(),
      sku: item.sku || product?.sku || null,
      color: item.color || product?.colorName || null,
      size: item.size || product?.sizeName || null,
      description: item.description?.trim() || null,
      purity: item.purity?.trim() || product?.purity || null,
      grossWeight: item.grossWeight || product?.grossWeight || null,
      nagLessWeight: item.nagLessWeight ?? null,
      chejatWeight: item.chejatWeight ?? null,
      weight: item.weight ?? product?.weight ?? null,
      weightUnit: item.weightUnit ?? product?.weightUnit ?? null,
      quantity: item.quantity,
      price: item.price,
      total: item.quantity * item.price,
      // The client-computed snapshot (bill-screen rate/labour/charge edits)
      // wins; otherwise freeze the product's own pricing as before.
      pricing: item.pricing ?? (product ? pricingSnapshotFor(product, pricingContext) : null),
    });
  }

  // Decrement stock for tracked products
  for (const { qty, product } of stockChecks.values()) {
    const newStock = product.stock - qty;
    await db
      .update(schema.products)
      .set({ stock: newStock, updatedAt: new Date() })
      .where(eq(schema.products.id, product.id));
    await db.insert(schema.stockMovements).values({
      productId: product.id,
      type: "SALE",
      quantity: qty,
      stockAfter: newStock,
      referenceType: "invoice",
      referenceId: invoice.id,
      note: `Invoice ${invoiceNumber}`,
    });
  }

  if (amountPaid > 0) {
    await db.insert(schema.payments).values({
      invoiceId: invoice.id,
      partyId: input.partyId ?? null,
      direction: "IN",
      amount: amountPaid,
      method: input.paymentMethod || "cash",
      note: `Payment for ${invoiceNumber}`,
    });
  }

  await logActivity(
    db,
    "INVOICE_CREATED",
    `Created invoice ${invoiceNumber} — ${total.toLocaleString("en-IN")}${input.customerName ? ` for ${input.customerName}` : ""}`,
  );
  return getInvoice(db, invoice.id);
}

export type InvoiceWithItems = schema.Invoice & { items: schema.InvoiceItem[] };

export async function getInvoice(db: DbClient, id: string): Promise<InvoiceWithItems | null> {
  const invoice = await db.select().from(schema.invoices).where(eq(schema.invoices.id, id));
  if (!invoice[0]) return null;
  const items = await db
    .select()
    .from(schema.invoiceItems)
    .where(eq(schema.invoiceItems.invoiceId, id))
    .orderBy(schema.invoiceItems.id);
  return { ...invoice[0], items };
}

export type InvoiceFilters = {
  search?: string;
  status?: "DRAFT" | "UNPAID" | "PARTIAL" | "PAID" | "all";
  partyId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
};

export async function listInvoices(db: DbClient, filters: InvoiceFilters = {}) {
  const search = filters.search?.trim() || "";
  const conditions = [];
  if (search) {
    conditions.push(
      or(
        ilike(schema.invoices.invoiceNumber, `%${search}%`),
        ilike(schema.invoices.customerName, `%${search}%`),
        ilike(schema.invoices.customerPhone, `%${search}%`),
      ),
    );
  }
  if (filters.status && filters.status !== "all") conditions.push(eq(schema.invoices.status, filters.status));
  if (filters.partyId) conditions.push(eq(schema.invoices.partyId, filters.partyId));
  if (filters.startDate || filters.endDate) {
    const range: ReturnType<typeof gte>[] = [];
    if (filters.startDate) range.push(gte(schema.invoices.date, new Date(filters.startDate)));
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      range.push(lte(schema.invoices.date, end));
    }
    conditions.push(and(...range));
  }

  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.max(1, Math.min(200, filters.pageSize || 20));

  const where = conditions.length ? and(...conditions) : undefined;
  const rows = await db
    .select()
    .from(schema.invoices)
    .where(where)
    .orderBy(desc(schema.invoices.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const items = await db
    .select()
    .from(schema.invoiceItems)
    .where(
      rows.length
        ? inArray(schema.invoiceItems.invoiceId, rows.map((r) => r.id))
        : sql`false`,
    );

  const itemsByInvoice = new Map<string, schema.InvoiceItem[]>();
  for (const it of items) {
    const list = itemsByInvoice.get(it.invoiceId) ?? [];
    list.push(it);
    itemsByInvoice.set(it.invoiceId, list);
  }

  const totalCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.invoices)
    .where(where)
    .then((r) => r[0]?.count ?? 0);

  return {
    invoices: rows.map((r) => ({ ...r, items: itemsByInvoice.get(r.id) ?? [] })),
    pagination: { page, pageSize, totalCount, totalPages: Math.ceil(totalCount / pageSize) },
  };
}

/* ── Edit an existing bill ────────────────────────────────────────
 *
 * The edit screens (desktop /billing?edit=<id>, mobile BillingScreen in edit
 * mode) re-submit the WHOLE bill, so this is a full replacement of every
 * editable field — the invoice NUMBER and createdAt are never touched.
 *
 * Three things have to be reconciled against what's already stored, and all
 * three live HERE (core), never in an app:
 *
 *   STOCK  — only the DELTA per product is applied (new qty − old qty), so
 *            removing a line returns its stock, adding one sells it, and a
 *            quantity change moves just the difference. Positive deltas are
 *            stock-checked BEFORE anything is written.
 *   MONEY  — the invoice's own payment rows are kept equal to `amountPaid`
 *            (the same invariant `createInvoice` establishes: one IN row for
 *            what was paid). Raising paid records the difference; lowering it
 *            unwinds the newest rows first, so the khata ledger — which reads
 *            BOTH `total − amountPaid` and the payments rows — stays
 *            self-consistent. Changing the linked party re-points the rows.
 *   TOTALS — recomputed from the items exactly like create, incl. the
 *            zero-total setting and the PAID/PARTIAL/UNPAID derivation.
 */

/** Edit payload — the same full bill shape the create screens send. */
export type InvoiceUpdateInput = InvoiceInput;

/** Money comparisons — these columns are float8, so exact `===` on sums
 *  of user-entered rupees would misfire on 0.1 + 0.2 style artifacts. */
const MONEY_EPS = 0.005;

/** Per-product quantity totals from a set of bill lines (duplicate lines for
 *  the SAME product accumulate — a ring, a chain and two pendants of the same
 *  SKU are three separate lines but ONE stock position). Accepts both the
 *  input shape (`productId?: string`) and the stored row shape
 *  (`productId: string | null`). */
function quantitiesByProduct(items: { productId?: string | null; quantity: number }[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const it of items) {
    if (!it.productId) continue;
    out.set(it.productId, (out.get(it.productId) ?? 0) + it.quantity);
  }
  return out;
}

export async function updateInvoice(db: DbClient, id: string, input: InvoiceUpdateInput) {
  const existing = await getInvoice(db, id);
  if (!existing) throw new InvoiceError("Invoice not found", "NOT_FOUND", 404);

  if (!input.items.length) throw new InvoiceError("At least one line item is required", "NO_ITEMS");
  const badQty = input.items.find((it) => !(it.quantity > 0));
  if (badQty) throw new InvoiceError(`Item "${badQty.productName}" needs a quantity of at least 1`, "BAD_QUANTITY");

  // ── Totals — identical math to createInvoice ──────────────────────────
  const subtotal = input.items.reduce((sum, it) => sum + it.quantity * it.price, 0);
  const delivery = input.deliveryCharge ?? 0;
  const discount = input.discount ?? 0;
  const materialReturnedValue = input.materialReturnedValue ?? 0;
  const total = Math.max(0, subtotal + delivery - discount - materialReturnedValue);
  const settingsRow = await db.query.settings.findFirst();
  const allowZeroTotal = settingsRow?.allowZeroTotal ?? true;
  if (!allowZeroTotal && !(total > 0))
    throw new InvoiceError("Invoice total must be greater than 0 — check item prices, discount and delivery charge", "ZERO_TOTAL");
  const amountPaid = Math.min(input.amountPaid ?? 0, total);

  // ── Stock: signed per-product delta (old lines − new lines) ──────────
  const oldQty = quantitiesByProduct(existing.items);
  const newQty = quantitiesByProduct(input.items);
  const deltas = new Map<string, number>();
  for (const [pid, q] of newQty) deltas.set(pid, q - (oldQty.get(pid) ?? 0));
  for (const [pid, q] of oldQty) if (!deltas.has(pid)) deltas.set(pid, -q);

  // Validate every INCREASE up front — no partial write if stock is short.
  for (const [pid, delta] of deltas) {
    if (delta <= 0) continue;
    const product = await getProduct(db, pid);
    if (!product) throw new InvoiceError("A product on this bill no longer exists", "PRODUCT_NOT_FOUND", 404);
    if (product.stock < delta)
      throw new InvoiceError(`Not enough stock for "${product.name}" (${product.stock} left, need ${delta})`, "INSUFFICIENT_STOCK", 409);
  }

  const status: InvoiceInput["status"] =
    input.status ?? (amountPaid >= total && total > 0 ? "PAID" : amountPaid > 0 ? "PARTIAL" : "UNPAID");

  const pricingContext = input.items.some((it) => it.productId)
    ? await loadGoldPricing(db, { goldBaseRate: input.goldRate, silverBaseRate: input.silverRate })
    : null;

  const now = new Date();
  const [row] = await db
    .update(schema.invoices)
    .set({
      partyId: input.partyId ?? null,
      customerName: input.customerName?.trim() || null,
      customerPhone: input.customerPhone?.trim() || null,
      customerAddress: input.customerAddress?.trim() || null,
      // Keep the original bill date when the caller omits it.
      date: input.date ? new Date(input.date) : existing.date,
      status: status ?? "UNPAID",
      subtotal,
      deliveryCharge: delivery,
      discount,
      materialReturnedWeight: input.materialReturnedWeight?.trim() || null,
      materialReturnedValue,
      materialReturnedTitle: input.materialReturnedTitle?.trim() || null,
      total,
      amountPaid,
      notes: input.notes?.trim() || null,
      shopDetails: input.shopDetails ?? null,
      templateSettings: input.templateSettings ?? null,
      goldRate: input.goldRate && input.goldRate > 0 ? input.goldRate : null,
      silverRate: input.silverRate && input.silverRate > 0 ? input.silverRate : null,
      updatedAt: now,
    })
    .where(eq(schema.invoices.id, id))
    .returning();
  if (!row) throw new InvoiceError("Invoice not found", "NOT_FOUND", 404);

  // ── Lines: replace wholesale (same columns as the create path) ───────
  // Line ids are not referenced anywhere (no FK points at invoice_items), so
  // delete-then-insert is safe and matches how `updateOrder` rewrites lines.
  await db.delete(schema.invoiceItems).where(eq(schema.invoiceItems.invoiceId, id));
  for (const item of input.items) {
    const product = item.productId ? await getProduct(db, item.productId) : undefined;
    await db.insert(schema.invoiceItems).values({
      invoiceId: id,
      productId: item.productId ?? null,
      productName: item.productName.trim(),
      sku: item.sku || product?.sku || null,
      color: item.color || product?.colorName || null,
      size: item.size || product?.sizeName || null,
      description: item.description?.trim() || null,
      purity: item.purity?.trim() || product?.purity || null,
      grossWeight: item.grossWeight || product?.grossWeight || null,
      nagLessWeight: item.nagLessWeight ?? null,
      chejatWeight: item.chejatWeight ?? null,
      weight: item.weight ?? product?.weight ?? null,
      weightUnit: item.weightUnit ?? product?.weightUnit ?? null,
      quantity: item.quantity,
      price: item.price,
      total: item.quantity * item.price,
      // The client-computed snapshot (bill-screen rate/labour/charge edits)
      // wins; otherwise freeze the product's own pricing as before.
      pricing: item.pricing ?? (product ? pricingSnapshotFor(product, pricingContext) : null),
    });
  }

  // ── Stock: apply the deltas + log each movement ──────────────────────
  for (const [pid, delta] of deltas) {
    if (delta === 0) continue;
    const product = await getProduct(db, pid);
    if (!product) continue; // product deleted — there's no stock left to move
    const newStock = product.stock - delta;
    await db
      .update(schema.products)
      .set({ stock: newStock, updatedAt: now })
      .where(eq(schema.products.id, pid));
    await db.insert(schema.stockMovements).values({
      productId: pid,
      // +delta = more sold now; −delta = returned to the shelf.
      type: delta > 0 ? "SALE" : "RETURN",
      quantity: Math.abs(delta),
      stockAfter: newStock,
      referenceType: "invoice",
      referenceId: id,
      note: `Invoice ${existing.invoiceNumber} (edited)`,
    });
  }

  // ── Money: keep the payment rows equal to amountPaid ─────────────────
  const paymentRows = await db
    .select()
    .from(schema.payments)
    .where(and(eq(schema.payments.invoiceId, id), eq(schema.payments.direction, "IN")))
    .orderBy(desc(schema.payments.date), desc(schema.payments.createdAt));
  const recorded = paymentRows.reduce((sum, p) => sum + p.amount, 0);
  const diff = amountPaid - recorded;

  if (diff > MONEY_EPS) {
    await db.insert(schema.payments).values({
      invoiceId: id,
      partyId: input.partyId ?? null,
      direction: "IN",
      amount: diff,
      method: input.paymentMethod || "cash",
      date: now,
      note: `Payment for ${existing.invoiceNumber} (adjusted on edit)`,
    });
  } else if (diff < -MONEY_EPS) {
    // Unwind the NEWEST payments first — a correction usually targets the
    // last entry, and older rows keep their original dates intact.
    let remaining = -diff;
    for (const p of paymentRows) {
      if (remaining <= MONEY_EPS) break;
      if (p.amount <= remaining + MONEY_EPS) {
        await db.delete(schema.payments).where(eq(schema.payments.id, p.id));
        remaining -= p.amount;
      } else {
        await db
          .update(schema.payments)
          .set({ amount: p.amount - remaining })
          .where(eq(schema.payments.id, p.id));
        remaining = 0;
      }
    }
  }

  // Re-linking the bill to another khata party moves its payments too —
  // otherwise the OLD party's ledger would keep crediting money this bill no
  // longer belongs to.
  if ((input.partyId ?? null) !== existing.partyId) {
    await db
      .update(schema.payments)
      .set({ partyId: input.partyId ?? null })
      .where(eq(schema.payments.invoiceId, id));
  }

  await logActivity(
    db,
    "INVOICE_UPDATED",
    `Edited invoice ${existing.invoiceNumber} — total ${total.toLocaleString("en-IN")}, ${status}`,
  );
  return getInvoice(db, id);
}

/** Record a payment against an invoice; updates status + party money tracking. */
export async function recordInvoicePayment(
  db: DbClient,
  invoiceId: string,
  input: { amount: number; method?: string; date?: string | Date; note?: string },
) {
  const invoice = await getInvoice(db, invoiceId);
  if (!invoice) throw new InvoiceError("Invoice not found", "NOT_FOUND", 404);
  if (input.amount <= 0) throw new InvoiceError("Payment amount must be positive", "INVALID_AMOUNT");

  const newPaid = Math.min(invoice.amountPaid + input.amount, invoice.total);
  const status: schema.Invoice["status"] = newPaid >= invoice.total ? "PAID" : newPaid > 0 ? "PARTIAL" : "UNPAID";

  await db
    .update(schema.invoices)
    .set({ amountPaid: newPaid, status, updatedAt: new Date() })
    .where(eq(schema.invoices.id, invoiceId));
  await db.insert(schema.payments).values({
    invoiceId,
    partyId: invoice.partyId,
    direction: "IN",
    amount: input.amount,
    method: input.method || "cash",
    date: input.date ? new Date(input.date) : new Date(),
    note: input.note?.trim() || `Payment for ${invoice.invoiceNumber}`,
  });

  await logActivity(db, "PAYMENT_RECEIVED", `Received ${input.amount} for ${invoice.invoiceNumber} — now ${status}`);
  return getInvoice(db, invoiceId);
}

export async function deleteInvoice(db: DbClient, id: string) {
  const invoice = await getInvoice(db, id);
  if (!invoice) throw new InvoiceError("Invoice not found", "NOT_FOUND", 404);

  // Restore stock for tracked items
  for (const item of invoice.items) {
    if (!item.productId) continue;
    const product = await getProduct(db, item.productId);
    if (!product) continue;
    const newStock = product.stock + item.quantity;
    await db
      .update(schema.products)
      .set({ stock: newStock, updatedAt: new Date() })
      .where(eq(schema.products.id, product.id));
    await db.insert(schema.stockMovements).values({
      productId: product.id,
      type: "RETURN",
      quantity: item.quantity,
      stockAfter: newStock,
      referenceType: "invoice",
      referenceId: id,
      note: `Deleted invoice ${invoice.invoiceNumber}`,
    });
  }

  await db.delete(schema.invoices).where(eq(schema.invoices.id, id));
  await logActivity(db, "INVOICE_DELETED", `Deleted invoice ${invoice.invoiceNumber}`);
  return { success: true };
}

