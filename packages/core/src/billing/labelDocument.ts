import { barcodeSvg } from "../utils/barcode.js";
import { formatWeight } from "../utils/format.js";

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
export function buildProductLabel(
  product: {
    id: string;
    name: string;
    sku: string;
    barcode: string | null;
    weight: number | null;
    sellingPrice: number;
    colorName?: string | null;
    sizeName?: string | null;
    categoryName?: string | null;
  },
  shop?: LabelShop,
): ProductLabel {
  return {
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    barcode: product.barcode,
    weightMg: product.weight ?? null,
    color: product.colorName ?? null,
    size: product.sizeName ?? null,
    category: product.categoryName ?? null,
    sellingPrice: product.sellingPrice,
    shopName: shop?.name ?? "",
  };
}

const esc = (s: string | null | undefined): string =>
  (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** One physical label: 63.5 × 33.9 mm (3 × 8 grid = 24 per A4 sheet). */
export const LABEL_WIDTH_MM = 63.5;
export const LABEL_HEIGHT_MM = 33.9;

/** Renders ONE label's inner markup (shared by the sheet + previews).
 * 3 fields only: product name (top) → barcode (middle) → weight (bottom).
 */
export function renderLabelMarkup(label: ProductLabel): string {
  const barcode = label.barcode ? barcodeSvg(label.barcode, { height: 34, scale: 2, fontSize: 8 }) : "";
  const weight = label.weightMg != null ? formatWeight(label.weightMg) : "";

  return `<div class="label">
    <div class="l-name">${esc(label.productName)}</div>
    <div class="l-barcode">${barcode || `<span class="l-nocode">NO BARCODE</span>`}</div>
    <div class="l-weight">${weight ? esc(weight) : "&nbsp;"}</div>
  </div>`;
}

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
export function renderLabelSheetHtml(
  labels: ProductLabel[],
  opts: LabelSheetOptions = {},
): string {
  const copies = Math.max(1, Math.floor(opts.copies ?? 1));
  const cols = opts.cols ?? 3;
  const rows = opts.rows ?? 8;
  const pageWidthPx = opts.pageWidthPx ?? 794;

  // Copy the label list `copies` times, filling each page's grid.
  const perPage = cols * rows;
  const all = Array.from({ length: copies }, () => labels).flat();

  const pages: string[] = [];
  for (let i = 0; i < all.length; i += perPage) {
    const slice = all.slice(i, i + perPage);
    const cells = slice.map(renderLabelMarkup).join("");
    // Pad the final page so the grid keeps its shape (print doesn't reflow).
    const pad = Math.max(0, perPage - slice.length);
    const pads = Array.from({ length: pad }, () => `<div class="label label-empty"></div>`).join("");
    pages.push(`<div class="page">${cells}${pads}</div>`);
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4; margin: 0; }
  html, body { margin: 0; padding: 0; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #111; }
  .page { width: ${pageWidthPx}px; margin: 0 auto; }
  .label {
    box-sizing: border-box;
    width: ${LABEL_WIDTH_MM}mm;
    height: ${LABEL_HEIGHT_MM}mm;
    float: left;
    padding: 3mm 2.5mm;
    overflow: hidden;
    border: 1px dashed #ddd;
    display: flex;
    flex-direction: column;
  }
  .label-empty { border: none; }
  .l-name { font-size: 11px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .l-barcode { display: flex; justify-content: center; margin-top: 1px; }
  .l-barcode svg { display: block; }
  .l-nocode { font-size: 9px; color: #999; padding: 6px 0; }
  .l-weight { font-size: 9px; font-weight: 600; color: #333; margin-top: auto; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
</head>
<body>${pages.join("")}</body>
</html>`;
}

/** Plain-text version of a single label (copy/share fallback). */
export function renderLabelText(label: ProductLabel): string {
  const lines = [
    label.productName,
    label.barcode ? `Barcode: ${label.barcode}` : "",
    label.weightMg != null ? `Weight: ${formatWeight(label.weightMg)}` : "",
  ].filter(Boolean);
  return lines.join("\n");
}
