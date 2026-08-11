import { jsPDF } from "jspdf";
import { renderBillHtml } from "@munim/core";
import type { BillDocument } from "@munim/core";

/**
 * Desktop bill PDF renderer.
 *
 * Renders the SAME shared HTML as the mobile app (`renderBillHtml` from
 * `@munim/core`) through jsPDF's `html()` (html2canvas), so the desktop PDF
 * matches the mobile PDF line-for-line: same currency symbol, same color/size
 * variant rows, same totals and amount-in-words. One model, one markup —
 * only the rasterizer differs per platform.
 */
export async function downloadBillPdf(bill: BillDocument): Promise<void> {
  // html2canvas measures text — make sure system fonts are ready first.
  await document.fonts.ready;

  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const pageWidth = doc.internal.pageSize.getWidth(); // 595.28pt for A4

  // Detached element: jsPDF's html() worker mounts it offscreen itself.
  // (Element input skips dompurify — the markup is our own renderBillHtml.)
  const source = document.createElement("div");
  source.innerHTML = renderBillHtml(bill);

  await doc.html(source, {
    margin: [0, 0, 0, 0],
    autoPaging: "text",
    windowWidth: pageWidth,
    width: pageWidth,
  });

  doc.save(`${bill.billNo}.pdf`);
}
