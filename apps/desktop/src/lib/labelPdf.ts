import { jsPDF } from "jspdf";
import { rasterizeInlineSvgs } from "@munim/ui";

/**
 * Desktop product-label renderers — thin platform layer on the SHARED
 * `renderLabelSheetHtml` from @munim/core (identical to web + mobile).
 *
 * - `downloadLabelPdf(html)` — jsPDF `html()` (html2canvas): the sheet is
 *   sized in px (794px ≈ 210mm) so 24 labels land at their true physical
 *   size (63.5 × 33.9 mm) on one A4 page. Inline SVGs are rasterized to PNG
 *   data URIs first because html2canvas cannot load inline `<svg>` elements.
 * - `printLabelHtml(html)` — opens the sheet in a fresh window and calls
 *   window.print() (WebView2 on Windows shows the native print dialog).
 */
export async function downloadLabelPdf(html: string): Promise<void> {
  await document.fonts.ready;
  // html2canvas can't load inline SVG — rasterize barcodes to PNG first so
  // the PDF matches the preview instead of printing blank bars.
  const rasterized = await rasterizeInlineSvgs(html);
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const source = document.createElement("div");
  source.innerHTML = rasterized;
  await doc.html(source, {
    margin: 0,
    autoPaging: "slice",
    windowWidth: 794,
    width: pageWidth,
  });
  doc.save("product-labels.pdf");
}

export function printLabelHtml(html: string): void {
  const win = window.open("", "_blank", "width=900,height=1200");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}
