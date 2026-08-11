/**
 * Shared bill/invoice generation — THE single source of truth used by all
 * three apps (web, desktop, mobile). Every app builds the SAME bill from the
 * same code: totals, discount, delivery, amount-in-words, due amount, status.
 * Apps only add a thin platform renderer (jsPDF / print / share text) on top.
 */
export type BillStatus = "DRAFT" | "UNPAID" | "PARTIAL" | "PAID";
export interface BillShopDetails {
    name: string;
    address: string | null;
    phones: string[];
    email: string | null;
}
export interface BillLineInput {
    productName: string;
    description?: string | null;
    sku?: string | null;
    color?: string | null;
    size?: string | null;
    quantity: number;
    price: number;
}
export interface BillLine extends BillLineInput {
    /** quantity × price, rounded to 2 decimals */
    total: number;
}
export interface BillDocument {
    billNo: string;
    /** ISO date (yyyy-mm-dd) */
    date: string;
    customerName: string | null;
    customerPhone: string | null;
    customerAddress: string | null;
    shop: BillShopDetails;
    lines: BillLine[];
    subtotal: number;
    discount: number;
    deliveryCharge: number;
    total: number;
    amountInWords: string;
    amountPaid: number;
    dueAmount: number;
    status: BillStatus;
    currency: string;
}
export interface BuildBillInput {
    billNo: string;
    date?: string | Date;
    customerName?: string | null;
    customerPhone?: string | null;
    customerAddress?: string | null;
    shop: BillShopDetails;
    lines: BillLineInput[];
    discount?: number;
    deliveryCharge?: number;
    amountPaid?: number;
    status?: BillStatus;
    currency?: string;
}
/** Builds a normalized bill document from raw inputs. Pure + shared. */
export declare function buildBillDocument(input: BuildBillInput): BillDocument;
/**
 * Plain-text render of a bill — the platform-agnostic export that works in
 * every app (copy/share/print). Richer renders (jsPDF, HTML) should consume
 * BillDocument and keep the same numbers.
 */
export declare function renderBillText(bill: BillDocument): string;
/**
 * HTML render of a bill — the shared, print-friendly markup used by the
 * mobile app (expo-print) and available to any platform that prints HTML.
 * Same numbers as `renderBillText` / jsPDF — one model, any renderer.
 */
export declare function renderBillHtml(bill: BillDocument): string;
//# sourceMappingURL=billDocument.d.ts.map