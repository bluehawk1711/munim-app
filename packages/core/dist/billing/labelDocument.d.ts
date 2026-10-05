/**
 * Product label printing — the single source of truth for the physical label
 * attached/stamped onto a product. One model + one HTML sheet renderer used by
 * all three apps:
 *   - Web/desktop: jsPDF `html()` (PDF download) + window.print (exact sheet)
 *   - Mobile: expo-print `printToFileAsync` / native print dialog
 *
 * The label is built ONLY from the existing product record (plus the shop
 * header from settings) — never re-entered by hand.
 */
export type ProductLabel = {
    productId: string;
    productName: string;
    sku: string;
    barcode: string | null;
    /** Product type: Gold, Silver, Diamond, Platinum, Other. */
    productType: string;
    /** Weight value. */
    weightMg: number | null;
    /** Display unit: "mg" or "gm". */
    weightUnit: string;
    /** Jewelry-specific weight fields (free text). */
    grossWeight: string | null;
    nagLessWeight: string | null;
    nagRate: string | null;
    chejatWeight: string | null;
    netWeight: string | null;
    /** Metal purity stamp — e.g. "24K", "22K", "916", "925". */
    purity: string | null;
    color: string | null;
    size: string | null;
    category: string | null;
    sellingPrice: number;
    /** Labour (making) charge — printed on the silver label's price line. */
    labourType: string | null;
    labourValue: number | null;
    shopName: string;
};
export type LabelShop = {
    name: string;
};
/** Builds a label from a product row (+ optional shop header). Pure + shared. */
export declare function buildProductLabel(product: {
    id: string;
    name: string;
    sku: string;
    barcode: string | null;
    type?: string;
    weight: number | null;
    weightUnit?: string;
    grossWeight?: string | null;
    nagLessWeight?: string | null;
    nagRate?: string | null;
    chejatWeight?: string | null;
    netWeight?: string | null;
    purity?: string | null;
    sellingPrice: number;
    labourType?: string | null;
    labourValue?: number | null;
    colorName?: string | null;
    sizeName?: string | null;
    categoryName?: string | null;
}, shop?: LabelShop): ProductLabel;
/** Formats the labour (making) charge for a label — "₹500" (FIXED),
 *  "₹50/g" (PER_GRAM), "10%" (PERCENT). "" when absent/zero. */
export declare function formatLabelLabour(label: {
    labourType: string | null;
    labourValue: number | null;
}): string;
export type SilverPriceLineOptions = {
    /** Print the selling price. Default true. */
    showPrice?: boolean;
    /** Print the labour (making) charge beside the price. Default true. */
    showLabour?: boolean;
    /** Prefix before the ₹ price (e.g. "p"). Default "p". */
    pricePrefix?: string;
    /** Prefix before the labour value (e.g. "L"). Default "L". */
    labourPrefix?: string;
};
/** The silver label's price line — price and labour on ONE line, each
 *  toggleable (TSPL, the dialog preview and the A4 sheet share this). */
export declare function buildSilverPriceLine(label: Pick<ProductLabel, "sellingPrice" | "labourType" | "labourValue">, opts?: SilverPriceLineOptions): string;
/** One physical label: 63.5 × 33.9 mm (3 × 8 grid = 24 per A4 sheet). */
export declare const LABEL_WIDTH_MM = 63.5;
export declare const LABEL_HEIGHT_MM = 33.9;
/** Renders ONE label's inner markup (shared by the sheet + previews).
 * Silver: LEFT = name + " - sil" + purity + weight + size, then the price
 *         line (price + labour), RIGHT = barcode (+ SKU)
 * Gold:   LEFT = name + weight + 4 weight fields, RIGHT = barcode (+ SKU)
 * The SKU is a small line directly below the barcode (opts.showSku, default on).
 * The size is concatenated after the silver weight (opts.showSize + opts.sizePrefix).
 */
export declare function renderLabelMarkup(label: ProductLabel, opts?: {
    showSku?: boolean;
    showSize?: boolean;
    sizePrefix?: string;
    showPrice?: boolean;
    showLabour?: boolean;
    pricePrefix?: string;
    labourPrefix?: string;
}): string;
export type LabelSheetOptions = {
    /** Total physical labels (each copy = one label on the sheet). Default 1. */
    copies?: number;
    /** Columns per page. Default 3. */
    cols?: number;
    /** Rows per page. Default 8. */
    rows?: number;
    /** Rendered page width in px (96 dpi A4 ≈ 794). Default 794. */
    pageWidthPx?: number;
    /** Print the SKU below each barcode in small text. Default true. */
    showSku?: boolean;
    /** Print the size beside the silver weight (same line). Default true. */
    showSize?: boolean;
    /** Silver size prefix shown before the size value. Default "S:". */
    sizePrefix?: string;
    /** Silver price line: print the selling price. Default true. */
    showPrice?: boolean;
    /** Silver price line: print the labour (making) charge. Default true. */
    showLabour?: boolean;
    /** Silver price prefix (shown before ₹ value). Default "p". */
    pricePrefix?: string;
    /** Silver labour prefix (shown before the labour value). Default "L". */
    labourPrefix?: string;
};
/**
 * Full print-ready HTML sheet: an A4 page with a grid of labels (default
 * 24-up: 3 cols × 8 rows). Each label is a fixed 63.5 × 33.9 mm box so a
 * normal printer + the browser's print dialog produces a correctly-sized
 * physical label sheet. Inline SVG barcodes render in expo-print's WebView,
 * jsPDF's html2canvas, and every browser — no canvas needed.
 */
export declare function renderLabelSheetHtml(labels: ProductLabel[], opts?: LabelSheetOptions): string;
/** Plain-text version of a single label (copy/share fallback). */
export declare function renderLabelText(label: ProductLabel): string;
//# sourceMappingURL=labelDocument.d.ts.map