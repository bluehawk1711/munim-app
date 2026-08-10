import type { DbClient } from "../db/client";
import * as schema from "../db/schema";
export declare class InvoiceError extends Error {
    code: string;
    status: number;
    constructor(message: string, code: string, status?: number);
}
export type SaleInput = {
    productId: string;
    quantity: number;
    sellingPrice?: number;
    customerName?: string;
    customerPhone?: string;
    /** true → record a full payment, invoice marked PAID */
    paid?: boolean;
    paymentMethod?: string;
    notes?: string;
};
/** Quick single-product sale (like the stockPilot "sell" flow). Decrements stock. */
export declare function createSale(db: DbClient, input: SaleInput): Promise<InvoiceWithItems | null>;
export type InvoiceItemInput = {
    productId?: string;
    productName: string;
    sku?: string;
    color?: string;
    size?: string;
    description?: string;
    quantity: number;
    price: number;
};
export type InvoiceInput = {
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
    partyId?: string;
    date?: string | Date;
    items: InvoiceItemInput[];
    deliveryCharge?: number;
    discount?: number;
    notes?: string;
    shopDetails?: {
        name: string;
        address: string;
        phones: string[];
        email: string;
    };
    templateSettings?: Record<string, unknown>;
    /** initial payment received */
    amountPaid?: number;
    paymentMethod?: string;
    status?: "DRAFT" | "UNPAID" | "PARTIAL" | "PAID";
};
export declare function createInvoice(db: DbClient, input: InvoiceInput): Promise<InvoiceWithItems | null>;
export type InvoiceWithItems = schema.Invoice & {
    items: schema.InvoiceItem[];
};
export declare function getInvoice(db: DbClient, id: string): Promise<InvoiceWithItems | null>;
export type InvoiceFilters = {
    search?: string;
    status?: "DRAFT" | "UNPAID" | "PARTIAL" | "PAID" | "all";
    partyId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
};
export declare function listInvoices(db: DbClient, filters?: InvoiceFilters): Promise<{
    invoices: {
        items: {
            id: string;
            sku: string | null;
            productId: string | null;
            quantity: number;
            total: number;
            invoiceId: string;
            productName: string;
            color: string | null;
            size: string | null;
            description: string | null;
            price: number;
        }[];
        id: string;
        invoiceNumber: string;
        partyId: string | null;
        customerName: string | null;
        customerPhone: string | null;
        customerAddress: string | null;
        date: Date;
        status: "DRAFT" | "UNPAID" | "PARTIAL" | "PAID";
        subtotal: number;
        deliveryCharge: number;
        discount: number;
        total: number;
        amountPaid: number;
        notes: string | null;
        shopDetails: {
            name: string;
            address: string;
            phones: string[];
            email: string;
        } | null;
        templateSettings: Record<string, unknown> | null;
        createdAt: Date;
        updatedAt: Date;
    }[];
    pagination: {
        page: number;
        pageSize: number;
        totalCount: number;
        totalPages: number;
    };
}>;
/** Record a payment against an invoice; updates status + party money tracking. */
export declare function recordInvoicePayment(db: DbClient, invoiceId: string, input: {
    amount: number;
    method?: string;
    date?: string | Date;
    note?: string;
}): Promise<InvoiceWithItems | null>;
export declare function deleteInvoice(db: DbClient, id: string): Promise<{
    success: boolean;
}>;
//# sourceMappingURL=invoices.d.ts.map