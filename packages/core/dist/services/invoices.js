import { and, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import * as schema from "../db/schema";
import { generateInvoiceNumber } from "../utils/codes";
import { getProduct } from "./products";
import { logActivity } from "./activity";
export class InvoiceError extends Error {
    code;
    status;
    constructor(message, code, status = 400) {
        super(message);
        this.code = code;
        this.status = status;
    }
}
/** Quick single-product sale (like the stockPilot "sell" flow). Decrements stock. */
export async function createSale(db, input) {
    const product = await getProduct(db, input.productId);
    if (!product)
        throw new InvoiceError("Selected product no longer exists", "PRODUCT_NOT_FOUND", 404);
    if (input.quantity <= 0)
        throw new InvoiceError("Quantity must be greater than 0", "INVALID_QUANTITY");
    const price = input.sellingPrice ?? product.sellingPrice;
    const total = price * input.quantity;
    const newStock = product.stock - input.quantity;
    if (newStock < 0)
        throw new InvoiceError("Not enough stock available for this sale", "INSUFFICIENT_STOCK", 409);
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
    if (!invoice)
        throw new InvoiceError("Failed to create invoice", "CREATE_FAILED", 500);
    await db.insert(schema.invoiceItems).values({
        invoiceId: invoice.id,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        color: product.colorName,
        size: product.sizeName,
        quantity: input.quantity,
        price,
        total,
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
    await logActivity(db, "SALE_CREATED", `Sold ${input.quantity} × "${product.name}" (${product.sku}) — Invoice ${invoiceNumber}`);
    return getInvoice(db, invoice.id);
}
export async function createInvoice(db, input) {
    if (!input.items.length)
        throw new InvoiceError("At least one line item is required", "NO_ITEMS");
    const invoiceNumber = await generateInvoiceNumber(async (num) => {
        const r = await db.select({ id: schema.invoices.id }).from(schema.invoices).where(eq(schema.invoices.invoiceNumber, num));
        return r.length > 0;
    });
    const subtotal = input.items.reduce((sum, it) => sum + it.quantity * it.price, 0);
    const delivery = input.deliveryCharge ?? 0;
    const discount = input.discount ?? 0;
    const total = Math.max(0, subtotal + delivery - discount);
    const amountPaid = Math.min(input.amountPaid ?? 0, total);
    // Validate + reserve stock
    const stockChecks = new Map();
    for (const item of input.items) {
        if (item.productId) {
            const product = await getProduct(db, item.productId);
            if (!product)
                throw new InvoiceError(`Product "${item.productName}" no longer exists`, "PRODUCT_NOT_FOUND", 404);
            if (product.stock < item.quantity)
                throw new InvoiceError(`Not enough stock for "${product.name}" (${product.stock} left, need ${item.quantity})`, "INSUFFICIENT_STOCK", 409);
            stockChecks.set(item.productId, { qty: item.quantity, product });
        }
    }
    const status = input.status ?? (amountPaid >= total && total > 0 ? "PAID" : amountPaid > 0 ? "PARTIAL" : "UNPAID");
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
        total,
        amountPaid,
        notes: input.notes?.trim() || null,
        shopDetails: input.shopDetails ?? null,
        templateSettings: input.templateSettings ?? null,
    })
        .returning();
    if (!invoice)
        throw new InvoiceError("Failed to create invoice", "CREATE_FAILED", 500);
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
            quantity: item.quantity,
            price: item.price,
            total: item.quantity * item.price,
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
    await logActivity(db, "INVOICE_CREATED", `Created invoice ${invoiceNumber} — ${total.toLocaleString("en-IN")}${input.customerName ? ` for ${input.customerName}` : ""}`);
    return getInvoice(db, invoice.id);
}
export async function getInvoice(db, id) {
    const invoice = await db.select().from(schema.invoices).where(eq(schema.invoices.id, id));
    if (!invoice[0])
        return null;
    const items = await db
        .select()
        .from(schema.invoiceItems)
        .where(eq(schema.invoiceItems.invoiceId, id))
        .orderBy(schema.invoiceItems.id);
    return { ...invoice[0], items };
}
export async function listInvoices(db, filters = {}) {
    const search = filters.search?.trim() || "";
    const conditions = [];
    if (search) {
        conditions.push(or(ilike(schema.invoices.invoiceNumber, `%${search}%`), ilike(schema.invoices.customerName, `%${search}%`), ilike(schema.invoices.customerPhone, `%${search}%`)));
    }
    if (filters.status && filters.status !== "all")
        conditions.push(eq(schema.invoices.status, filters.status));
    if (filters.partyId)
        conditions.push(eq(schema.invoices.partyId, filters.partyId));
    if (filters.startDate || filters.endDate) {
        const range = [];
        if (filters.startDate)
            range.push(gte(schema.invoices.date, new Date(filters.startDate)));
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
        .where(rows.length
        ? inArray(schema.invoiceItems.invoiceId, rows.map((r) => r.id))
        : sql `false`);
    const itemsByInvoice = new Map();
    for (const it of items) {
        const list = itemsByInvoice.get(it.invoiceId) ?? [];
        list.push(it);
        itemsByInvoice.set(it.invoiceId, list);
    }
    const totalCount = await db
        .select({ count: sql `count(*)::int` })
        .from(schema.invoices)
        .where(where)
        .then((r) => r[0]?.count ?? 0);
    return {
        invoices: rows.map((r) => ({ ...r, items: itemsByInvoice.get(r.id) ?? [] })),
        pagination: { page, pageSize, totalCount, totalPages: Math.ceil(totalCount / pageSize) },
    };
}
/** Record a payment against an invoice; updates status + party money tracking. */
export async function recordInvoicePayment(db, invoiceId, input) {
    const invoice = await getInvoice(db, invoiceId);
    if (!invoice)
        throw new InvoiceError("Invoice not found", "NOT_FOUND", 404);
    if (input.amount <= 0)
        throw new InvoiceError("Payment amount must be positive", "INVALID_AMOUNT");
    const newPaid = Math.min(invoice.amountPaid + input.amount, invoice.total);
    const status = newPaid >= invoice.total ? "PAID" : newPaid > 0 ? "PARTIAL" : "UNPAID";
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
export async function deleteInvoice(db, id) {
    const invoice = await getInvoice(db, id);
    if (!invoice)
        throw new InvoiceError("Invoice not found", "NOT_FOUND", 404);
    // Restore stock for tracked items
    for (const item of invoice.items) {
        if (!item.productId)
            continue;
        const product = await getProduct(db, item.productId);
        if (!product)
            continue;
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
//# sourceMappingURL=invoices.js.map