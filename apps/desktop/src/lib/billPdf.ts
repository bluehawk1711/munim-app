import { jsPDF } from "jspdf";
import { renderBillHtml } from "@munim/core";
import type { BillDocument } from "@munim/core";

/** Options mirroring the shared web billing form (bill-template-options). */
export type BillSheetOptions = {
  /** Second bill — used in 2-in-1 "distinct" (Separate) mode. */
  secondBill?: BillDocument;
  /** When true, both bills are stacked on one printable sheet. */
  twoInOne?: boolean;
  /** duplicate = same bill twice; distinct = first + second bill. */
  mode?: "duplicate" | "distinct";
  /** Classic accent color — draws a red/yellow strip on the sheet top. */
  classicColor?: "red" | "yellow";
};

/**
 * Desktop bill PDF renderer.
 *
 * Renders the SAME shared HTML as the mobile app (`renderBillHtml` from
 * `@munim/core`) through jsPDF's `html()` (html2canvas), so the desktop PDF
 * matches the mobile PDF line-for-line: same currency symbol, same color/size
 * variant rows, same totals and amount-in-words. One model, one markup —
 * only the rasterizer differs per platform.
 *
 * In 2-in-1 mode both bills render on a single A4 sheet (the first bill is
 * page 1, the second page 2), identical to the web app's combined PDF.
 */
export async function downloadBillPdf(bill: BillDocument, opts?: BillSheetOptions): Promise<void> {
  // html2canvas measures text — make sure system fonts are ready first.
  await document.fonts.ready;

  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const pageWidth = doc.internal.pageSize.getWidth(); // 595.28pt for A4

  // Detached element: jsPDF's html() worker mounts it offscreen itself.
  // (Element input skips dompurify — the markup is our own renderBillHtml.)
  const source = document.createElement("div");

  if (opts?.twoInOne) {
    const second = opts.mode === "distinct" && opts.secondBill ? opts.secondBill : bill;
    const accent =
      opts.classicColor === "yellow"
        ? "#eab308"
        : opts.classicColor === "red"
          ? "#dc2626"
          : "transparent";
    source.innerHTML = `<div style="margin:0;padding:0">${accent !== "transparent" ? `<div style="height:10px;background:${accent}"></div>` : ""}${renderBillHtml(bill)}<div style="page-break-after:always"></div>${renderBillHtml(second)}</div>`;
  } else {
    source.innerHTML = renderBillHtml(bill);
  }

  await doc.html(source, {
    margin: [0, 0, 0, 0],
    autoPaging: "text",
    windowWidth: pageWidth,
    width: pageWidth,
  });

  doc.save(`${bill.billNo}.pdf`);
}
