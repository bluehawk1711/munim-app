// Shared types for the Munim web app.
// These mirror the domain types from @munim/core, kept in a flattened shape
// the existing UI components already expect.

export type Product = {
  id: string
  sku: string
  name: string
  color: string
  size: string
  category?: string
  barcode: string | null
  imageUrl: string | null
  stock: number
  purchasePrice: number
  sellingPrice: number
  lowStockThreshold: number
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type Sale = {
  id: string
  invoiceId: string
  invoiceNumber: string
  productId: string | null
  productName: string
  sku: string | null
  color: string | null
  size: string | null
  quantity: number
  sellingPrice: number
  total: number
  status: "DRAFT" | "UNPAID" | "PARTIAL" | "PAID"
  createdAt: string
}

export type ActivityLog = {
  id: string
  action: string
  detail: string | null
  createdAt: string
}

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock"

export const LOW_STOCK_THRESHOLD = 5

export function getStockStatus(stock: number, threshold = LOW_STOCK_THRESHOLD): StockStatus {
  if (stock <= 0) return "out_of_stock"
  if (stock <= threshold) return "low_stock"
  return "in_stock"
}

export type DashboardStats = {
  totalProducts: number
  totalStock: number
  lowStockCount: number
  outOfStockCount: number
  totalRevenue: number
  productsSoldToday: number
  monthlyRevenue: number
  averageSale: number
  invoicesCount: number
  unpaidAmount: number
  receivables: number
  payables: number
  recentInvoices: Invoice[]
  monthlySales: MonthlySalesPoint[]
  stockDistribution: StockDistributionPoint[]
  recentActivity: ActivityLog[]
  recentAdvances: (Advance & { partyName?: string })[]
}

export type MonthlySalesPoint = {
  month: string
  revenue: number
  orders: number
}

export type StockDistributionPoint = {
  name: string
  value: number
  color: string
}

export type ProductFilters = {
  search?: string
  color?: string
  size?: string
  category?: string
  status?: StockStatus | "all"
  page?: number
  pageSize?: number
}

export type SaleFilters = {
  search?: string
  startDate?: string
  endDate?: string
}

/* ── Invoices / bills ─────────────────────────────────────────── */

export type InvoiceItem = {
  id: string
  invoiceId: string
  productId: string | null
  productName: string
  sku: string | null
  color: string | null
  size: string | null
  description: string | null
  quantity: number
  price: number
  total: number
}

export type Invoice = {
  id: string
  invoiceNumber: string
  partyId: string | null
  customerName: string | null
  customerPhone: string | null
  customerAddress: string | null
  date: string
  status: "DRAFT" | "UNPAID" | "PARTIAL" | "PAID"
  subtotal: number
  deliveryCharge: number
  discount: number
  total: number
  amountPaid: number
  notes: string | null
  shopDetails: { name: string; address: string; phones: string[]; email: string } | null
  templateSettings: Record<string, unknown> | null
  createdAt: string
  items: InvoiceItem[]
}

/* ── Parties (khata) & advances ───────────────────────────────── */

export type Party = {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  type: "CUSTOMER" | "SUPPLIER" | "WORKER" | "OTHER"
  notes: string | null
  createdAt: string
}

export type PartyBalance = Party & {
  balance: number
  given: number
  taken: number
}

export type Advance = {
  id: string
  partyId: string
  direction: "GIVEN" | "TAKEN"
  amount: number
  date: string
  note: string | null
  status: "OPEN" | "SETTLED"
  createdAt: string
}

export type LedgerLine = {
  id: string
  date: string
  kind: "ADVANCE_GIVEN" | "ADVANCE_TAKEN" | "INVOICE" | "PAYMENT_IN" | "PAYMENT_OUT"
  description: string
  debit: number
  credit: number
  balance: number
  referenceId?: string
}

export type Payment = {
  id: string
  partyId: string | null
  invoiceId: string | null
  direction: "IN" | "OUT"
  amount: number
  method: string | null
  date: string
  note: string | null
  createdAt: string
}

/* ── Job letters ──────────────────────────────────────────────── */

export type JobLetter = {
  id: string
  title: string
  employeeName: string | null
  position: string | null
  monthlySalary: number
  data: Record<string, unknown>
  createdAt: string
}

/* ── Reports ──────────────────────────────────────────────────── */

export type ReportType =
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "stock"
  | "low_stock"
  | "sold"

export type ReportRow = {
  productId: string | null
  productName: string
  sku: string | null
  color: string | null
  size: string | null
  stock: number
  soldQuantity: number
  revenue: number
  profit: number
}

export type ReportData = {
  type: ReportType
  title: string
  generatedAt: string
  periodLabel: string
  rows: ReportRow[]
  totals: {
    stock: number
    soldQuantity: number
    revenue: number
    profit: number
  }
}
