import { barcodeSvg } from "../utils/barcode.js";
import { formatWeight } from "../utils/format.js";
/** Builds a label from a product row (+ optional shop header). Pure + shared. */
export function buildProductLabel(product, shop) {
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
const esc = (s) => (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
/** One physical label: 63.5 × 33.9 mm (3 × 8 grid = 24 per A4 sheet). */
export const LABEL_WIDTH_MM = 63.5;
export const LABEL_HEIGHT_MM = 33.9;
/** Renders ONE label's inner markup (shared by the sheet + previews). */
export function renderLabelMarkup(label) {
    const barcode = label.barcode ? barcodeSvg(label.barcode, { height: 34, scale: 2, fontSize: 8 }) : "";
    const details = [
        label.color,
        label.size,
        label.weightMg != null ? formatWeight(label.weightMg) : null,
    ]
        .filter(Boolean)
        .join(" · ");
    return `<div class="label">
    <div class="l-shop">${esc(label.shopName) || "&nbsp;"}</div>
    <div class="l-name">${esc(label.productName)}</div>
    <div class="l-barcode">${barcode || `<span class="l-nocode">NO BARCODE</span>`}</div>
    <div class="l-details">${details ? esc(details) : "&nbsp;"}</div>
    <div class="l-foot"><span>${esc(label.sku)}</span><span>₹${Number(label.sellingPrice).toFixed(2)}</span></div>
  </div>`;
}
/**
 * Full print-ready HTML sheet: an A4 page with a grid of labels (default
 * 24-up: 3 cols × 8 rows). Each label is a fixed 63.5 × 33.9 mm box so a
 * normal printer + the browser's print dialog produces a correctly-sized
 * physical label sheet. Inline SVG barcodes render in expo-print's WebView,
 * jsPDF's html2canvas, and every browser — no canvas needed.
 */
export function renderLabelSheetHtml(labels, opts = {}) {
    const copies = Math.max(1, Math.floor(opts.copies ?? 1));
    const cols = opts.cols ?? 3;
    const rows = opts.rows ?? 8;
    const pageWidthPx = opts.pageWidthPx ?? 794;
    // Copy the label list `copies` times, filling each page's grid.
    const perPage = cols * rows;
    const all = Array.from({ length: copies }, () => labels).flat();
    const pages = [];
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
  .l-shop { font-size: 7px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .l-name { font-size: 11px; font-weight: 700; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .l-barcode { display: flex; justify-content: center; margin-top: 1px; }
  .l-barcode svg { display: block; }
  .l-nocode { font-size: 9px; color: #999; padding: 6px 0; }
  .l-details { font-size: 8px; color: #444; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .l-foot { margin-top: auto; display: flex; justify-content: space-between; font-size: 8px; font-weight: 600; color: #111; }
</style>
</head>
<body>${pages.join("")}</body>
</html>`;
}
/** Plain-text version of a single label (copy/share fallback). */
export function renderLabelText(label) {
    const lines = [
        label.shopName,
        label.productName,
        `SKU: ${label.sku}`,
        label.barcode ? `Barcode: ${label.barcode}` : "",
        [label.color, label.size].filter(Boolean).join(" / "),
        label.weightMg != null ? `Weight: ${formatWeight(label.weightMg)}` : "",
        `Price: ₹${Number(label.sellingPrice).toFixed(2)}`,
    ].filter(Boolean);
    return lines.join("\n");
}
//# sourceMappingURL=labelDocument.js.map