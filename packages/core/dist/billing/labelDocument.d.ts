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
    /** Weight in milligrams. */
    weightMg: number | null;
    color: string | null;
    size: string | null;
    category: string | null;
    sellingPrice: number;
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
    weight: number | null;
    sellingPrice: number;
    colorName?: string | null;
    sizeName?: string | null;
    categoryName?: string | null;
}, shop?: LabelShop): ProductLabel;
/** One physical label: 63.5 × 33.9 mm (3 × 8 grid = 24 per A4 sheet). */
export declare const LABEL_WIDTH_MM = 63.5;
export declare const LABEL_HEIGHT_MM = 33.9;
/** Renders ONE label's inner markup (shared by the sheet + previews). */
export declare function renderLabelMarkup(label: ProductLabel): string;
export type LabelSheetOptions = {
    /** Total physical labels (each copy = one label on the sheet). Default 1. */
    copies?: number;
    /** Columns per page. Default 3. */
    cols?: number;
    /** Rows per page. Default 8. */
    rows?: number;
    /** Rendered page width in px (96 dpi A4 ≈ 794). Default 794. */
    pageWidthPx?: number;
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