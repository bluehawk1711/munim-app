import type { DbClient } from "../db/client";
import * as schema from "../db/schema";
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
    recentActivity: schema.ActivityLog[];
    recentAdvances: (schema.Advance & {
        partyName?: string;
    })[];
};
export declare function getDashboard(db: DbClient): Promise<DashboardStats>;
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
export declare function getReport(db: DbClient, type: ReportType, startDate?: string, endDate?: string): Promise<{
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
}>;
/**
 * Serializes a report into RFC-4180 CSV (quoted, escaped, CRLF line endings).
 * Shared by web, desktop AND mobile so every platform exports the same file.
 */
export declare function reportToCsv(report: {
    title: string;
    rows: ReportRow[];
    totals: {
        stock: number;
        soldQuantity: number;
        soldWeight: number;
        revenue: number;
        profit: number;
    };
}): string;
//# sourceMappingURL=dashboard.d.ts.map