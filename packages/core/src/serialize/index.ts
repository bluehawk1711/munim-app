/**
 * Shared JSON serializers — convert core domain rows (which carry `Date`
 * objects) into the plain JSON shapes sent over HTTP. Single source of truth
 * for the NestJS API (`apps/api`) and the web app (`apps/web`).
 */
import type {
  Product,
  Invoice,
  InvoiceItem,
  Party,
  Advance,
  Payment,
  JobLetter,
} from "../db/schema.js";

/* ── Products ─────────────────────────────────────────────────── */

/** Core product rows carry colorName/sizeName (from joins). */
export type ProductWithNames = Product & {
  colorName: string | null;
  sizeName: string | null;
  categoryName?: string | null;
};

export type ProductDto = {
  id: string;
  sku: string;
  name: string;
  color: string;
  size: string;
  category?: string;
  barcode: string | null;
  /** Weight in milligrams (mg). */
  weight: number | null;
  imageUrl: string | null;
  stock: number;
  purchasePrice: number;
  sellingPrice: number;
  lowStockThreshold: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export function serializeProduct(p: ProductWithNames): ProductDto {
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    color: p.colorName ?? "",
    size: p.sizeName ?? "",
    category: p.categoryName ?? "",
    barcode: p.barcode,
    weight: p.weight,
    imageUrl: p.imageUrl,
    stock: p.stock,
    purchasePrice: p.purchasePrice,
    sellingPrice: p.sellingPrice,
    notes: p.notes,
    lowStockThreshold: p.lowStockThreshold,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

/* ── Invoices / bills ─────────────────────────────────────────── */

type InvoiceWithItems = Invoice & { items: InvoiceItem[] };

export function serializeInvoice(inv: InvoiceWithItems) {
  return {
    ...inv,
    date: inv.date.toISOString(),
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
    items: (inv.items ?? []).map((i) => ({ ...i })),
  };
}

/* ── Sales (flattened sale rows for quick-sale lists) ─────────── */

export type SaleDto = {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  productId: string | null;
  productName: string;
  sku: string | null;
  color: string | null;
  size: string | null;
  quantity: number;
  sellingPrice: number;
  total: number;
  status: "DRAFT" | "UNPAID" | "PARTIAL" | "PAID";
  createdAt: string;
};

/** Maps a core invoice + items into the flattened Sale DTO the UIs expect. */
export function serializeSale(invoice: InvoiceWithItems): SaleDto {
  const item = (invoice.items ?? [])[0];
  return {
    id: invoice.id,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    productId: item?.productId ?? null,
    productName: item?.productName ?? invoice.customerName ?? "—",
    sku: item?.sku ?? null,
    color: item?.color ?? null,
    size: item?.size ?? null,
    quantity: item?.quantity ?? 0,
    sellingPrice: item?.price ?? invoice.total,
    total: invoice.total,
    status: invoice.status,
    createdAt: invoice.createdAt.toISOString(),
  };
}

/* ── Parties (khata) ──────────────────────────────────────────── */

export function serializeParty(p: { createdAt: Date }) {
  return { ...p, createdAt: p.createdAt.toISOString() };
}

/* ── Advances & payments ──────────────────────────────────────── */

export function serializeAdvance(a: { date: Date; createdAt: Date }) {
  return { ...a, date: a.date.toISOString(), createdAt: a.createdAt.toISOString() };
}

export function serializePayment(p: { date: Date; createdAt: Date }) {
  return { ...p, date: p.date.toISOString(), createdAt: p.createdAt.toISOString() };
}

/* ── Job letters ──────────────────────────────────────────────── */

export function serializeJobLetter(l: { createdAt: Date }) {
  return { ...l, createdAt: l.createdAt.toISOString() };
}
