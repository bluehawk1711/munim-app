/**
 * Orders — write down a customer order at the counter, generate the bill
 * later. Mirrors the invoices service shape (same totals math, filters,
 * pagination) with two deliberate differences:
 *
 * 1. NO stock reservation while the order is open — stock is checked by
 *    `createInvoice` at bill time (the item may sell out before then, and
 *    the counter needs to see that error at the moment of billing).
 * 2. NO pricing freeze on order lines — a line stores the QUOTED price and
 *    carries it into the bill as-is (the customer was quoted that number;
 *    moving gold rates must not silently change a written order).
 *
 * Numbers are 4-char codes (`ORD-7K2M`, see `generateOrderNumber`); bills
 * generated from an order get a normal `INV-4CHAR` number.
 */
import { and, desc, eq, exists, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import * as schema from "../db/schema.js";
import { generateOrderNumber } from "../utils/codes.js";
import { idOrNull } from "../utils/id.js";
import { mergeBillTemplateSettings } from "../billing/index.js";
import { logActivity } from "./activity.js";
import { loadGoldPricing } from "./goldRates.js";
import { createInvoice, getInvoice, type InvoiceWithItems } from "./invoices.js";
import { syncOrderPayments } from "./orderPayments.js";

export class OrderError extends Error {
  constructor(message: string, public code: string, public status = 400) {
    super(message);
  }
}

export type OrderItemInput = {
  productId?: string;
  productName: string;
  sku?: string;
  color?: string;
  size?: string;
  description?: string;
  /** Product weight + unit snapshot — bill WEIGHT column display only. */
  weight?: number | null;
  weightUnit?: string | null;
  quantity: number;
  /** Quoted unit price at order time — the bill uses this exact number. */
  price: number;
};

export type OrderInput = {
  partyId?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  date?: string | Date;
  items: OrderItemInput[];
  deliveryCharge?: number;
  discount?: number;
  /** Advance / part-payment taken on the order (clamped to the total). */
  amountPaid?: number;
  /** How the advance was paid (cash / upi / card / cheque / bank / free text). */
  paymentMethod?: string;
  /** Optional reference for the advance (UPI ref / txn no.). */
  paymentNote?: string;
  notes?: string;
};

/** Partial edit of an OPEN order (blocked entirely once a bill exists). */
export type OrderUpdateInput = {
  partyId?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  date?: string | Date;
  items?: OrderItemInput[];
  deliveryCharge?: number;
  discount?: number;
  /** Advance / part-payment (clamped to the recomputed total). */
  amountPaid?: number;
  /** How the (added) advance was received — only used for the money newly
   *  inserted by this edit; existing rows keep the method they were taken by. */
  paymentMethod?: string;
  /** Optional reference for the added advance. */
  paymentNote?: string;
  notes?: string;
  status?: schema.Order["status"];
};

function validateItems(items: ReadonlyArray<{ productName: string; quantity: number }>): void {
  if (!items.length) throw new OrderError("At least one line item is required", "NO_ITEMS");
  const badQty = items.find((it) => !(it.quantity > 0));
  if (badQty) throw new OrderError(`Item "${badQty.productName}" needs a quantity of at least 1`, "BAD_QUANTITY");
}

function totalsOf(items: OrderItemInput[], delivery: number, discount: number) {
  const subtotal = items.reduce((sum, it) => sum + it.quantity * it.price, 0);
  return { subtotal, total: Math.max(0, subtotal + delivery - discount) };
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Money collected can never exceed what the order is actually worth. */
function clampPaid(amountPaid: number, total: number): number {
  return round2(Math.min(Math.max(0, amountPaid), total));
}

export async function createOrder(db: DbClient, input: OrderInput) {
  validateItems(input.items);
  const delivery = input.deliveryCharge ?? 0;
  const discount = input.discount ?? 0;
  const { subtotal, total } = totalsOf(input.items, delivery, discount);

  const orderNumber = await generateOrderNumber(async (num) => {
    const r = await db.select({ id: schema.orders.id }).from(schema.orders).where(eq(schema.orders.orderNumber, num));
    return r.length > 0;
  });

  // Advance taken at the counter — carried into the bill when it's generated.
  const amountPaid = clampPaid(input.amountPaid ?? 0, total);

  const [order] = await db
    .insert(schema.orders)
    .values({
      orderNumber,
      partyId: idOrNull(input.partyId),
      customerName: input.customerName?.trim() || null,
      customerPhone: input.customerPhone?.trim() || null,
      customerAddress: input.customerAddress?.trim() || null,
      date: input.date ? new Date(input.date) : new Date(),
      subtotal,
      deliveryCharge: delivery,
      discount,
      total,
      amountPaid,
      notes: input.notes?.trim() || null,
    })
    .returning();
  if (!order) throw new OrderError("Failed to create order", "CREATE_FAILED", 500);

  for (const item of input.items) {
    await db.insert(schema.orderItems).values({
      orderId: order.id,
      productId: item.productId ?? null,
      productName: item.productName.trim(),
      sku: item.sku || null,
      color: item.color || null,
      size: item.size || null,
      description: item.description?.trim() || null,
      weight: item.weight ?? null,
      weightUnit: item.weightUnit ?? null,
      quantity: item.quantity,
      price: item.price,
      total: item.quantity * item.price,
    });
  }

  // Advance taken at the counter gets a ledger row too — the order's payment
  // trail is complete from the very first rupee, not just from later parts.
  if (amountPaid > 0) {
    await db.insert(schema.payments).values({
      orderId: order.id,
      partyId: idOrNull(input.partyId),
      direction: "IN",
      amount: amountPaid,
      method: input.paymentMethod?.trim() || "cash",
      note: input.paymentNote?.trim() || null,
    });
  }

  await logActivity(
    db,
    "ORDER_CREATED",
    `Created order ${orderNumber} — ${total.toLocaleString("en-IN")}${input.customerName ? ` for ${input.customerName}` : ""}${
      amountPaid > 0 ? ` · ${amountPaid.toLocaleString("en-IN")} received` : ""
    }`,
  );
  return getOrder(db, order.id);
}

export type OrderWithItems = schema.Order & { items: schema.OrderItem[] };

export async function getOrder(db: DbClient, id: string): Promise<OrderWithItems | null> {
  const order = await db.select().from(schema.orders).where(eq(schema.orders.id, id));
  if (!order[0]) return null;
  const items = await db
    .select()
    .from(schema.orderItems)
    .where(eq(schema.orderItems.orderId, id))
    .orderBy(schema.orderItems.id);
  return { ...order[0], items };
}

export type OrderFilters = {
  search?: string;
  status?: schema.Order["status"] | "all";
  partyId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
};

export async function listOrders(db: DbClient, filters: OrderFilters = {}) {
  const search = filters.search?.trim() || "";
  const conditions = [];
  if (search) {
    // Prefix-insensitive: `ilike %7K2M%` matches both the bare code and
    // the stored `ORD-7K2M` (full "ORD-7K2M" also matches).
    // Orders are ALSO found by WHAT was ordered — at the counter "any order
    // for a chain?" comes up far more often than a 4-char code does.
    const term = `%${search}%`;
    conditions.push(
      or(
        ilike(schema.orders.orderNumber, term),
        ilike(schema.orders.customerName, term),
        ilike(schema.orders.customerPhone, term),
        exists(
          db
            .select({ id: schema.orderItems.id })
            .from(schema.orderItems)
            .where(
              and(
                eq(schema.orderItems.orderId, schema.orders.id),
                or(ilike(schema.orderItems.productName, term), ilike(schema.orderItems.sku, term)),
              ),
            ),
        ),
      ),
    );
  }
  if (filters.status && filters.status !== "all") conditions.push(eq(schema.orders.status, filters.status));
  if (filters.partyId) conditions.push(eq(schema.orders.partyId, filters.partyId));
  if (filters.startDate || filters.endDate) {
    const range: ReturnType<typeof gte>[] = [];
    if (filters.startDate) range.push(gte(schema.orders.date, new Date(filters.startDate)));
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      range.push(lte(schema.orders.date, end));
    }
    conditions.push(and(...range));
  }

  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.max(1, Math.min(200, filters.pageSize || 20));
  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(schema.orders)
    .where(where)
    .orderBy(desc(schema.orders.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const items = await db
    .select()
    .from(schema.orderItems)
    .where(rows.length ? inArray(schema.orderItems.orderId, rows.map((r) => r.id)) : sql`false`);

  const itemsByOrder = new Map<string, schema.OrderItem[]>();
  for (const it of items) {
    const list = itemsByOrder.get(it.orderId) ?? [];
    list.push(it);
    itemsByOrder.set(it.orderId, list);
  }

  const totalCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.orders)
    .where(where)
    .then((r) => r[0]?.count ?? 0);

  return {
    orders: rows.map((r) => ({ ...r, items: itemsByOrder.get(r.id) ?? [] })),
    pagination: { page, pageSize, totalCount, totalPages: Math.ceil(totalCount / pageSize) },
  };
}

/** Edit an open order. Blocked once a bill has been generated from it. */
export async function updateOrder(db: DbClient, id: string, input: OrderUpdateInput) {
  const existing = await getOrder(db, id);
  if (!existing) throw new OrderError("Order not found", "NOT_FOUND", 404);
  if (existing.invoiceId) {
    throw new OrderError("A bill was already generated from this order — edit the invoice instead", "ALREADY_BILLED", 409);
  }

  const items: OrderItemInput[] =
    input.items ??
    existing.items.map((it) => ({
      productId: it.productId ?? undefined,
      productName: it.productName,
      sku: it.sku ?? undefined,
      color: it.color ?? undefined,
      size: it.size ?? undefined,
      description: it.description ?? undefined,
      weight: it.weight ?? undefined,
      weightUnit: it.weightUnit ?? undefined,
      quantity: it.quantity,
      price: it.price,
    }));
  if (input.items) validateItems(items);
  const delivery = input.deliveryCharge ?? existing.deliveryCharge;
  const discount = input.discount ?? existing.discount;
  const { subtotal, total } = totalsOf(items, delivery, discount);
  // Re-clamp: rewriting the lines can shrink the total below what's collected.
  const amountPaid = clampPaid(input.amountPaid ?? existing.amountPaid, total);
  const nextPartyId = input.partyId !== undefined ? idOrNull(input.partyId) : existing.partyId;
  const partyChanged = nextPartyId !== existing.partyId;
  // Any change that can move the money (lines, totals or the linked party)
  // must also move the ledger rows — otherwise the khata keeps crediting the
  // OLD advance while the order shows the new one.
  const moneyChanged =
    input.items !== undefined ||
    input.amountPaid !== undefined ||
    input.deliveryCharge !== undefined ||
    input.discount !== undefined ||
    partyChanged;

  await db
    .update(schema.orders)
    .set({
      ...(input.partyId !== undefined ? { partyId: idOrNull(input.partyId) } : {}),
      ...(input.customerName !== undefined ? { customerName: input.customerName.trim() || null } : {}),
      ...(input.customerPhone !== undefined ? { customerPhone: input.customerPhone.trim() || null } : {}),
      ...(input.customerAddress !== undefined ? { customerAddress: input.customerAddress.trim() || null } : {}),
      ...(input.date !== undefined ? { date: new Date(input.date) } : {}),
      ...(input.notes !== undefined ? { notes: input.notes.trim() || null } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      deliveryCharge: delivery,
      discount,
      subtotal,
      total,
      amountPaid,
      updatedAt: new Date(),
    })
    .where(eq(schema.orders.id, id));

  if (input.items) {
    await db.delete(schema.orderItems).where(eq(schema.orderItems.orderId, id));
    for (const item of items) {
      await db.insert(schema.orderItems).values({
        orderId: id,
        productId: idOrNull(item.productId),
        productName: item.productName.trim(),
        sku: item.sku || null,
        color: item.color || null,
        size: item.size || null,
        description: item.description?.trim() || null,
        weight: item.weight ?? null,
        weightUnit: item.weightUnit ?? null,
        quantity: item.quantity,
        price: item.price,
        total: item.quantity * item.price,
      });
    }
  }

  if (moneyChanged) {
    await syncOrderPayments(
      db,
      { id, orderNumber: existing.orderNumber, partyId: nextPartyId },
      amountPaid,
      { partyChanged, method: input.paymentMethod, note: input.paymentNote },
    );
  }

  const updated = await getOrder(db, id);
  if (!updated) throw new OrderError("Order not found after update", "NOT_FOUND", 404);
  return updated;
}

export type OrderPaymentInput = {
  /** Money received against the order (₹) — added to what's already in. */
  amount: number;
  /** How it was paid (cash / upi / card / cheque / bank / free text). */
  method?: string;
  note?: string;
};

/**
 * Record an advance / part-payment on an order.
 *
 * Orders keep a single running `amountPaid` (no per-payment ledger), which is
 * all the counter needs to answer "paid how much, still due how much". Once
 * the order is billed the money belongs to the INVOICE, so payments here are
 * blocked from that point on — otherwise the two figures would drift apart.
 */
export async function recordOrderPayment(db: DbClient, orderId: string, input: OrderPaymentInput) {
  const existing = await getOrder(db, orderId);
  if (!existing) throw new OrderError("Order not found", "NOT_FOUND", 404);
  if (existing.invoiceId) {
    throw new OrderError("This order was already billed — record the payment on the invoice", "ALREADY_BILLED", 409);
  }
  if (existing.status === "CANCELLED") throw new OrderError("This order was cancelled", "CANCELLED", 409);

  const amount = round2(input.amount);
  if (!(amount > 0)) throw new OrderError("Payment must be more than zero", "BAD_AMOUNT");

  const already = existing.amountPaid;
  const next = clampPaid(already + amount, existing.total);
  const credited = round2(next - already);
  if (!(credited > 0)) {
    throw new OrderError("That order is already settled in full", "ALREADY_SETTLED", 409);
  }

  await db
    .update(schema.orders)
    .set({ amountPaid: next, updatedAt: new Date() })
    .where(eq(schema.orders.id, orderId));

  // Ledger row — same `payments` table the invoice trail uses, so every app
  // can render the order's full payment history (amount · method · note · date).
  await db.insert(schema.payments).values({
    orderId,
    partyId: existing.partyId,
    direction: "IN",
    amount: credited,
    method: input.method?.trim() || "cash",
    note: input.note?.trim() || null,
  });

  await logActivity(
    db,
    "ORDER_PAYMENT",
    `Received ${credited.toLocaleString("en-IN")} on order ${existing.orderNumber}${
      input.note ? ` — ${input.note}` : ""
    }`,
  );

  const updated = await getOrder(db, orderId);
  if (!updated) throw new OrderError("Order not found after payment", "NOT_FOUND", 404);
  return updated;
}

/** The order's payment trail — advances & part-payments, newest last. */
export async function listOrderPayments(db: DbClient, orderId: string): Promise<schema.Payment[]> {
  return db
    .select()
    .from(schema.payments)
    .where(and(eq(schema.payments.orderId, orderId), eq(schema.payments.direction, "IN")))
    .orderBy(schema.payments.date, schema.payments.createdAt);
}

export async function deleteOrder(db: DbClient, id: string) {
  const existing = await getOrder(db, id);
  if (!existing) throw new OrderError("Order not found", "NOT_FOUND", 404);
  if (existing.invoiceId) {
    throw new OrderError("A bill was generated from this order — delete the invoice instead", "ALREADY_BILLED", 409);
  }
  await db.delete(schema.orders).where(eq(schema.orders.id, id));
  await logActivity(db, "ORDER_DELETED", `Deleted order ${existing.orderNumber}`);
  return { success: true };
}

/** Service-level result: rows with Date objects (the API serializes it
 *  into the `BillFromOrderResult` DTO in serialize/index.ts). */
export type OrderBilledResult = { invoice: InvoiceWithItems; order: OrderWithItems };

/**
 * Generate the bill for an order: maps the quoted lines into a fresh
 * invoice (`INV-4CHAR`, stock checked at THIS moment), links it back and
 * marks the order COMPLETED. Quoted prices are honored as-is, and the
 * advance already collected on the order becomes the invoice's opening
 * `amountPaid` — moved over, never re-recorded, so the khata is not credited
 * twice for the same rupees.
 */
export async function generateBillFromOrder(db: DbClient, orderId: string): Promise<OrderBilledResult> {
  const order = await getOrder(db, orderId);
  if (!order) throw new OrderError("Order not found", "NOT_FOUND", 404);
  if (order.invoiceId) throw new OrderError("A bill was already generated from this order", "ALREADY_BILLED", 409);
  if (order.status === "CANCELLED") throw new OrderError("This order was cancelled", "CANCELLED", 409);
  validateItems(order.items);

  // Snapshots for the printed bill — the same shop header and rate rows a
  // bill written on the bill screen would freeze at save time. The base karat
  // is the highest quoted one, exactly like `listGoldRates` picks it.
  const [settingsRow, pricing] = await Promise.all([db.query.settings.findFirst(), loadGoldPricing(db)]);
  let baseKarat = -1;
  let goldRate: number | undefined;
  for (const entry of pricing.table) {
    if (!entry.isCustom || entry.ratePerGram <= 0 || entry.karat < baseKarat) continue;
    baseKarat = entry.karat;
    goldRate = entry.ratePerGram;
  }

  const invoice = await createInvoice(db, {
    partyId: order.partyId ?? undefined,
    customerName: order.customerName ?? undefined,
    customerPhone: order.customerPhone ?? undefined,
    customerAddress: order.customerAddress ?? undefined,
    // No `date`: the sale happens NOW, so the bill carries today's date (and
    // lands in today's sales) even when the order was written days ago.
    items: order.items.map((it) => ({
      productId: it.productId ?? undefined,
      productName: it.productName,
      sku: it.sku ?? undefined,
      color: it.color ?? undefined,
      size: it.size ?? undefined,
      description: it.description ?? undefined,
      weight: it.weight ?? undefined,
      weightUnit: it.weightUnit ?? undefined,
      // The quoted price is a manual line price — freezing today's product
      // breakdown would print a rate/labour that no longer adds up to the
      // quote (and would differ from the estimate the customer signed).
      pricing: null,
      quantity: it.quantity,
      price: it.price,
    })),
    deliveryCharge: order.deliveryCharge,
    discount: order.discount,
    // The advance is MOVED over below — passing it here would create a second
    // payment row for money the order already recorded.
    amountPaid: 0,
    notes: order.notes ?? undefined,
    shopDetails: settingsRow
      ? {
          name: settingsRow.shopName,
          address: settingsRow.shopAddress ?? "",
          phones: settingsRow.shopPhones,
          email: settingsRow.shopEmail ?? "",
        }
      : undefined,
    templateSettings: mergeBillTemplateSettings(),
    goldRate,
    silverRate: pricing.silverRatePerGram > 0 ? pricing.silverRatePerGram : undefined,
  });
  if (!invoice) throw new OrderError("Failed to generate the bill", "BILL_FAILED", 500);

  // Carry the advance onto the bill. `syncOrderPayments` also backfills
  // legacy orders that were paid before rows were tracked.
  const paid = clampPaid(order.amountPaid, invoice.total);
  await syncOrderPayments(db, { id: order.id, orderNumber: order.orderNumber, partyId: order.partyId }, paid);

  if (paid > 0) {
    // The bill owns the money from here on — re-point the order's rows so the
    // invoice's payment trail (and its khata credit) shows the advance.
    await db
      .update(schema.payments)
      .set({ invoiceId: invoice.id })
      .where(and(eq(schema.payments.orderId, order.id), eq(schema.payments.direction, "IN")));
    const billedStatus: schema.Invoice["status"] =
      paid >= invoice.total && invoice.total > 0 ? "PAID" : "PARTIAL";
    await db
      .update(schema.invoices)
      .set({ amountPaid: paid, status: billedStatus, updatedAt: new Date() })
      .where(eq(schema.invoices.id, invoice.id));
  }

  await db
    .update(schema.orders)
    .set({ invoiceId: invoice.id, status: "COMPLETED", updatedAt: new Date() })
    .where(eq(schema.orders.id, orderId));

  await logActivity(
    db,
    "ORDER_BILLED",
    `Generated bill ${invoice.invoiceNumber} from order ${order.orderNumber}${
      paid > 0 ? ` · ${paid.toLocaleString("en-IN")} advance carried over` : ""
    }`,
  );

  const updated = await getOrder(db, orderId);
  if (!updated) throw new OrderError("Order vanished during billing", "NOT_FOUND", 404);
  const billed = await getInvoice(db, invoice.id);
  if (!billed) throw new OrderError("The generated bill could not be reloaded", "BILL_FAILED", 500);
  return { invoice: billed, order: updated };
}

/** The invoice a bill-generating order points at (for "view bill" links). */
export async function getOrderInvoice(db: DbClient, orderId: string): Promise<InvoiceWithItems | null> {
  const order = await getOrder(db, orderId);
  if (!order?.invoiceId) return null;
  return getInvoice(db, order.invoiceId);
}
