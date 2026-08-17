/**
 * Shared JSON serializers — convert core domain rows (which carry `Date`
 * objects) into the plain JSON shapes sent over HTTP. Single source of truth
 * for the NestJS API (`apps/api`) and the web app (`apps/web`).
 *
 * The `*Dto` types exported here ARE the wire contract: the shared
 * `@munim/api-client` re-exports them, so desktop/mobile/web consumers never
 * redefine a DTO. Add any new wire shape here, never in an app.
 */
import type {
  Product,
  Invoice,
  InvoiceItem,
  Party,
  Advance,
  Payment,
  JobLetter,
  StockMovement,
  ActivityLog,
  Settings,
} from "../db/schema.js";
import type { DashboardStats, ReportRow, ReportType } from "../services/dashboard.js";
import type { LedgerLine } from "../services/parties.js";

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

/** Invoice line items carry no Date fields — the schema row IS the DTO. */
export type InvoiceItemDto = InvoiceItem;

export type InvoiceDto = Omit<Invoice, "date" | "createdAt" | "updatedAt"> & {
  date: string;
  createdAt: string;
  updatedAt: string;
  items: InvoiceItemDto[];
};

export function serializeInvoice(inv: Invoice & { items: InvoiceItem[] }): InvoiceDto {
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
export function serializeSale(invoice: Invoice & { items: InvoiceItem[] }): SaleDto {
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

export type PartyDto = Omit<Party, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

/** A party with its net ledger balance (balance > 0 → they owe us). */
export type PartyBalanceDto = PartyDto & {
  balance: number;
  given: number;
  taken: number;
};

export type LedgerLineDto = Omit<LedgerLine, "date"> & { date: string };

export function serializeParty(p: Party): PartyDto {
  return { ...p, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString() };
}

/* ── Advances & payments ──────────────────────────────────────── */

export type AdvanceDto = Omit<Advance, "date" | "createdAt"> & {
  date: string;
  createdAt: string;
};

export type PaymentDto = Omit<Payment, "date" | "createdAt"> & {
  date: string;
  createdAt: string;
};

export function serializeAdvance(a: Advance): AdvanceDto {
  return { ...a, date: a.date.toISOString(), createdAt: a.createdAt.toISOString() };
}

export function serializePayment(p: Payment): PaymentDto {
  return { ...p, date: p.date.toISOString(), createdAt: p.createdAt.toISOString() };
}

/* ── Job letters ──────────────────────────────────────────────── */

export type JobLetterDto = Omit<JobLetter, "createdAt"> & { createdAt: string };

export function serializeJobLetter(l: JobLetter): JobLetterDto {
  return { ...l, createdAt: l.createdAt.toISOString() };
}

/* ── Stock movements & activity ───────────────────────────────── */

export type StockMovementDto = Omit<StockMovement, "createdAt"> & { createdAt: string };

export type ActivityLogDto = Omit<ActivityLog, "createdAt"> & { createdAt: string };

/* ── Settings ─────────────────────────────────────────────────── */

export type SettingsDto = Omit<Settings, "updatedAt"> & { updatedAt: string };

/* ── Dashboard & reports ──────────────────────────────────────── */

/** Wire shape of GET /api/dashboard (dates serialized, balances resolved). */
export type DashboardDto = Omit<
  DashboardStats,
  "recentInvoices" | "recentActivity" | "recentAdvances"
> & {
  recentInvoices: InvoiceDto[];
  recentActivity: ActivityLogDto[];
  recentAdvances: (AdvanceDto & { partyName?: string })[];
};

/** Wire shape of GET /api/reports (already Date-free in core). */
export type ReportDto = {
  type: ReportType;
  title: string;
  generatedAt: string;
  periodLabel: string;
  rows: ReportRow[];
  totals: {
    stock: number;
    soldQuantity: number;
    soldWeight: number;
    revenue: number;
    profit: number;
  };
};

/* ── Pagination (shared list envelope) ────────────────────────── */

export type Pagination = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};
