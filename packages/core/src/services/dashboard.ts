import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { DbClient } from "../db/client";
import * as schema from "../db/schema";
import { monthLabel } from "../utils/format";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d: Date): Date {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

export type DashboardStats = {
  totalProducts: number;
  totalStock: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalRevenue: number;
  productsSoldToday: number;
  monthlyRevenue: number;
  averageSale: number;
  invoicesCount: number;
  unpaidAmount: number;
  receivables: number;
  payables: number;
  recentInvoices: (schema.Invoice & { items?: schema.InvoiceItem[] })[];
  monthlySales: { month: string; revenue: number; orders: number }[];
  stockDistribution: { name: string; value: number; color: string }[];
  /** Top-selling products by revenue (all-time). */
  topProducts: { productName: string; sku: string | null; quantitySold: number; revenue: number }[];
  /** Revenue share per product category (top 5 + "Other"). */
  salesByCategory: { name: string; value: number; color: string }[];
  /** Invoice counts by status (Paid / Partial / Unpaid / Draft). */
  invoiceStatus: { name: string; value: number; color: string }[];
  /** Open advances split by direction (Given by us vs Taken by us). */
  advanceSplit: { name: string; value: number; color: string }[];
  /** Units sold per month (last 6 months). */
  soldPerMonth: { month: string; quantity: number }[];
  recentActivity: schema.ActivityLog[];
  recentAdvances: (schema.Advance & { partyName?: string })[];
};

export async function getDashboard(db: DbClient): Promise<DashboardStats> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const monthStart = startOfMonth(now);

  const monthRanges = Array.from({ length: 6 }, (_, i) => {
    const start = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - 4 + i, 1);
    return { label: monthLabel(start), start, end };
  });

  const [
    productStats,
    lowStock,
    outOfStock,
    salesStats,
    todayStats,
    monthStats,
    recentInvoices,
    monthAggs,
    recentActivity,
    unpaidStats,
    recentAdvances,
    parties,
    topProductsRows,
    categoryRows,
    statusRows,
    advanceRows,
    soldPerMonthAggs,
    productSkuRows,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int`, stock: sql<number>`coalesce(sum(stock),0)::float8` })
      .from(schema.products),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.products)
      .where(sql`stock > 0 and stock <= low_stock_threshold`),
    db.select({ count: sql<number>`count(*)::int` }).from(schema.products).where(sql`stock <= 0`),
    db
      .select({
        count: sql<number>`count(*)::int`,
        total: sql<number>`coalesce(sum(total),0)::float8`,
      })
      .from(schema.invoices),
    db
      .select({ qty: sql<number>`coalesce(sum(total),0)::float8`, count: sql<number>`count(*)::int` })
      .from(schema.invoices)
      .where(gte(schema.invoices.createdAt, todayStart)),
    db
      .select({ total: sql<number>`coalesce(sum(total),0)::float8` })
      .from(schema.invoices)
      .where(gte(schema.invoices.createdAt, monthStart)),
    db.select().from(schema.invoices).orderBy(desc(schema.invoices.createdAt)).limit(6),
    Promise.all(
      monthRanges.map((r) =>
        db
          .select({ revenue: sql<number>`coalesce(sum(total),0)::float8`, count: sql<number>`count(*)::int` })
          .from(schema.invoices)
          .where(and(gte(schema.invoices.createdAt, r.start), lte(schema.invoices.createdAt, r.end))),
      ),
    ),
    db.select().from(schema.activityLogs).orderBy(desc(schema.activityLogs.createdAt)).limit(8),
    db
      .select({ total: sql<number>`coalesce(sum(total - amount_paid),0)::float8` })
      .from(schema.invoices)
      .where(sql`status != 'PAID'`),
    db.select().from(schema.advances).where(eq(schema.advances.status, "OPEN")).orderBy(desc(schema.advances.date)).limit(5),
    db.select().from(schema.parties),
    // Top products by revenue (aggregated over the invoice-items snapshot, so
    // deleted products still show under their last-known name).
    db
      .select({
        productId: schema.invoiceItems.productId,
        productName: schema.invoiceItems.productName,
        quantitySold: sql<number>`coalesce(sum(${schema.invoiceItems.quantity}),0)::float8`,
        revenue: sql<number>`coalesce(sum(${schema.invoiceItems.total}),0)::float8`,
      })
      .from(schema.invoiceItems)
      .groupBy(schema.invoiceItems.productId, schema.invoiceItems.productName)
      .orderBy(desc(sql`coalesce(sum(${schema.invoiceItems.total}),0)`))
      .limit(6),
    // Revenue per category. LEFT JOIN through the product so uncategorized or
    // deleted products land in "Uncategorized". The category name is aliased
    // (as) to avoid the Neon duplicate-column collapse.
    db
      .select({
        categoryName: sql<string | null>`${schema.categories.name}`.as("category_name"),
        revenue: sql<number>`coalesce(sum(${schema.invoiceItems.total}),0)::float8`,
      })
      .from(schema.invoiceItems)
      .leftJoin(schema.products, eq(schema.products.id, schema.invoiceItems.productId))
      .leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
      .groupBy(sql`${schema.categories.name}`)
      .orderBy(desc(sql`coalesce(sum(${schema.invoiceItems.total}),0)`)),
    // Invoice counts by status.
    db
      .select({ status: schema.invoices.status, count: sql<number>`count(*)::int` })
      .from(schema.invoices)
      .groupBy(schema.invoices.status),
    // Open advances split by direction.
    db
      .select({
        direction: schema.advances.direction,
        total: sql<number>`coalesce(sum(${schema.advances.amount}),0)::float8`,
      })
      .from(schema.advances)
      .where(eq(schema.advances.status, "OPEN"))
      .groupBy(schema.advances.direction),
    // Units sold per month (last 6 months) — via the invoice date.
    Promise.all(
      monthRanges.map((r) =>
        db
          .select({ quantity: sql<number>`coalesce(sum(${schema.invoiceItems.quantity}),0)::float8` })
          .from(schema.invoiceItems)
          .innerJoin(schema.invoices, eq(schema.invoices.id, schema.invoiceItems.invoiceId))
          .where(and(gte(schema.invoices.date, r.start), lte(schema.invoices.date, r.end))),
      ),
    ),
    db.select({ id: schema.products.id, sku: schema.products.sku }).from(schema.products),
  ]);

  const totalInvoices = salesStats[0]?.count ?? 0;
  const totalRevenue = salesStats[0]?.total ?? 0;
  const productsSoldToday = todayStats[0]?.qty ?? 0;
  const monthlyRevenue = monthStats[0]?.total ?? 0;

  // Advances enriched with party name
  const partyNameMap = new Map(parties.map((p) => [p.id, p.name]));
  const recentAdvancesWithNames = recentAdvances.map((a) => ({
    ...a,
    partyName: partyNameMap.get(a.partyId),
  }));

  // Top products — attach the live SKU where the product still exists.
  const skuById = new Map(productSkuRows.map((p) => [p.id, p.sku]));
  const topProducts = topProductsRows.map((r) => ({
    productName: r.productName,
    sku: r.productId ? (skuById.get(r.productId) ?? null) : null,
    quantitySold: r.quantitySold,
    revenue: r.revenue,
  }));

  // Sales by category — top 5 buckets, remainder folded into "Other".
  const categoryPalette = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
  ];
  const sortedCats = categoryRows
    .map((r) => ({ name: r.categoryName ?? "Uncategorized", value: r.revenue }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);
  const salesByCategory = sortedCats.slice(0, 5).map((c, i) => ({
    ...c,
    color: categoryPalette[i % categoryPalette.length]!,
  }));
  if (sortedCats.length > 5) {
    const rest = sortedCats.slice(5).reduce((s, c) => s + c.value, 0);
    if (rest > 0) salesByCategory.push({ name: "Other", value: rest, color: "var(--chart-3)" });
  }

  // Invoice counts by status (largest first).
  const STATUS_META: Record<string, { name: string; color: string }> = {
    PAID: { name: "Paid", color: "var(--chart-2)" },
    PARTIAL: { name: "Partial", color: "var(--chart-4)" },
    UNPAID: { name: "Unpaid", color: "var(--chart-5)" },
    DRAFT: { name: "Draft", color: "var(--chart-3)" },
  };
  const invoiceStatus = statusRows
    .map((r) => (STATUS_META[r.status] ? { name: STATUS_META[r.status]!.name, value: r.count, color: STATUS_META[r.status]!.color } : null))
    .filter((x): x is { name: string; value: number; color: string } => x !== null)
    .sort((a, b) => b.value - a.value);

  // Open advances split.
  const given = advanceRows.find((r) => r.direction === "GIVEN")?.total ?? 0;
  const taken = advanceRows.find((r) => r.direction === "TAKEN")?.total ?? 0;
  const advanceSplit = [
    ...(given > 0 ? [{ name: "Given by us", value: given, color: "var(--chart-4)" }] : []),
    ...(taken > 0 ? [{ name: "Taken by us", value: taken, color: "var(--chart-2)" }] : []),
  ];

  return {
    totalProducts: productStats[0]?.count ?? 0,
    totalStock: productStats[0]?.stock ?? 0,
    lowStockCount: lowStock[0]?.count ?? 0,
    outOfStockCount: outOfStock[0]?.count ?? 0,
    totalRevenue,
    productsSoldToday,
    monthlyRevenue,
    averageSale: totalInvoices > 0 ? totalRevenue / totalInvoices : 0,
    invoicesCount: totalInvoices,
    unpaidAmount: unpaidStats[0]?.total ?? 0,
    receivables: unpaidStats[0]?.total ?? 0,
    payables: unpaidStats[0]?.total ?? 0,
    recentInvoices,
    monthlySales: monthRanges.map((r, i) => ({
      month: r.label,
      revenue: monthAggs[i]?.[0]?.revenue ?? 0,
      orders: monthAggs[i]?.[0]?.count ?? 0,
    })),
    stockDistribution: [
      { name: "In Stock", value: Math.max(0, (productStats[0]?.count ?? 0) - (lowStock[0]?.count ?? 0) - (outOfStock[0]?.count ?? 0)), color: "var(--chart-2)" },
      { name: "Low Stock", value: lowStock[0]?.count ?? 0, color: "var(--chart-4)" },
      { name: "Out of Stock", value: outOfStock[0]?.count ?? 0, color: "var(--chart-5)" },
    ],
    topProducts,
    salesByCategory,
    invoiceStatus,
    advanceSplit,
    soldPerMonth: monthRanges.map((r, i) => ({
      month: r.label,
      quantity: soldPerMonthAggs[i]?.[0]?.quantity ?? 0,
    })),
    recentActivity,
    recentAdvances: recentAdvancesWithNames,
  };
}

/* ── Reports ──────────────────────────────────────────────────── */

export type ReportType = "daily" | "weekly" | "monthly" | "yearly" | "stock" | "low_stock" | "sold";

export type ReportRow = {
  productId: string | null;
  productName: string;
  sku: string | null;
  color: string | null;
  size: string | null;
  stock: number;
  soldQuantity: number;
  /** Unit weight in mg (null when the product has no weight set). */
  weight: number | null;
  /** Total weight sold in mg (quantity × unit weight). */
  soldWeight: number;
  revenue: number;
  profit: number;
};

export async function getReport(db: DbClient, type: ReportType, startDate?: string, endDate?: string) {
  const now = new Date();
  let periodStart: Date;
  let periodEnd: Date = now;
  let title = "";
  let periodLabel = "";

  switch (type) {
    case "daily": {
      periodStart = startOfDay(now);
      title = "Daily Sales Report";
      periodLabel = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      break;
    }
    case "weekly": {
      periodStart = startOfDay(new Date(now.getTime() - 6 * 86400000));
      title = "Weekly Sales Report";
      periodLabel = `${periodStart.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} – ${now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`;
      break;
    }
    case "monthly": {
      periodStart = startOfMonth(now);
      title = "Monthly Sales Report";
      periodLabel = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
      break;
    }
    case "yearly": {
      periodStart = new Date(now.getFullYear(), 0, 1);
      title = "Yearly Sales Report";
      periodLabel = String(now.getFullYear());
      break;
    }
    default:
      periodStart = startOfMonth(now);
  }

  if (startDate) {
    periodStart = new Date(startDate);
    periodStart.setHours(0, 0, 0, 0);
  }
  if (endDate) {
    periodEnd = new Date(endDate);
    periodEnd.setHours(23, 59, 59, 999);
  }

  // Aggregate invoice items in the period, grouped by product
  const rows = await db
    .select({
      productId: schema.invoiceItems.productId,
      productName: schema.invoiceItems.productName,
      soldQuantity: sql<number>`coalesce(sum(${schema.invoiceItems.quantity}),0)::float8`,
      revenue: sql<number>`coalesce(sum(${schema.invoiceItems.total}),0)::float8`,
    })
    .from(schema.invoiceItems)
    .innerJoin(schema.invoices, eq(schema.invoices.id, schema.invoiceItems.invoiceId))
    .where(and(gte(schema.invoices.date, periodStart), lte(schema.invoices.date, periodEnd)))
    .groupBy(schema.invoiceItems.productId, schema.invoiceItems.productName);

  // Stock + purchase price for profit calc
  const allProducts = await db
    .select({
      id: schema.products.id,
      sku: schema.products.sku,
      name: schema.products.name,
      stock: schema.products.stock,
      weight: schema.products.weight,
      purchasePrice: schema.products.purchasePrice,
      lowStockThreshold: schema.products.lowStockThreshold,
      colorName: sql<string | null>`${schema.colors.name}`.as("color_name"),
      sizeName: sql<string | null>`${schema.sizes.name}`.as("size_name"),
    })
    .from(schema.products)
    .leftJoin(schema.colors, eq(schema.colors.id, schema.products.colorId))
    .leftJoin(schema.sizes, eq(schema.sizes.id, schema.products.sizeId));

  const productById = new Map(allProducts.map((p) => [p.id, p]));

  let reportRows: ReportRow[] = [];
  if (type === "stock" || type === "low_stock") {
    reportRows = allProducts
      .filter((p) => {
        if (type !== "low_stock") return true;
        return p.stock <= p.lowStockThreshold;
      })
      .map((p) => {
        const sold = rows.find((r) => r.productId === p.id);
        const soldQuantity = sold?.soldQuantity ?? 0;
        return {
          productId: p.id,
          productName: p.name,
          sku: p.sku,
          color: p.colorName,
          size: p.sizeName,
          stock: p.stock,
          weight: p.weight,
          soldWeight: p.weight != null ? soldQuantity * p.weight : 0,
          soldQuantity,
          revenue: sold?.revenue ?? 0,
          profit: (sold?.revenue ?? 0) - soldQuantity * p.purchasePrice,
        };
      });
    title = type === "stock" ? "Product Stock Report" : "Low Stock Report";
    periodLabel = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } else {
    // The SQL groups by (productId, productName), so a product that was
    // renamed mid-period produces one row per name snapshot (old invoices keep
    // the old snapshot). Merge by productId so the report shows ONE row per
    // product with its CURRENT name — this also keeps row keys unique across
    // web, desktop & mobile (a shared SKU previously caused duplicate-key
    // console errors in the reports tables).
    const merged = new Map<string, ReportRow>();
    for (const r of rows) {
      if (!r.productId) continue;
      const p = productById.get(r.productId);
      const soldWeight = p?.weight != null ? r.soldQuantity * p.weight : 0;
      const existing = merged.get(r.productId);
      const soldQuantity = (existing?.soldQuantity ?? 0) + r.soldQuantity;
      const revenue = (existing?.revenue ?? 0) + r.revenue;
      merged.set(r.productId, {
        productId: r.productId,
        // Current product name wins; fall back to the first snapshot seen for
        // products that were deleted after being sold.
        productName: existing?.productName ?? p?.name ?? r.productName,
        sku: p?.sku ?? null,
        color: p?.colorName ?? null,
        size: p?.sizeName ?? null,
        stock: p?.stock ?? 0,
        weight: p?.weight ?? null,
        soldWeight: (existing?.soldWeight ?? 0) + soldWeight,
        soldQuantity,
        revenue,
        profit: revenue - soldQuantity * (p?.purchasePrice ?? 0),
      });
    }
    reportRows = [...merged.values()];
  }

  reportRows.sort((a, b) => b.revenue - a.revenue);

  const totals = reportRows.reduce(
    (acc, r) => {
      acc.stock += r.stock;
      acc.soldQuantity += r.soldQuantity;
      acc.soldWeight += r.soldWeight;
      acc.revenue += r.revenue;
      acc.profit += r.profit;
      return acc;
    },
    { stock: 0, soldQuantity: 0, soldWeight: 0, revenue: 0, profit: 0 },
  );

  return {
    type,
    title,
    generatedAt: now.toISOString(),
    periodLabel,
    rows: reportRows,
    totals,
  };
}

/**
 * Serializes a report into RFC-4180 CSV (quoted, escaped, CRLF line endings).
 * Shared by web, desktop AND mobile so every platform exports the same file.
 */
export function reportToCsv(report: {
  title: string;
  rows: ReportRow[];
  totals: { stock: number; soldQuantity: number; soldWeight: number; revenue: number; profit: number };
}): string {
  const header = ["Product", "SKU", "Color", "Size", "Stock", "Sold Qty", "Sold Wt (g)", "Revenue", "Profit"];
  const g = (mg: number) => Math.round((mg / 1000) * 1000) / 1000;
  const lines = [
    header.join(","),
    ...report.rows.map((r) =>
      [r.productName, r.sku ?? "", r.color ?? "", r.size ?? "", r.stock, r.soldQuantity, g(r.soldWeight), r.revenue, r.profit]
        .map((v) => {
          const s = String(v);
          return `"${s.replace(/"/g, '""')}"`;
        })
        .join(","),
    ),
  ];
  return lines.join("\r\n");
}
