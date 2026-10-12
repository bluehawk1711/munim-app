import type { DbClient } from "../db/client.js";
import * as schema from "../db/schema.js";
import type { BillTemplateSettings } from "../billing/index.js";
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
    /** Metal purity stamp printed beside the name (`p:` prefix). */
    purity?: string;
    /** Gross-weight free text snapshot from the product (bill G.Wt. column). */
    grossWeight?: string;
    /** Product weight + unit snapshot — bill WEIGHT column display only. */
    weight?: number | null;
    weightUnit?: string | null;
    /** Frozen pricing snapshot computed by the bill screen (reflects its
     *  per-line rate/labour/charge edits); null/omitted → the server freezes
     *  its own from the product at save time. */
    pricing?: schema.InvoiceItemPricing | null;
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
    /** Material returned by customer — free text weight, e.g. "5gm". */
    materialReturnedWeight?: string;
    /** Monetary value of material returned (deducted from total). */
    materialReturnedValue?: number;
    /** Per-bill label for the deduction row (blank → "Material Returned"). */
    materialReturnedTitle?: string;
    notes?: string;
    shopDetails?: {
        name: string;
        address: string;
        phones: string[];
        email: string;
    };
    /** Snapshot of the bill template settings (template / classic color / 2-in-1). */
    templateSettings?: BillTemplateSettings;
    /** Gold base ₹/gram used for THIS bill (reprint keeps it; null → current shop rate). */
    goldRate?: number;
    /** Silver ₹/gram used for THIS bill (bill-level override; null → shop rate). */
    silverRate?: number;
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
            description: string | null;
            pricing: schema.InvoiceItemPricing | null;
            productId: string | null;
            productName: string;
            sku: string | null;
            weightUnit: string | null;
            grossWeight: string | null;
            purity: string | null;
            color: string | null;
            size: string | null;
            id: string;
            weight: number | null;
            quantity: number;
            total: number;
            invoiceId: string;
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
        materialReturnedWeight: string | null;
        materialReturnedValue: number;
        materialReturnedTitle: string | null;
        total: number;
        amountPaid: number;
        notes: string | null;
        shopDetails: {
            name: string;
            address: string;
            phones: string[];
            email: string;
        } | null;
        templateSettings: BillTemplateSettings | null;
        goldRate: number | null;
        silverRate: number | null;
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