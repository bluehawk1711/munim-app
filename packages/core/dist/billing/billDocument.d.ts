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
/** Toggleable columns of the E-commerce ESTIMATE grid. The Classic template
 *  has its own fixed layout and ignores these. `weight` is gold's G. Wt.
 *  column (silver's combined Weight column shares the same toggle);
 *  `chejatNag` is the gold-only merged Chejat/Nag stack. */
export type EstimateColumnId = "description" | "purity" | "weight" | "chejatNag" | "rate" | "labour" | "otherCharges" | "amount";
/** Column toggles for the NEW BILL screens (desktop + mobile): gold's grid
 *  fields with their printed headers — `purity` shows as "Remark" (the
 *  client's term for the purity stamp column). */
export declare const GOLD_ESTIMATE_COLUMNS: readonly [{
    readonly id: "description";
    readonly label: "Description";
}, {
    readonly id: "purity";
    readonly label: "Remark";
}, {
    readonly id: "weight";
    readonly label: "G. Wt.";
}, {
    readonly id: "chejatNag";
    readonly label: "Chejat/Nag";
}, {
    readonly id: "rate";
    readonly label: "Rate ₹/gm";
}, {
    readonly id: "labour";
    readonly label: "Labour";
}, {
    readonly id: "otherCharges";
    readonly label: "Other Charges";
}, {
    readonly id: "amount";
    readonly label: "Amount";
}];
/** Silver's grid fields — one combined Weight column, no Chejat/Nag. */
export declare const SILVER_ESTIMATE_COLUMNS: readonly [{
    readonly id: "description";
    readonly label: "Description";
}, {
    readonly id: "purity";
    readonly label: "Remark";
}, {
    readonly id: "weight";
    readonly label: "Weight";
}, {
    readonly id: "rate";
    readonly label: "Rate ₹/gm";
}, {
    readonly id: "labour";
    readonly label: "Labour";
}, {
    readonly id: "otherCharges";
    readonly label: "Other Charges";
}, {
    readonly id: "amount";
    readonly label: "Amount";
}];
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
    /** Estimate-grid columns turned OFF via the New Bill screen's per-metal
     *  column toggles — hidden from the printed bill. Gold grid and silver
     *  grid have different fields (gold: G. Wt. + Chejat/Nag; silver: the
     *  combined Weight), so each keeps its own list. Missing side / missing
     *  key (old snapshots, web payloads) = every column shown. Optional so
     *  payload builders that predate the toggles still typecheck. */
    hiddenColumns?: {
        gold: EstimateColumnId[];
        silver: EstimateColumnId[];
    };
}
/** Defaults for the per-bill display toggles — all ON. The template defaults
 *  to the E-commerce estimate sheet (the shop's new default bill design). */
export declare const DEFAULT_BILL_TEMPLATE_SETTINGS: BillTemplateSettings;
/**
 * Normalize a possibly-partial settings object (e.g. settings snapshots saved
 * before the display toggles existed) into a complete BillTemplateSettings.
 * Missing toggles default ON, matching DEFAULT_BILL_TEMPLATE_SETTINGS.
 * `hiddenColumns` deep-defaults both metals to [] (nothing hidden) — an
 * explicitly-undefined value (payload builders spreading a partial snapshot)
 * also lands on the empty lists.
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
    /** Metal purity stamp — printed in the estimate's Purity column (dropdown
     *  on the bill screens; Classic still appends it to the name). */
    purity?: string | null;
    /** Gross-weight free text (bill G. Wt. column in the estimate template). */
    grossWeight?: string | null;
    /** Bill line's nag-less weight in GRAMS — gold net-weight derivation input
     *  (`net = gross − nag + chejat`); the printed Nag Wt. column. */
    nagLessWeight?: number | null;
    /** Bill line's chejat (stone) weight in GRAMS — the other derivation
     *  input; the printed Chejat Wt. column. */
    chejatWeight?: number | null;
    /** Product weight + unit snapshot — display for the WEIGHT column only. */
    weight?: number | null;
    weightUnit?: string | null;
    quantity: number;
    price: number;
    /** Frozen pricing inputs (rate/metal value/labour/povayi) — estimate columns. */
    pricing?: InvoiceItemPricing | null;
}
export interface BillLine extends BillLineInput {
    /** quantity × price, rounded to 2 decimals */
    total: number;
}
/** What the printed document IS: a normal invoice, or a quotation/estimate
 *  drawn straight from an order. Only the header wording changes — the
 *  numbers, columns and paid/balance block are identical, because an estimate
 *  is a bill the customer hasn't settled yet. */
export type BillKind = "invoice" | "quotation";
/** Header word for the printed document — "Bill" or "Estimate". */
export declare function billKindLabel(bill: Pick<BillDocument, "kind">): string;
export interface BillDocument {
    billNo: string;
    /** invoice | quotation — see `billKindLabel`. */
    kind: BillKind;
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
    /** Defaults to "invoice" — set "quotation" for an order/estimate print. */
    kind?: BillKind;
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
 * and the individual flat charges (nag / povayi / other ₹). The bill prints
 * them ITEMIZED inside the Other Charges cell with their prefixes —
 * `Nag: 500.00` / `Povayi: 250.00` / `Other: 150.00` — never summed on a line
 * (the totals row adds them once). Legacy snapshots saved before nag/other
 * were frozen have them missing → 0 (their povayi still shows). NULL when the
 * line froze no pricing at all (manual/legacy lines).
 */
export declare function estimateRowOf(line: BillLineInput & {
    total?: number;
}): {
    rate: number;
    value: number;
    labour: number | null;
    charges: {
        nag: number;
        povayi: number;
        other: number;
    } | null;
};
/** The itemized Other Charges cell lines — one `Prefix: 0.00` entry per
 *  non-empty charge, in the client's order (Nag, Povayi, Other). Empty → []. */
export declare function estimateChargeLines(charges: {
    nag: number;
    povayi: number;
    other: number;
} | null): string[];
/** The merged Chejat/Nag cell lines — `Chejat: 0.150` / `Nag: 0.620`, one per
 *  non-empty derivation input (grams, 3 dp), itemized with prefixes exactly
 *  like the Other Charges cell (client merged the two columns into one).
 *  Empty → []. */
export declare function estimateWeightLines(line: BillLineInput): string[];
/** Tallest itemized stack in a row — the Other Charges lines vs the merged
 *  Chejat/Nag lines — gated on which columns are actually visible (a hidden
 *  column's stack doesn't grow the row). Shared by the PDF's draw + height
 *  measurement so the sheet frame always hugs the real table. */
export declare function estimateRowStackLines(line: BillLineInput, visible: {
    chejatNag: boolean;
    otherCharges: boolean;
}): number;
/** Estimate row height (mm): base 7 — 10 when the name carries a description
 *  line under it — growing 3.6 mm per itemized stack line. */
export declare function estimateRowHeightMm(hasDescription: boolean, stackLines: number): number;
/** Totals-row height (mm): 7, or taller when the merged Chejat/Nag totals
 *  cell stacks its prefixed sums ("Chejat: …" above "Nag: …"). */
export declare function estimateTotalsHeightMm(stackLines: number): number;
/** Sum of the non-zero flat charges — the totals row's Other Charges cell. */
export declare function estimateChargesTotal(charges: {
    nag: number;
    povayi: number;
    other: number;
} | null): number;
/** Trimmed purity stamp for the estimate's Purity column (null → "-"). */
export declare function purityCellOf(line: BillLineInput): string | null;
/** Grams for the estimate's Chejat/Nag weight columns (null → "-"). */
export declare function weightCellOf(value: number | null | undefined): string | null;
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