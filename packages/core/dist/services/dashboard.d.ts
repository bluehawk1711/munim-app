import type { DbClient } from "../db/client.js";
import * as schema from "../db/schema.js";
/** Free-text material-returned weight ("5gm", "500mg", "5.2") → GRAMS.
 *  `parseNetWeight` strips the unit, so the unit is read from the TEXT itself
 *  ("…mg" → milligrams, anything else → grams). Unparseable → 0. */
export declare function materialWeightGm(text: string | null | undefined): number;
/** Period the dashboard KPI tiles are scoped to (chip presets resolve to
 *  ISO date bounds before they reach the API). */
export type DashboardPeriod = {
    /** Inclusive lower bound (yyyy-mm-dd or ISO). Open when omitted. */
    from?: string;
    /** Inclusive upper bound (yyyy-mm-dd or ISO). Open when omitted. */
    to?: string;
};
/** Chip presets shared by all three dashboards. */
export type DashboardPreset = "today" | "week" | "month";
/**
 * Chip preset → inclusive `yyyy-mm-dd` bounds in the LOCAL day (week starts
 * Monday, month starts on the 1st). One definition so web, desktop and mobile
 * show identical numbers for the same chip.
 */
export declare function dashboardPresetRange(preset: DashboardPreset, now?: Date): Required<DashboardPeriod>;
/** Period-scoped headline KPIs — revenue, bills, weight sold, material in. */
export type DashboardPeriodKpis = {
    /** ISO bounds actually used (null = open end). */
    from: string | null;
    to: string | null;
    revenue: number;
    invoicesCount: number;
    /** Weight sold in the period, GRAMS — line-level frozen pricing.weightGm
     *  (per unit × quantity) with the line's weight snapshot as fallback. */
    weightSoldGm: number;
    /** Old material handed in by customers — parsed gram sum. */
    materialReceivedGm: number;
    /** Its assessed value (₹). */
    materialReceivedValue: number;
};
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
    recentInvoices: (schema.Invoice & {
        items?: schema.InvoiceItem[];
    })[];
    monthlySales: {
        month: string;
        revenue: number;
        orders: number;
    }[];
    stockDistribution: {
        name: string;
        value: number;
        color: string;
    }[];
    /** Top-selling products by revenue (all-time). */
    topProducts: {
        productName: string;
        sku: string | null;
        quantitySold: number;
        revenue: number;
    }[];
    /** Revenue share per product category (top 5 + "Other"). */
    salesByCategory: {
        name: string;
        value: number;
        color: string;
    }[];
    /** Invoice counts by status (Paid / Partial / Unpaid / Draft). */
    invoiceStatus: {
        name: string;
        value: number;
        color: string;
    }[];
    /** Open advances split by direction (Given by us vs Taken by us). */
    advanceSplit: {
        name: string;
        value: number;
        color: string;
    }[];
    /** Units sold per month (last 6 months). */
    soldPerMonth: {
        month: string;
        quantity: number;
    }[];
    /** Period-scoped KPIs for the dashboard chips (Today / This week /
     *  This month / Custom). All-time when no period is supplied. */
    period: DashboardPeriodKpis;
    recentActivity: schema.ActivityLog[];
    recentAdvances: (schema.Advance & {
        partyName?: string;
    })[];
};
export declare function getDashboard(db: DbClient, period?: DashboardPeriod): Promise<DashboardStats>;
export type ReportType = "daily" | "weekly" | "monthly" | "yearly" | "stock" | "low_stock" | "sold";
export type ReportRow = {
    productId: string | null;
    productName: string;
    sku: string | null;
    color: string | null;
    size: string | null;
    stock: number;
    soldQuantity: number;
    /** Unit weight (null when the product has no weight set). */
    weight: number | null;
    /** Display unit: "mg" or "gm". */
    weightUnit: string;
    /** Total weight sold (quantity × unit weight). */
    soldWeight: number;
    /** Line-level weight sold in GRAMS — frozen `pricing.weightGm` × quantity
     *  (line weight snapshot as fallback); independent of later product edits. */
    soldWeightGm: number;
    revenue: number;
    profit: number;
};
/** One day's section of the day-wise Daily Sales report — a header (the day
 *  and what it did) plus the products sold THAT day. Only `daily` fills this;
 *  every other report type returns []. */
export type ReportDayGroup = {
    /** ISO date (yyyy-mm-dd). */
    day: string;
    /** Human day label — "20 Oct 2026". */
    label: string;
    /** Invoices raised that day (a day with sales has ≥ 1). */
    invoices: number;
    daySoldQuantity: number;
    dayRevenue: number;
    rows: ReportRow[];
};
export declare function getReport(db: DbClient, type: ReportType, startDate?: string, endDate?: string): Promise<{
    type: ReportType;
    title: string;
    generatedAt: string;
    periodLabel: string;
    rows: ReportRow[];
    /** Day sections — populated for `daily` only (see `ReportDayGroup`). */
    days: ReportDayGroup[];
    totals: {
        stock: number;
        soldQuantity: number;
        soldWeight: number;
        weightSoldGm: number;
        revenue: number;
        profit: number;
        materialReceivedGm: number;
        materialReceivedValue: number;
    };
}>;
/**
 * Serializes a report into RFC-4180 CSV (quoted, escaped, CRLF line endings).
 * Shared by web, desktop AND mobile so every platform exports the same file.
 * Day-wise reports (Daily Sales) emit one row per product per DAY with a
 * leading Date column; flat reports keep the classic columns.
 */
export declare function reportToCsv(report: {
    title: string;
    rows: ReportRow[];
    days?: ReportDayGroup[];
    totals: {
        stock: number;
        soldQuantity: number;
        soldWeight: number;
        revenue: number;
        profit: number;
        /** Line-level weight sold (gm) — falls back to soldWeight when absent. */
        weightSoldGm?: number;
        materialReceivedGm?: number;
        materialReceivedValue?: number;
    };
}): string;
//# sourceMappingURL=dashboard.d.ts.map