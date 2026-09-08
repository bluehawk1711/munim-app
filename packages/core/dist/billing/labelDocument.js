import { barcodeSvg } from "../utils/barcode.js";
/** Builds a label from a product row (+ optional shop header). Pure + shared. */
export function buildProductLabel(product, shop) {
    return {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        barcode: product.barcode,
        productType: product.type ?? "Gold",
        weightMg: product.weight ?? null,
        weightUnit: product.weightUnit ?? "gm",
        grossWeight: product.grossWeight ?? null,
        nagLessWeight: product.nagLessWeight ?? null,
        chejatWeight: product.chejatWeight ?? null,
        netWeight: product.netWeight ?? null,
        purity: product.purity ?? null,
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
/** Renders ONE label's inner markup (shared by the sheet + previews).
 * Silver: LEFT = name + " - sil" + purity + weight, RIGHT = barcode
 * Gold:   LEFT = name + weight + 4 weight fields, RIGHT = barcode
 */
export function renderLabelMarkup(label) {
    const barcode = label.barcode ? barcodeSvg(label.barcode, { height: 50, scale: 2, fontSize: 8 }) : "";
    const weight = label.weightMg != null && label.weightMg > 0
        ? `${label.weightMg} ${label.weightUnit}`
        : "";
    const isGold = label.productType === "Gold";
    // Build display name
    let displayName = label.productName;
    if (!isGold) {
        displayName = `${displayName} - sil`;
    }
    const nameWithPurity = [displayName, label.purity?.trim() || null]
        .filter((v) => Boolean(v))
        .join(" ");
    // Auto-scale font size based on name length
    const nameLen = nameWithPurity.length;
    const nameFontSize = nameLen <= 10 ? 11 : nameLen <= 14 ? 10 : nameLen <= 18 ? 9 : 8;
    // Build weight details for Gold
    const weightFields = [];
    if (weight)
        weightFields.push(weight);
    if (label.grossWeight?.trim())
        weightFields.push(`G: ${label.grossWeight.trim()}`);
    if (label.nagLessWeight?.trim())
        weightFields.push(`N: ${label.nagLessWeight.trim()}`);
    if (label.chejatWeight?.trim())
        weightFields.push(`C: ${label.chejatWeight.trim()}`);
    if (label.netWeight?.trim())
        weightFields.push(`Net: ${label.netWeight.trim()}`);
    return `<div class="label">
    <div class="l-left">
      <div class="l-name" style="font-size:${nameFontSize}px">${esc(nameWithPurity)}</div>
      ${isGold
        ? `<div class="l-weight">${weightFields.map(wf => `<div>${esc(wf)}</div>`).join("")}</div>`
        : `<div class="l-weight">${weight ? esc(weight) : "&nbsp;"}</div>`}
    </div>
    <div class="l-right">${barcode || `<span class="l-nocode">NO BARCODE</span>`}</div>
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
    padding: 2mm 2mm;
    overflow: hidden;
    border: 1px dashed #ddd;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 2mm;
  }
  .label-empty { border: none; }
  .l-left { flex: 0 0 42%; display: flex; flex-direction: column; justify-content: space-between; height: 100%; min-width: 0; }
  .l-right { flex: 1; display: flex; align-items: center; justify-content: center; min-width: 0; }
  .l-right svg { display: block; max-width: 100%; height: auto; }
  .l-name { font-size: 11px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .l-nocode { font-size: 8px; color: #999; }
  .l-weight { font-size: 9px; font-weight: 600; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
</head>
<body>${pages.join("")}</body>
</html>`;
}
/** Plain-text version of a single label (copy/share fallback). */
export function renderLabelText(label) {
    const isGold = label.productType === "Gold";
    let displayName = label.productName;
    if (!isGold) {
        displayName = `${displayName} - sil`;
    }
    const nameWithPurity = [displayName, label.purity?.trim() || null]
        .filter((v) => Boolean(v))
        .join(" ");
    const weight = label.weightMg != null && label.weightMg > 0
        ? `${label.weightMg} ${label.weightUnit}`
        : "";
    const lines = [nameWithPurity];
    if (isGold) {
        if (weight)
            lines.push(weight);
        if (label.grossWeight?.trim())
            lines.push(`G: ${label.grossWeight.trim()}`);
        if (label.nagLessWeight?.trim())
            lines.push(`N: ${label.nagLessWeight.trim()}`);
        if (label.chejatWeight?.trim())
            lines.push(`C: ${label.chejatWeight.trim()}`);
        if (label.netWeight?.trim())
            lines.push(`Net: ${label.netWeight.trim()}`);
    }
    else {
        if (weight)
            lines.push(weight);
    }
    if (label.barcode)
        lines.push(`Barcode: ${label.barcode}`);
    return lines.join("\n");
}
//# sourceMappingURL=labelDocument.js.map