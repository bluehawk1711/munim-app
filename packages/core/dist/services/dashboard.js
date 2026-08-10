import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import * as schema from "../db/schema";
import { monthLabel } from "../utils/format";
function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}
function startOfMonth(d) {
    const x = new Date(d);
    x.setDate(1);
    x.setHours(0, 0, 0, 0);
    return x;
}
export async function getDashboard(db) {
    const now = new Date();
    const todayStart = startOfDay(now);
    const monthStart = startOfMonth(now);
    const monthRanges = Array.from({ length: 6 }, (_, i) => {
        const start = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
        const end = new Date(now.getFullYear(), now.getMonth() - 4 + i, 1);
        return { label: monthLabel(start), start, end };
    });
    const [productStats, lowStock, outOfStock, salesStats, todayStats, monthStats, recentInvoices, monthAggs, recentActivity, unpaidStats, recentAdvances, parties,] = await Promise.all([
        db
            .select({ count: sql `count(*)::int`, stock: sql `coalesce(sum(stock),0)::float8` })
            .from(schema.products),
        db
            .select({ count: sql `count(*)::int` })
            .from(schema.products)
            .where(sql `stock > 0 and stock <= low_stock_threshold`),
        db.select({ count: sql `count(*)::int` }).from(schema.products).where(sql `stock <= 0`),
        db
            .select({
            count: sql `count(*)::int`,
            total: sql `coalesce(sum(total),0)::float8`,
        })
            .from(schema.invoices),
        db
            .select({ qty: sql `coalesce(sum(total),0)::float8`, count: sql `count(*)::int` })
            .from(schema.invoices)
            .where(gte(schema.invoices.createdAt, todayStart)),
        db
            .select({ total: sql `coalesce(sum(total),0)::float8` })
            .from(schema.invoices)
            .where(gte(schema.invoices.createdAt, monthStart)),
        db.select().from(schema.invoices).orderBy(desc(schema.invoices.createdAt)).limit(6),
        Promise.all(monthRanges.map((r) => db
            .select({ revenue: sql `coalesce(sum(total),0)::float8`, count: sql `count(*)::int` })
            .from(schema.invoices)
            .where(and(gte(schema.invoices.createdAt, r.start), lte(schema.invoices.createdAt, r.end))))),
        db.select().from(schema.activityLogs).orderBy(desc(schema.activityLogs.createdAt)).limit(8),
        db
            .select({ total: sql `coalesce(sum(total - amount_paid),0)::float8` })
            .from(schema.invoices)
            .where(sql `status != 'PAID'`),
        db.select().from(schema.advances).where(eq(schema.advances.status, "OPEN")).orderBy(desc(schema.advances.date)).limit(5),
        db.select().from(schema.parties),
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
        recentActivity,
        recentAdvances: recentAdvancesWithNames,
    };
}
export async function getReport(db, type, startDate, endDate) {
    const now = new Date();
    let periodStart;
    let periodEnd = now;
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
        soldQuantity: sql `coalesce(sum(${schema.invoiceItems.quantity}),0)::float8`,
        revenue: sql `coalesce(sum(${schema.invoiceItems.total}),0)::float8`,
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
        purchasePrice: schema.products.purchasePrice,
        lowStockThreshold: schema.products.lowStockThreshold,
        colorName: schema.colors.name,
        sizeName: schema.sizes.name,
    })
        .from(schema.products)
        .leftJoin(schema.colors, eq(schema.colors.id, schema.products.colorId))
        .leftJoin(schema.sizes, eq(schema.sizes.id, schema.products.sizeId));
    const productById = new Map(allProducts.map((p) => [p.id, p]));
    let reportRows = [];
    if (type === "stock" || type === "low_stock") {
        reportRows = allProducts
            .filter((p) => {
            if (type !== "low_stock")
                return true;
            return p.stock <= p.lowStockThreshold;
        })
            .map((p) => {
            const sold = rows.find((r) => r.productId === p.id);
            return {
                productId: p.id,
                productName: p.name,
                sku: p.sku,
                color: p.colorName,
                size: p.sizeName,
                stock: p.stock,
                soldQuantity: sold?.soldQuantity ?? 0,
                revenue: sold?.revenue ?? 0,
                profit: (sold?.revenue ?? 0) - (sold?.soldQuantity ?? 0) * p.purchasePrice,
            };
        });
        title = type === "stock" ? "Product Stock Report" : "Low Stock Report";
        periodLabel = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    }
    else {
        reportRows = rows
            .filter((r) => r.productId)
            .map((r) => {
            const p = r.productId ? productById.get(r.productId) : undefined;
            return {
                productId: r.productId,
                productName: r.productName,
                sku: p?.sku ?? null,
                color: p?.colorName ?? null,
                size: p?.sizeName ?? null,
                stock: p?.stock ?? 0,
                soldQuantity: r.soldQuantity,
                revenue: r.revenue,
                profit: r.revenue - r.soldQuantity * (p?.purchasePrice ?? 0),
            };
        });
    }
    reportRows.sort((a, b) => b.revenue - a.revenue);
    const totals = reportRows.reduce((acc, r) => {
        acc.stock += r.stock;
        acc.soldQuantity += r.soldQuantity;
        acc.revenue += r.revenue;
        acc.profit += r.profit;
        return acc;
    }, { stock: 0, soldQuantity: 0, revenue: 0, profit: 0 });
    return {
        type,
        title,
        generatedAt: now.toISOString(),
        periodLabel,
        rows: reportRows,
        totals,
    };
}
//# sourceMappingURL=dashboard.js.map