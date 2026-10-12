import type { InvoiceItemPricing } from "../db/schema.js";
/**
 * Shared bill/invoice generation — THE single source of truth used by all
 * three apps (web, desktop, mobile). Every app builds the SAME bill from the
 * same code: totals, discount, delivery, amount-in-words, due amount, status.
 * Apps only add a thin platform renderer (jsPDF / print / share text) on top.
 */
export type BillStatus = "DRAFT" | "UNPAID" | "PARTIAL" | "PAID";
/**
 * Bill template settings — the shared model behind the template / classic
 * color / 2-in-1 options. Lives in core (not the UI kit) so all three apps
 * can type the saved `templateSettings` snapshot without importing a UI
 * package. `@munim/ui` re-exports these for the web/desktop form.
 */
export type BillTemplate = "jewellery" | "ecommerce";
export type BillClassicColor = "red" | "yellow";
export type BillMode = "duplicate" | "distinct";
export interface BillTemplateSettings {
    template: BillTemplate;
    classicColor: BillClassicColor;
    /** 2-in-1: two bills on one sheet. */
    twoInOne: boolean;
    /** duplicate = same bill twice; distinct = a second, separate bill. */
    mode: BillMode;
    /** Show the WEIGHT column (product weight + unit) after the name column. */
    weightAfterName: boolean;
    /** Show the shop's gold rate row (₹/g) on the bill. */
    goldRateLine: boolean;
    /** Show the shop's silver rate row (₹/g) on the bill. */
    silverRateLine: boolean;
}
/** Defaults for the per-bill display toggles — all ON. The template defaults
 *  to the E-commerce estimate sheet (the shop's new default bill design). */
export declare const DEFAULT_BILL_TEMPLATE_SETTINGS: BillTemplateSettings;
/**
 * Normalize a possibly-partial settings object (e.g. settings snapshots saved
 * before the display toggles existed) into a complete BillTemplateSettings.
 * Missing toggles default ON, matching DEFAULT_BILL_TEMPLATE_SETTINGS.
 */
export declare function mergeBillTemplateSettings(partial?: Partial<BillTemplateSettings> | null): BillTemplateSettings;
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
    /** Metal purity stamp printed beside the name (`p:` prefix). */
    purity?: string | null;
    /** Gross-weight free text (bill G.Wt. column in the estimate template). */
    grossWeight?: string | null;
    /** Product weight + unit snapshot — display for the WEIGHT column only. */
    weight?: number | null;
    weightUnit?: string | null;
    quantity: number;
    price: number;
    /** Frozen pricing inputs (rate/metal value/labour) — estimate columns. */
    pricing?: InvoiceItemPricing | null;
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
    /** Material returned by customer — weight description, e.g. "5gm". */
    materialReturnedWeight: string | null;
    /** Monetary value of material returned (deducted from total). */
    materialReturnedValue: number;
    /** Per-bill label for the deduction row (null → "Material Returned"). */
    materialReturnedTitle: string | null;
    total: number;
    amountInWords: string;
    amountPaid: number;
    dueAmount: number;
    status: BillStatus;
    currency: string;
    /** Shop's gold rate (₹/g) at build time — drives the gold rate row. */
    goldRate: number | null;
    /** Shop's silver rate (₹/g) at build time — drives the silver rate row. */
    silverRate: number | null;
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
    materialReturnedWeight?: string | null;
    materialReturnedValue?: number;
    /** Per-bill label for the deduction row (blank → "Material Returned"). */
    materialReturnedTitle?: string | null;
    amountPaid?: number;
    status?: BillStatus;
    currency?: string;
    /** Shop rates (₹/g) to print as rate rows; omitted → rows hidden. */
    goldRate?: number | null;
    silverRate?: number | null;
}
/** Row label for the material-returned deduction — per-bill title or default. */
export declare function materialReturnedTitleOf(bill: BillDocument): string;
/** Product name with the purity stamp in parentheses (`(22K)`) beside it. */
export declare function nameWithPurity(line: BillLineInput): string;
/**
 * Estimate-template row derivations: per-gram rate, metal value, labour ₹,
 * other charges ₹ — the single "Other Charges" column printed instead of a
 * povayi-only column: nag + povayi + other summed. Legacy snapshots (saved
 * before nag/other were frozen) have them missing → 0, so the sum is just
 * their povayi — old bills render unchanged. NULL when the line froze no
 * pricing at all (manual/legacy lines).
 */
export declare function estimateRowOf(line: BillLineInput & {
    total?: number;
}): {
    rate: number;
    value: number;
    labour: number | null;
    otherCharges: number | null;
};
/**
 * Labour method tag printed beside the Labour amount on the estimate —
 * "(fixed)" / "(11.82/gm)" / "(2.5%)" so the shop can see whether the
 * labour was a flat charge, a per-gram rate or a percentage of metal value.
 * Blank when the line froze no labour method (legacy/manual lines).
 */
export declare function estimateLabourTag(line: BillLineInput): string;
/**
 * Estimate weight-column layout: gold bills show the G. Wt. + N. Wt. pair;
 * silver-only bills show ONE combined "Weight" column (gross weight is a
 * gold-only concept at this shop). Bills with no frozen metal info (all
 * manual/legacy lines) keep the classic pair so old bills look unchanged.
 */
export declare function estimateWeightLayout(bill: BillDocument): "split" | "combined";
/**
 * Shop rate rows gated by the per-bill toggles, present rate values AND the
 * metals the bill actually contains (a silver-only bill never prints the
 * gold rate, and vice versa). Rates state their unit — per gm.
 */
export declare function rateRowsOf(bill: BillDocument, settings: BillTemplateSettings): string[];
/** Builds a normalized bill document from raw inputs. Pure + shared. */
export declare function buildBillDocument(input: BuildBillInput): BillDocument;
/**
 * Plain-text render of a bill — the platform-agnostic export that works in
 * every app (copy/share/print). Richer renders (jsPDF, HTML) should consume
 * BillDocument and keep the same numbers.
 */
export declare function renderBillText(bill: BillDocument): string;
//# sourceMappingURL=billDocument.d.ts.map