import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import * as schema from "../db/schema.js";
import { monthLabel, startOfDay, startOfMonth } from "../utils/format.js";
import { materialWeightGm } from "./reports.js";
/**
 * Chip preset → inclusive `yyyy-mm-dd` bounds in the LOCAL day (week starts
 * Monday, month starts on the 1st). One definition so web, desktop and mobile
 * show identical numbers for the same chip.
 */
export function dashboardPresetRange(preset, now = new Date()) {
    const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    if (preset === "today") {
        return { from: ymd(start), to: ymd(start) };
    }
    if (preset === "week") {
        // Monday-start calendar week (getDay: 0=Sun … 6=Sat).
        const back = (start.getDay() + 6) % 7;
        start.setDate(start.getDate() - back);
        return { from: ymd(start), to: ymd(now) };
    }
    // month
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: ymd(first), to: ymd(now) };
}
export async function getDashboard(db, period) {
    const now = new Date();
    const todayStart = startOfDay(now);
    const monthStart = startOfMonth(now);
    // Period bounds for the KPI tiles — normalize date-only input to the full day.
    const periodFrom = period?.from ? startOfDay(new Date(period.from)) : null;
    const periodTo = period?.to ? (() => { const d = new Date(period.to); d.setHours(23, 59, 59, 999); return d; })() : null;
    const periodConds = [];
    if (periodFrom)
        periodConds.push(gte(schema.invoices.createdAt, periodFrom));
    if (periodTo)
        periodConds.push(lte(schema.invoices.createdAt, periodTo));
    const periodWhere = periodConds.length ? and(...periodConds) : undefined;
    const monthRanges = Array.from({ length: 6 }, (_, i) => {
        const start = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
        const end = new Date(now.getFullYear(), now.getMonth() - 4 + i, 1);
        return { label: monthLabel(start), start, end };
    });
    const [productStats, lowStock, outOfStock, salesStats, todayStats, monthStats, recentInvoices, monthAggs, recentActivity, unpaidStats, recentAdvances, parties, topProductsRows, categoryRows, statusRows, advanceRows, soldPerMonthAggs, productSkuRows,] = await Promise.all([
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
        // Top products by revenue (aggregated over the invoice-items snapshot, so
        // deleted products still show under their last-known name).
        db
            .select({
            productId: schema.invoiceItems.productId,
            productName: schema.invoiceItems.productName,
            quantitySold: sql `coalesce(sum(${schema.invoiceItems.quantity}),0)::float8`.as("quantity_sold"),
            revenue: sql `coalesce(sum(${schema.invoiceItems.total}),0)::float8`.as("revenue"),
        })
            .from(schema.invoiceItems)
            .groupBy(schema.invoiceItems.productId, schema.invoiceItems.productName)
            .orderBy(desc(sql `coalesce(sum(${schema.invoiceItems.total}),0)`))
            .limit(6),
        // Revenue per category. LEFT JOIN through the product so uncategorized or
        // deleted products land in "Uncategorized". The category name is aliased
        // (as) to avoid the Neon duplicate-column collapse.
        db
            .select({
            categoryName: sql `${schema.categories.name}`.as("category_name"),
            revenue: sql `coalesce(sum(${schema.invoiceItems.total}),0)::float8`,
        })
            .from(schema.invoiceItems)
            .leftJoin(schema.products, eq(schema.products.id, schema.invoiceItems.productId))
            .leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
            .groupBy(sql `${schema.categories.name}`)
            .orderBy(desc(sql `coalesce(sum(${schema.invoiceItems.total}),0)`)),
        // Invoice counts by status.
        db
            .select({ status: schema.invoices.status, count: sql `count(*)::int` })
            .from(schema.invoices)
            .groupBy(schema.invoices.status),
        // Open advances split by direction.
        db
            .select({
            direction: schema.advances.direction,
            total: sql `coalesce(sum(${schema.advances.amount}),0)::float8`,
        })
            .from(schema.advances)
            .where(eq(schema.advances.status, "OPEN"))
            .groupBy(schema.advances.direction),
        // Units sold per month (last 6 months) — via the invoice date.
        Promise.all(monthRanges.map((r) => db
            .select({ quantity: sql `coalesce(sum(${schema.invoiceItems.quantity}),0)::float8` })
            .from(schema.invoiceItems)
            .innerJoin(schema.invoices, eq(schema.invoices.id, schema.invoiceItems.invoiceId))
            .where(and(gte(schema.invoices.date, r.start), lte(schema.invoices.date, r.end))))),
        db.select({ id: schema.products.id, sku: schema.products.sku }).from(schema.products),
    ]);
    // ── Period KPIs (dashboard chips: Today / This week / This month / Custom)
    // Weight sold prefers the LINE's frozen pricing.weightGm (per unit × qty),
    // falling back to the line's weight snapshot — never the CURRENT product
    // weight, which may have changed since the sale.
    const [periodSales, periodWeight, materialRows] = await Promise.all([
        db
            .select({
            revenue: sql `coalesce(sum(${schema.invoices.total}),0)::float8`,
            count: sql `count(*)::int`,
        })
            .from(schema.invoices)
            .where(periodWhere),
        db
            .select({
            weightGm: sql `coalesce(sum(coalesce(
          (${schema.invoiceItems.pricing} ->> 'weightGm')::float8,
          case when ${schema.invoiceItems.weightUnit} = 'mg' then ${schema.invoiceItems.weight} / 1000.0
               else ${schema.invoiceItems.weight} end
        ) * ${schema.invoiceItems.quantity}), 0)::float8`,
        })
            .from(schema.invoiceItems)
            .innerJoin(schema.invoices, eq(schema.invoices.id, schema.invoiceItems.invoiceId))
            .where(periodWhere),
        db
            .select({
            weight: schema.invoices.materialReturnedWeight,
            value: schema.invoices.materialReturnedValue,
        })
            .from(schema.invoices)
            .where(and(...periodConds, sql `(${schema.invoices.materialReturnedValue} > 0 or ${schema.invoices.materialReturnedWeight} is not null)`)),
    ]);
    const periodKpis = {
        from: periodFrom ? periodFrom.toISOString() : null,
        to: periodTo ? periodTo.toISOString() : null,
        revenue: periodSales[0]?.revenue ?? 0,
        invoicesCount: periodSales[0]?.count ?? 0,
        weightSoldGm: periodWeight[0]?.weightGm ?? 0,
        materialReceivedGm: Math.round(materialRows.reduce((s, r) => s + materialWeightGm(r.weight), 0) * 100) / 100,
        materialReceivedValue: Math.round(materialRows.reduce((s, r) => s + (r.value || 0), 0) * 100) / 100,
    };
    const totalInvoices = salesStats[0]?.count ?? 0;
    const totalRevenue = salesStats[0]?.total ?? 0;
    const productsSoldToday = todayStats[0]?.qty ?? 0;
    const monthlyRevenue = monthStats[0]?.total ?? 0;
    // Ledger split (real receivables vs payables):
    //  - receivables = unpaid invoice balance (customers owe us) + open advances
    //    we GAVE (parties owe us that money back)
    //  - payables    = open advances we TOOK (we owe the parties)
    const unpaidInvoices = unpaidStats[0]?.total ?? 0;
    const givenAdvances = advanceRows.find((r) => r.direction === "GIVEN")?.total ?? 0;
    const takenAdvances = advanceRows.find((r) => r.direction === "TAKEN")?.total ?? 0;
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
        color: categoryPalette[i % categoryPalette.length],
    }));
    if (sortedCats.length > 5) {
        const rest = sortedCats.slice(5).reduce((s, c) => s + c.value, 0);
        if (rest > 0)
            salesByCategory.push({ name: "Other", value: rest, color: "var(--chart-3)" });
    }
    // Invoice counts by status (largest first).
    const STATUS_META = {
        PAID: { name: "Paid", color: "var(--chart-2)" },
        PARTIAL: { name: "Partial", color: "var(--chart-4)" },
        UNPAID: { name: "Unpaid", color: "var(--chart-5)" },
        DRAFT: { name: "Draft", color: "var(--chart-3)" },
    };
    const invoiceStatus = statusRows
        .map((r) => (STATUS_META[r.status] ? { name: STATUS_META[r.status].name, value: r.count, color: STATUS_META[r.status].color } : null))
        .filter((x) => x !== null)
        .sort((a, b) => b.value - a.value);
    // Open advances split.
    const given = givenAdvances;
    const taken = takenAdvances;
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
        unpaidAmount: unpaidInvoices,
        receivables: unpaidInvoices + givenAdvances,
        payables: takenAdvances,
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
        period: periodKpis,
        recentActivity,
        recentAdvances: recentAdvancesWithNames,
    };
}
//# sourceMappingURL=dashboard.js.map