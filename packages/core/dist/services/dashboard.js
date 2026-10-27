import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import * as schema from "../db/schema.js";
import { monthLabel } from "../utils/format.js";
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
/** Free-text material-returned weight ("5gm", "500mg", "5.2") → GRAMS.
 *  `parseNetWeight` strips the unit, so the unit is read from the TEXT itself
 *  ("…mg" → milligrams, anything else → grams). Unparseable → 0. */
export function materialWeightGm(text) {
    if (!text)
        return 0;
    const cleaned = text.replace(/[^0-9.]/g, "");
    if (cleaned === "")
        return 0;
    const value = Number(cleaned);
    if (!Number.isFinite(value))
        return 0;
    const grams = /mg/i.test(text) ? value / 1000 : value;
    return Math.round(grams * 10000) / 10000;
}
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
        soldQuantity: sql `coalesce(sum(${schema.invoiceItems.quantity}),0)::float8`.as("sold_quantity"),
        weightGm: sql `coalesce(sum(coalesce(
        (${schema.invoiceItems.pricing} ->> 'weightGm')::float8,
        case when ${schema.invoiceItems.weightUnit} = 'mg' then ${schema.invoiceItems.weight} / 1000.0
             else ${schema.invoiceItems.weight} end
      ) * ${schema.invoiceItems.quantity}), 0)::float8`.as("weight_gm"),
        revenue: sql `coalesce(sum(${schema.invoiceItems.total}),0)::float8`.as("revenue"),
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
        weightUnit: schema.products.weightUnit,
        purchasePrice: schema.products.purchasePrice,
        lowStockThreshold: schema.products.lowStockThreshold,
        colorName: sql `${schema.colors.name}`.as("color_name"),
        sizeName: sql `${schema.sizes.name}`.as("size_name"),
    })
        .from(schema.products)
        .leftJoin(schema.colors, eq(schema.colors.id, schema.products.colorId))
        .leftJoin(schema.sizes, eq(schema.sizes.id, schema.products.sizeId));
    const productById = new Map(allProducts.map((p) => [p.id, p]));
    // ── Day-wise aggregation (Daily Sales only) ────────────────────────────
    // One section per DATE with the products sold that day — the shop asked to
    // see, day by day, what is actually selling. Rows merge by productId (same
    // rename-safe rule as the flat report above); stock/weight/profit come from
    // the CURRENT product like everywhere else.
    const dayGroups = [];
    if (type === "daily") {
        const dayRows = await db
            .select({
            day: sql `to_char(${schema.invoices.date}, 'YYYY-MM-DD')`.as("day"),
            productId: schema.invoiceItems.productId,
            productName: schema.invoiceItems.productName,
            invoices: sql `count(distinct ${schema.invoices.id})::float8`.as("invoices"),
            soldQuantity: sql `coalesce(sum(${schema.invoiceItems.quantity}),0)::float8`.as("sold_quantity"),
            weightGm: sql `coalesce(sum(coalesce(
          (${schema.invoiceItems.pricing} ->> 'weightGm')::float8,
          case when ${schema.invoiceItems.weightUnit} = 'mg' then ${schema.invoiceItems.weight} / 1000.0
               else ${schema.invoiceItems.weight} end
        ) * ${schema.invoiceItems.quantity}), 0)::float8`.as("weight_gm"),
            revenue: sql `coalesce(sum(${schema.invoiceItems.total}),0)::float8`.as("revenue"),
        })
            .from(schema.invoiceItems)
            .innerJoin(schema.invoices, eq(schema.invoices.id, schema.invoiceItems.invoiceId))
            .where(and(gte(schema.invoices.date, periodStart), lte(schema.invoices.date, periodEnd)))
            .groupBy(sql `to_char(${schema.invoices.date}, 'YYYY-MM-DD')`, schema.invoiceItems.productId, schema.invoiceItems.productName)
            .orderBy(sql `to_char(${schema.invoices.date}, 'YYYY-MM-DD')`);
        const byDay = new Map();
        for (const r of dayRows) {
            const entry = byDay.get(r.day) ?? { rows: new Map(), invoices: 0 };
            byDay.set(r.day, entry);
            entry.invoices += r.invoices;
            const p = r.productId ? productById.get(r.productId) : undefined;
            const existing = r.productId ? entry.rows.get(r.productId) : undefined;
            // Deleted products (no current row) still count — key by the snapshot
            // name so they never collide.
            const key = r.productId ?? `name:${r.productName}`;
            const soldWeight = p?.weight != null ? r.soldQuantity * p.weight : 0;
            const soldQuantity = (existing?.soldQuantity ?? 0) + r.soldQuantity;
            const revenue = (existing?.revenue ?? 0) + r.revenue;
            entry.rows.set(key, {
                productId: r.productId,
                productName: existing?.productName ?? p?.name ?? r.productName,
                sku: p?.sku ?? null,
                color: p?.colorName ?? null,
                size: p?.sizeName ?? null,
                stock: p?.stock ?? 0,
                weight: p?.weight ?? null,
                weightUnit: p?.weightUnit ?? "gm",
                soldWeight: (existing?.soldWeight ?? 0) + soldWeight,
                soldWeightGm: (existing?.soldWeightGm ?? 0) + (r.weightGm ?? 0),
                soldQuantity,
                revenue,
                profit: revenue - soldQuantity * (p?.purchasePrice ?? 0),
            });
        }
        for (const [day, entry] of [...byDay.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
            const rows = [...entry.rows.values()].sort((a, b) => b.revenue - a.revenue);
            dayGroups.push({
                day,
                label: new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
                invoices: entry.invoices,
                daySoldQuantity: rows.reduce((s, r) => s + r.soldQuantity, 0),
                dayRevenue: rows.reduce((s, r) => s + r.revenue, 0),
                rows,
            });
        }
    }
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
            const soldQuantity = sold?.soldQuantity ?? 0;
            return {
                productId: p.id,
                productName: p.name,
                sku: p.sku,
                color: p.colorName,
                size: p.sizeName,
                stock: p.stock,
                weight: p.weight,
                weightUnit: p.weightUnit ?? "gm",
                soldWeight: p.weight != null ? soldQuantity * p.weight : 0,
                soldWeightGm: sold?.weightGm ?? 0,
                soldQuantity,
                revenue: sold?.revenue ?? 0,
                profit: (sold?.revenue ?? 0) - soldQuantity * p.purchasePrice,
            };
        });
        title = type === "stock" ? "Product Stock Report" : "Low Stock Report";
        periodLabel = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    }
    else {
        // The SQL groups by (productId, productName), so a product that was
        // renamed mid-period produces one row per name snapshot (old invoices keep
        // the old snapshot). Merge by productId so the report shows ONE row per
        // product with its CURRENT name — this also keeps row keys unique across
        // web, desktop & mobile (a shared SKU previously caused duplicate-key
        // console errors in the reports tables).
        const merged = new Map();
        for (const r of rows) {
            if (!r.productId)
                continue;
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
                weightUnit: p?.weightUnit ?? "gm",
                soldWeight: (existing?.soldWeight ?? 0) + soldWeight,
                soldWeightGm: (existing?.soldWeightGm ?? 0) + (r.weightGm ?? 0),
                soldQuantity,
                revenue,
                profit: revenue - soldQuantity * (p?.purchasePrice ?? 0),
            });
        }
        reportRows = [...merged.values()];
    }
    reportRows.sort((a, b) => b.revenue - a.revenue);
    // Material received in the same period (bill's "Material Returned" free
    // text + assessed value) — the other half of the weight story.
    const materialRows = await db
        .select({
        weight: schema.invoices.materialReturnedWeight,
        value: schema.invoices.materialReturnedValue,
    })
        .from(schema.invoices)
        .where(and(gte(schema.invoices.date, periodStart), lte(schema.invoices.date, periodEnd), sql `(${schema.invoices.materialReturnedValue} > 0 or ${schema.invoices.materialReturnedWeight} is not null)`));
    const totals = reportRows.reduce((acc, r) => {
        acc.stock += r.stock;
        acc.soldQuantity += r.soldQuantity;
        // Normalize to grams so mixed-unit totals are meaningful.
        acc.soldWeight += r.weightUnit === "mg" ? r.soldWeight / 1000 : r.soldWeight;
        acc.weightSoldGm += r.soldWeightGm;
        acc.revenue += r.revenue;
        acc.profit += r.profit;
        return acc;
    }, { stock: 0, soldQuantity: 0, soldWeight: 0, weightSoldGm: 0, revenue: 0, profit: 0, materialReceivedGm: 0, materialReceivedValue: 0 });
    totals.weightSoldGm = Math.round(totals.weightSoldGm * 100) / 100;
    totals.materialReceivedGm =
        Math.round(materialRows.reduce((s, r) => s + materialWeightGm(r.weight), 0) * 100) / 100;
    totals.materialReceivedValue =
        Math.round(materialRows.reduce((s, r) => s + (r.value || 0), 0) * 100) / 100;
    return {
        type,
        title,
        generatedAt: now.toISOString(),
        periodLabel,
        rows: reportRows,
        /** Day sections — populated for `daily` only (see `ReportDayGroup`). */
        days: dayGroups,
        totals,
    };
}
/**
 * Serializes a report into RFC-4180 CSV (quoted, escaped, CRLF line endings).
 * Shared by web, desktop AND mobile so every platform exports the same file.
 * Day-wise reports (Daily Sales) emit one row per product per DAY with a
 * leading Date column; flat reports keep the classic columns.
 */
export function reportToCsv(report) {
    const dayWise = (report.days?.length ?? 0) > 0;
    const header = dayWise
        ? ["Date", "Product", "SKU", "Color", "Size", "Stock", "Sold Qty", "Sold Wt (gm)", "Revenue", "Profit", "Material Wt (gm)", "Material Recvd (₹)"]
        : ["Product", "SKU", "Color", "Size", "Stock", "Sold Qty", "Sold Wt (gm)", "Revenue", "Profit", "Material Wt (gm)", "Material Recvd (₹)"];
    const quote = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const rowCells = (r, date = "") => [...(dayWise ? [date] : []), r.productName, r.sku ?? "", r.color ?? "", r.size ?? "", r.stock, r.soldQuantity, Math.round(r.soldWeightGm * 1000) / 1000, r.revenue, r.profit, "", ""]
        .map(quote)
        .join(",");
    const t = report.totals;
    // Totals row — the aggregates the reports screen shows, incl. material in.
    // "Total" lands in Date (daywise) or Product (flat); the remaining name
    // columns are padded so the cell count always matches the header.
    const padCount = dayWise ? 4 : 3; // Product/SKU/Color/Size (Product holds "Total" when flat)
    const totalsCells = [
        "Total",
        ...Array.from({ length: padCount }, () => ""),
        t.stock,
        t.soldQuantity,
        Math.round((t.weightSoldGm ?? t.soldWeight) * 1000) / 1000,
        t.revenue,
        t.profit,
        t.materialReceivedGm ?? 0,
        t.materialReceivedValue ?? 0,
    ];
    const lines = [
        header.join(","),
        ...(dayWise
            ? (report.days ?? []).flatMap((d) => d.rows.map((r) => rowCells(r, d.day)))
            : report.rows.map((r) => rowCells(r))),
        totalsCells.map(quote).join(","),
    ];
    return lines.join("\r\n");
}
//# sourceMappingURL=dashboard.js.map