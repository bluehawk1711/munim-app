import type { DbClient } from "../db/client.js";
import * as schema from "../db/schema.js";
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
//# sourceMappingURL=dashboard.d.ts.map