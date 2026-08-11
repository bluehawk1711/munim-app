import { jsPDF } from "jspdf";
import { renderJobLetterHtml } from "@munim/core";
import type { JobLetterData } from "@munim/core";

/**
 * Desktop job-letter PDF renderer.
 *
 * Renders the SAME shared HTML as the mobile app (`renderJobLetterHtml` from
 * `@munim/core`) through jsPDF's `html()` (html2canvas), so desktop and mobile
 * letters look identical — gold-bordered classic template, salary words from
 * core's numberToWords. One model, one markup; only the rasterizer differs.
 */
export async function downloadJobLetterPdf(data: JobLetterData): Promise<void> {
  // html2canvas measures text — make sure system fonts are ready first.
  await document.fonts.ready;

  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const pageWidth = doc.internal.pageSize.getWidth(); // 595.28pt for A4

  // Detached element: jsPDF's html() worker mounts it offscreen itself.
  const source = document.createElement("div");
  source.innerHTML = renderJobLetterHtml(data);

  await doc.html(source, {
    margin: [0, 0, 0, 0],
    autoPaging: "text",
    windowWidth: pageWidth,
    width: pageWidth,
  });

  const safeName = data.employeeName.trim().replace(/\s+/g, "_") || "letter";
  doc.save(`Job_Letter_${safeName}.pdf`);
}
