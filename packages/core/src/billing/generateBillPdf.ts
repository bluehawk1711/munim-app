import { jsPDF } from "jspdf";
import { formatCurrency } from "../utils/format.js";
import {
  billKindLabel,
  estimateChargeLines,
  estimateChargesTotal,
  estimateLabourTag,
  estimateNetWeightTotal,
  estimateRowHeightMm,
  estimateRowOf,
  estimateRowStackLines,
  estimateTotalsHeightMm,
  estimateWeightLayout,
  estimateWeightLines,
  materialReturnedTitleOf,
  netWeightCellOf,
  purityCellOf,
  rateRowsOf,
  receiptLabelOf,
} from "./billDocument.js";
import type {
  BillDocument,
  BillLine,
  BillTemplateSettings,
  EstimateColumnId,
} from "./billDocument.js";
import { BILL_FONT_BOLD_B64, BILL_FONT_ITALIC_B64, BILL_FONT_REGULAR_B64 } from "./billFonts.js";
import { BILL_SEAL_DATA_URI, BILL_SEAL_HEIGHT, BILL_SEAL_WIDTH } from "./billSeal.js";
import { classicColors, ecommerceColors, type ClassicTheme } from "./billTheme.js";

export type { BillTemplateSettings } from "./billDocument.js";

/**
 * Signature stamp (seal.png, transparent PNG) — mm widths per
 * template. The stamp carries its own "For M/s. …" header, signature gap and
 * "PROPRIETOR" label; the sign line is drawn INSIDE the gap at 40%..98.5%
 * width, 63.6% height of the image box (new 894x294 stamp: PROPRIETOR sits
 * at 72%..92.5%, so the line must stay above it).
 */
const CLASSIC_SEAL_W = 46;
const ECOM_SEAL_W = 36;
const SEAL_ASPECT = BILL_SEAL_HEIGHT / BILL_SEAL_WIDTH;

/**
 * Money/rate texts tighten tracking slightly (per review: price cells looked
 * too spread out) — in mm per character at the current font size.
 */
const MONEY_CHAR_SPACE = -0.3;

/**
 * Fonts registered per doc so the ₹ sign prints (Helvetica has no glyph) —
 * regular/bold/italic all come from the embedded Noto Sans so the PDF looks
 * the same in every viewer and matches the mobile HTML renderer's @font-face.
 */
function registerBillFonts(doc: jsPDF): void {
  if (doc.getFontList().notosans !== undefined) return;
  doc.addFileToVFS("MunimSans-Regular.ttf", BILL_FONT_REGULAR_B64);
  doc.addFont("MunimSans-Regular.ttf", "notosans", "normal");
  doc.addFileToVFS("MunimSans-Bold.ttf", BILL_FONT_BOLD_B64);
  doc.addFont("MunimSans-Bold.ttf", "notosans", "bold");
  doc.addFileToVFS("MunimSans-Italic.ttf", BILL_FONT_ITALIC_B64);
  doc.addFont("MunimSans-Italic.ttf", "notosans", "italic");
}

/**
 * Draws a money/rate text with the embedded Noto Sans (so ₹ renders) and
 * the tightened price tracking. Font size/colour stay as the caller set them.
 */
function money(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  align: "left" | "center" | "right" = "left",
  bold = false,
): void {
  doc.setFont("notosans", bold ? "bold" : "normal");
  doc.text(text, x, y, { align, charSpace: MONEY_CHAR_SPACE });
}

/** "24.5g" / "24500mg" — WEIGHT column display (dash when no snapshot). */
function weightText(item: BillLine): string {
  if (item.weight == null) return "-";
  return `${item.weight}${item.weightUnit === "mg" ? "mg" : "g"}`;
}

/**
 * Content height for the e-commerce (ESTIMATE) template (mm, relative to
 * yOffset) — mirrors drawEcommerceBill's fixed layout so the frame hugs the
 * content instead of stretching to the page bottom.
 */
function measureEcommerceBillHeight(
  doc: jsPDF,
  bill: BillDocument,
  contentWidth: number,
  settings: BillTemplateSettings,
): number {
  // Letterhead (3..18) + header box (21..47) + gap + table header (51..58).
  // Row/totals heights come from the SAME shared helpers the draw pass uses,
  // gated on the same column visibility — the sheet frame hugs the real
  // table even with itemized stacks or columns toggled off.
  const split = estimateWeightLayout(bill) === "split";
  const hidden = new Set<EstimateColumnId>(
    split ? (settings.hiddenColumns?.gold ?? []) : (settings.hiddenColumns?.silver ?? []),
  );
  const visible = {
    chejatNag: split && !hidden.has("chejatNag"),
    otherCharges: !hidden.has("otherCharges"),
  };
  const descOn = !hidden.has("description");
  let tableY = 58;
  for (const line of bill.lines) {
    tableY += estimateRowHeightMm(
      descOn && !!line.description,
      estimateRowStackLines(line, visible),
    );
  }
  // Merged Chejat/Nag totals cell stacks its prefixed sums → taller row.
  let totalsStack = 0;
  if (visible.chejatNag) {
    if (bill.lines.some((l) => l.chejatWeight != null && l.chejatWeight > 0)) totalsStack += 1;
    if (bill.lines.some((l) => l.nagLessWeight != null && l.nagLessWeight > 0)) totalsStack += 1;
  }
  const tableEnd = tableY + estimateTotalsHeightMm(totalsStack);
  // Right-aligned adjustments: Closing Balance always; others when present.
  let adjRows = 1;
  if (bill.discount > 0) adjRows += 1;
  if (bill.materialReturnedValue > 0) adjRows += 1;
  if (bill.deliveryCharge > 0) adjRows += 1;
  if (bill.amountPaid > 0) adjRows += 1;
  const adjEnd = tableEnd + 8 + adjRows * 6;
  const wordsY = adjEnd + 5;
  doc.setFont("notosans", "italic");
  const wordsLines = doc.splitTextToSize(`Rs.${bill.amountInWords}`, contentWidth - 20).length;
  const contentEnd = Math.max(adjEnd, wordsY + wordsLines * 3.6);
  // Footer zone: separator + thank-you + email + padding (24) plus the
  // signature stamp centered above the separator (seal height + 2mm margin).
  return contentEnd + 24 + ECOM_SEAL_W * SEAL_ASPECT + 2;
}

/**
 * Content height for the classic jewellery template (mm, relative to yOffset)
 * — mirrors drawClassicJewelleryBill up to the signature block.
 */
function measureClassicBillHeight(
  doc: jsPDF,
  bill: BillDocument,
  settings: BillTemplateSettings,
): number {
  // Rate rows sit below the date and push the customer block down.
  const customerY = 62 + rateRowsOf(bill, settings).length * 5; // detailsY (52) + 10
  const tableHeaderY = customerY + (bill.customerPhone ? 22 : 16);
  let itemY = tableHeaderY + 10;
  for (const line of bill.lines) itemY += line.description ? 14 : 12;
  let totalY = itemY + 6;
  if (bill.deliveryCharge > 0 || bill.discount > 0 || bill.materialReturnedValue > 0) {
    totalY += 6; // subtotal row
    if (bill.deliveryCharge > 0) totalY += 6;
    if (bill.discount > 0) totalY += 6;
    if (bill.materialReturnedValue > 0) totalY += 6;
  }
  // Words sit under the GRAND TOTAL box, wrapped to the box width (72mm).
  const wordsY = totalY + 16;
  doc.setFont("notosans", "italic");
  const wordsLines = doc.splitTextToSize(bill.amountInWords, 72).length;
  const contentEnd = Math.max(totalY + 12, wordsY + wordsLines * 3.6);
  return contentEnd + 30; // gap + signature block (signatureY = height - 20)
}

/**
 * Shared bill/invoice PDF renderer — the single source of truth used by BOTH
 * web and desktop. Renders the `BillDocument` (built by `buildBillDocument`
 * from core) into a rich jsPDF PDF with two presentation templates (Classic
 * Jewellery / Modern E-commerce) plus 2-in-1 (duplicate / distinct) layout.
 */
export function generateBillPDF(
  bill: BillDocument,
  settings: BillTemplateSettings,
  secondBill?: BillDocument,
): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });
  registerBillFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 8;

  const drawBill = (yOffset: number, billDoc: BillDocument) => {
    const isEcommerce = settings.template === "ecommerce";
    const contentWidth = pageWidth - 2 * margin;
    // Content-based height: hug the drawn content, clamped to this bill's
    // page slot (halves in 2-in-1) so a short bill no longer stretches to
    // the page bottom and a long bill never bleeds into its neighbour.
    const slotMax =
      settings.twoInOne && yOffset < pageHeight / 2
        ? pageHeight / 2 - yOffset
        : pageHeight - margin - yOffset;
    const contentH = isEcommerce
      ? measureEcommerceBillHeight(doc, billDoc, contentWidth, settings)
      : measureClassicBillHeight(doc, billDoc, settings);
    const billHeight = Math.min(slotMax, Math.max(60, contentH));

    if (isEcommerce) {
      drawEcommerceBill(doc, yOffset, billDoc, billHeight, pageWidth, margin, contentWidth, settings);
    } else {
      const colorTheme = classicColors[settings.classicColor];
      drawClassicJewelleryBill(
        doc,
        yOffset,
        billDoc,
        billHeight,
        pageWidth,
        margin,
        contentWidth,
        colorTheme,
        settings,
      );
    }
  };

  if (settings.twoInOne) {
    drawBill(margin, bill);
    drawBill(
      pageHeight / 2 + 4,
      settings.mode === "distinct" && secondBill ? secondBill : bill,
    );
  } else {
    drawBill(margin, bill);
  }

  doc.save(`Bill_${bill.billNo}.pdf`);
}

function drawEcommerceBill(
  doc: jsPDF,
  yOffset: number,
  bill: BillDocument,
  billHeight: number,
  pageWidth: number,
  margin: number,
  contentWidth: number,
  settings: BillTemplateSettings,
): void {
  const colors = ecommerceColors;

  // Outer border with gold accent
  doc.setDrawColor(colors.gold[0], colors.gold[1], colors.gold[2]);
  doc.setLineWidth(1.5);
  doc.rect(margin, yOffset, contentWidth, billHeight);

  // Inner subtle border
  doc.setDrawColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2]);
  doc.setLineWidth(0.3);
  doc.rect(margin + 2, yOffset + 2, contentWidth - 4, billHeight - 4);

  // ── ESTIMATE letterhead ───────────────────────────────────────────────
  const x0 = margin + 5;
  const tableW = contentWidth - 10;
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFont("notosans", "bold");
  doc.setFontSize(13);
  doc.text(bill.shop.name, pageWidth / 2, yOffset + 9, { align: "center" });
  doc.setFont("notosans", "normal");
  doc.setFontSize(7);
  doc.setTextColor(colors.mediumGray[0], colors.mediumGray[1], colors.mediumGray[2]);
  const contactBits = [
    bill.shop.address ?? "",
    bill.shop.phones.length ? `Tel: ${bill.shop.phones.join(" | ")}` : "",
  ].filter(Boolean);
  if (contactBits.length) {
    // ASCII separator only: the embedded bill font is a glyph subset without
    // "·", and jsPDF silently DROPS the rest of a string at an unknown glyph
    // (the shop phone vanished after the old "  ·  " separator).
    doc.text(contactBits.join("  -  "), pageWidth / 2, yOffset + 13.5, { align: "center" });
  }
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFont("notosans", "bold");
  doc.setFontSize(10.5);
  doc.text("ESTIMATE", pageWidth / 2, yOffset + 19.5, { align: "center", charSpace: 2 });

  // ── Customer / Vou.No. header box (estimate sheet style) ──────────────
  const boxTop = yOffset + 21;
  const boxH = 26;
  doc.setDrawColor(colors.mediumGray[0], colors.mediumGray[1], colors.mediumGray[2]);
  doc.setLineWidth(0.4);
  doc.rect(x0, boxTop, tableW, boxH);
  doc.line(x0 + 108, boxTop, x0 + 108, boxTop + boxH);

  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFont("notosans", "bold");
  doc.setFontSize(7.5);
  doc.text("Customer Name & Address :", x0 + 3, boxTop + 5);
  doc.setLineWidth(0.2);
  doc.line(x0 + 3, boxTop + 6.5, x0 + 44, boxTop + 6.5);
  doc.setFontSize(9);
  doc.text(bill.customerName || "-", x0 + 3, boxTop + 13);
  doc.setFont("notosans", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(colors.mediumGray[0], colors.mediumGray[1], colors.mediumGray[2]);
  if (bill.customerAddress) doc.text(bill.customerAddress, x0 + 3, boxTop + 18);
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFont("notosans", "bold");
  doc.text("Ph #", x0 + 3, boxTop + 23);
  doc.setFont("notosans", "normal");
  doc.setTextColor(colors.mediumGray[0], colors.mediumGray[1], colors.mediumGray[2]);
  if (bill.customerPhone) doc.text(bill.customerPhone, x0 + 15, boxTop + 23);

  doc.setFont("notosans", "bold");
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFontSize(8);
  doc.text(`Vou.No.: ${bill.billNo}`, x0 + 111, boxTop + 5);
  doc.setFont("notosans", "normal");
  doc.text(`Date : ${bill.date}`, x0 + 111, boxTop + 11);
  rateRowsOf(bill, settings).forEach((row, i) => {
    doc.setFontSize(7);
    doc.setTextColor(colors.gold[0], colors.gold[1], colors.gold[2]);
    // Starts at +15 so a gold bill's rate (with its "24K" suffix) + a silver
    // rate row (mixed-metal bills) all fit inside the 26mm header box.
    money(doc, row, x0 + tableW - 3, boxTop + 15 + i * 4.5, "right", true);
  });

  // ── Estimate items table (client's column order, per-bill toggles) ─────
  // Gold bills: Description | Purity | G. Wt. | Chejat/Nag | Rate ₹/gm |
  // Labour | Other Charges | Amount. The Chejat/Nag column MERGES the two
  // gold net-weight derivation inputs (net = gross − nag + chejat) into one
  // cell, itemized with prefixes exactly like Other Charges
  // ("Chejat: 0.150" / "Nag: 0.620"). Silver-only bills show ONE combined
  // Weight column instead (gross/nag/chejat are gold-only at this shop).
  // Columns the operator switched off on the New Bill screen
  // (settings.hiddenColumns) are dropped and the freed width goes to
  // Description (else the last visible column), so the grid always spans the
  // full tableW. Cells print the frozen values ITEMIZED with their prefixes —
  // never summed on a line; the totals row adds them once.
  const tableTop = yOffset + 51;
  const split = estimateWeightLayout(bill) === "split";
  // Per-metal column toggles: the gold grid and silver grid keep their own
  // hidden list (their field sets differ).
  const hidden = new Set<EstimateColumnId>(
    split ? (settings.hiddenColumns?.gold ?? []) : (settings.hiddenColumns?.silver ?? []),
  );
  type EstCol = { id: EstimateColumnId; w: number; header: string };
  const baseCols: EstCol[] = split
    ? [
        // Widths sum to tableW (184mm) so the grid spans the sheet exactly —
        // the new N. Wt. column was carved out of the neighbours.
        { id: "description", w: 36, header: "Description" },
        { id: "purity", w: 11, header: "Remark" },
        { id: "weight", w: 12, header: "G. Wt." },
        { id: "netWeight", w: 12, header: "N. Wt." },
        { id: "chejatNag", w: 22, header: "Chejat/Nag" },
        { id: "rate", w: 15, header: "Rate ₹/gm" },
        { id: "labour", w: 22, header: "Labour" },
        { id: "otherCharges", w: 27, header: "Other Charges" },
        { id: "amount", w: 27, header: "Amount (Rupees)" },
      ]
    : [
        { id: "description", w: 50, header: "Description" },
        { id: "purity", w: 14, header: "Remark" },
        { id: "weight", w: 17, header: "Weight" },
        { id: "rate", w: 17, header: "Rate ₹/gm" },
        { id: "labour", w: 28, header: "Labour" },
        { id: "otherCharges", w: 31, header: "Other Charges" },
        { id: "amount", w: 27, header: "Amount (Rupees)" },
      ];
  // Never render an empty grid: everything switched off → full layout.
  let cols = baseCols.filter((c) => !hidden.has(c.id));
  if (cols.length === 0) cols = baseCols;
  const slack = tableW - cols.reduce((sum, c) => sum + c.w, 0);
  if (slack !== 0) {
    const iAbsorb = cols.findIndex((c) => c.id === "description");
    const j = iAbsorb >= 0 ? iAbsorb : cols.length - 1;
    cols = cols.map((c, i) => (i === j ? { ...c, w: c.w + slack } : c));
  }
  const colW = cols.map((c) => c.w);
  const headers = cols.map((c) => c.header);
  const colX: number[] = [];
  {
    let acc = x0;
    for (const w of colW) {
      colX.push(acc);
      acc += w;
    }
  }
  // -1 = column hidden (cells for hidden columns are skipped).
  const iDesc = cols.findIndex((c) => c.id === "description");
  const iPurity = cols.findIndex((c) => c.id === "purity");
  const iWeight = cols.findIndex((c) => c.id === "weight");
  const iNetWeight = cols.findIndex((c) => c.id === "netWeight");
  const iChejatNag = cols.findIndex((c) => c.id === "chejatNag");
  const iRate = cols.findIndex((c) => c.id === "rate");
  const iLabour = cols.findIndex((c) => c.id === "labour");
  const iOtherCharges = cols.findIndex((c) => c.id === "otherCharges");
  const iAmount = cols.findIndex((c) => c.id === "amount");
  const lastCol = colW.length - 1;
  const gray = colors.mediumGray;
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFont("notosans", "bold");
  doc.setFontSize(7.5);
  headers.forEach((h, c) => {
    // Shrink headers ("Amount (Rupees)", "Chejat Wt.") to stay on one line.
    let fs = 7.5;
    doc.setFontSize(fs);
    const avail = (colW[c] ?? 0) - (c === 0 || c === lastCol ? 4 : 2);
    while (fs > 5.5 && doc.getTextWidth(h) > avail) {
      fs -= 0.5;
      doc.setFontSize(fs);
    }
    if (c === 0) doc.text(h, colX[0]! + 2, tableTop + 4.7);
    else if (c === lastCol) doc.text(h, colX[lastCol]! + colW[lastCol]! - 2, tableTop + 4.7, { align: "right" });
    else doc.text(h, colX[c]! + colW[c]! / 2, tableTop + 4.7, { align: "center" });
  });
  doc.setFontSize(8);

  const estNum = (v: number, dp: number): string => v.toFixed(dp);
  /** Purity / chejat / nag cells: centered text or "-" when empty. */
  const cellText = (v: string | null): string => v ?? "-";
  const rowTops: number[] = [];
  let itemY = tableTop + 7;

  bill.lines.forEach((item) => {
    rowTops.push(itemY);
    const est = estimateRowOf(item);
    // Itemized stacks — Other Charges ("Nag: 500.00" …) and the merged
    // Chejat/Nag cell ("Chejat: 0.150" …) — grow the row 3.6mm per extra
    // line (gated on the columns actually being visible) so nothing overlaps.
    const chargeLines = estimateChargeLines(est.charges);
    const weightLines = estimateWeightLines(item, settings.signSuffix);
    const stackN = estimateRowStackLines(item, {
      chejatNag: iChejatNag >= 0,
      otherCharges: iOtherCharges >= 0,
    });
    const rowH = estimateRowHeightMm(iDesc >= 0 && !!item.description, stackN);
    const baseY = itemY + 4.5;
    doc.setFont("notosans", "normal");
    doc.setFontSize(8);
    doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
    if (iDesc >= 0) {
      // Description: the plain product name (purity moved to its own column),
      // with the optional description under it. Shrink the font when the name
      // would cross the next column's border.
      const label = item.productName;
      let nameSize = 8.5;
      doc.setFont("notosans", "bold");
      doc.setFontSize(nameSize);
      const availW = colW[iDesc]! - 4;
      while (nameSize > 6.5 && doc.getTextWidth(label) > availW) {
        nameSize -= 0.5;
        doc.setFontSize(nameSize);
      }
      doc.text(label, colX[iDesc]! + 2, itemY + 4);
      if (item.description) {
        doc.setFont("notosans", "italic");
        doc.setFontSize(6.5);
        doc.setTextColor(gray[0], gray[1], gray[2]);
        doc.text(item.description, colX[iDesc]! + 2, itemY + 8.3);
      }
      doc.setFont("notosans", "normal");
      doc.setFontSize(8);
      doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
    }
    // Purity column (both layouts).
    if (iPurity >= 0)
      doc.text(cellText(purityCellOf(item)), colX[iPurity]! + colW[iPurity]! / 2, baseY, { align: "center" });
    if (iWeight >= 0) {
      if (split) {
        // Gold: G. Wt. (free-text gross).
        doc.text(item.grossWeight?.trim() || "-", colX[iWeight]! + colW[iWeight]! / 2, baseY, { align: "center" });
      } else {
        // Silver-only bills: ONE combined Weight column (the priced weight,
        // falling back to the gross text when no weight snapshot was frozen).
        const combined = item.weight != null ? estNum(item.weight, 3) : (item.grossWeight?.trim() || "-");
        doc.text(combined, colX[iWeight]! + colW[iWeight]! / 2, baseY, { align: "center" });
      }
    }
    // N. Wt. — net = gross − nag + chejat (shared derivation, gold grid only).
    if (iNetWeight >= 0) {
      doc.text(cellText(netWeightCellOf(item)), colX[iNetWeight]! + colW[iNetWeight]! / 2, baseY, { align: "center" });
    }
    // Merged Chejat/Nag cell — itemized prefixes, exactly like Other Charges.
    if (iChejatNag >= 0) {
      const cnX = colX[iChejatNag]! + colW[iChejatNag]! - 2;
      doc.setFontSize(7.5);
      weightLines.forEach((wl, wi) => {
        doc.text(wl, cnX, baseY + 3.6 * wi, { align: "right" });
      });
      if (weightLines.length === 0) doc.text("-", cnX, baseY, { align: "right" });
      doc.setFontSize(8);
    }
    if (iRate >= 0) doc.text(estNum(est.rate, 2), colX[iRate]! + colW[iRate]! - 2, baseY, { align: "right" });
    // Labour ₹ + method tag — "(fixed)" / "(11.82/gm)" / "(2.5%)" — shrunk
    // so a tagged amount still stays inside its column rules.
    if (iLabour >= 0) {
      const labourText = est.labour != null ? `${estNum(est.labour, 2)}${estimateLabourTag(item)}` : "-";
      let labourSize = 8;
      doc.setFontSize(labourSize);
      while (labourSize > 6 && doc.getTextWidth(labourText) > (colW[iLabour] ?? 0) - 2) {
        labourSize -= 0.5;
        doc.setFontSize(labourSize);
      }
      doc.text(labourText, colX[iLabour]! + colW[iLabour]! - 2, baseY, { align: "right" });
      doc.setFontSize(8);
    }
    // Other Charges: one "Prefix: 0.00" line per frozen charge (never summed).
    if (iOtherCharges >= 0) {
      const chargeX = colX[iOtherCharges]! + colW[iOtherCharges]! - 2;
      doc.setFontSize(7.5);
      chargeLines.forEach((cl, ci) => {
        doc.text(cl, chargeX, baseY + 3.6 * ci, { align: "right" });
      });
      if (chargeLines.length === 0) doc.text("-", chargeX, baseY, { align: "right" });
      doc.setFontSize(8);
    }
    if (iAmount >= 0) {
      doc.setFont("notosans", "bold");
      doc.text(estNum(item.total, 2), colX[iAmount]! + colW[iAmount]! - 2, baseY, { align: "right" });
      doc.setFont("notosans", "normal");
    }
    itemY += rowH;
  });

  // ── Column totals row (weights · labour · charges · amount) ─────────────
  const grossVals = bill.lines.map((l) => parseFloat(l.grossWeight ?? ""));
  const hasGross = grossVals.some((v) => !Number.isNaN(v));
  const sumGross = grossVals.reduce((s, v) => s + (Number.isNaN(v) ? 0 : v), 0);
  const sumWeight = bill.lines.reduce((s, l) => s + (l.weight ?? 0), 0);
  const sumChejat = bill.lines.reduce((s, l) => s + (l.chejatWeight ?? 0), 0);
  const hasChejat = bill.lines.some((l) => l.chejatWeight != null && l.chejatWeight > 0);
  const sumNag = bill.lines.reduce((s, l) => s + (l.nagLessWeight ?? 0), 0);
  const hasNag = bill.lines.some((l) => l.nagLessWeight != null && l.nagLessWeight > 0);
  const labours = bill.lines.map((l) => estimateRowOf(l).labour);
  const hasLabour = labours.some((v) => v != null);
  const sumLabour = labours.reduce<number>((s, v) => s + (v ?? 0), 0);
  // Totals row is the ONE place the itemized charges are summed.
  const chargeTotals = bill.lines.map((l) => estimateChargesTotal(estimateRowOf(l).charges));
  const hasOtherCharges = chargeTotals.some((v) => v > 0);
  const sumOtherCharges = chargeTotals.reduce((s, v) => s + v, 0);
  // Merged Chejat/Nag totals cell stacks its prefixed sums (like row cells).
  const cnTotals: string[] = [];
  if (split && iChejatNag >= 0 && hasChejat) cnTotals.push(`Chejat: ${estNum(sumChejat, 3)}${settings.signSuffix ? " +" : ""}`);
  if (split && iChejatNag >= 0 && hasNag) cnTotals.push(`Nag: ${estNum(sumNag, 3)}${settings.signSuffix ? " -" : ""}`);
  const sumNet = split && iNetWeight >= 0 ? estimateNetWeightTotal(bill.lines) : null;
  const totalsTop = itemY;

  doc.setFont("notosans", "bold");
  doc.setFontSize(8);
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  if (iWeight >= 0) {
    if (split) {
      doc.text(hasGross ? estNum(sumGross, 3) : "-", colX[iWeight]! + colW[iWeight]! / 2, totalsTop + 4.5, { align: "center" });
    } else {
      doc.text(estNum(sumWeight, 3), colX[iWeight]! + colW[iWeight]! / 2, totalsTop + 4.5, { align: "center" });
    }
  }
  if (iNetWeight >= 0) {
    doc.text(sumNet != null ? estNum(sumNet, 3) : "-", colX[iNetWeight]! + colW[iNetWeight]! / 2, totalsTop + 4.5, { align: "center" });
  }
  if (iChejatNag >= 0) {
    const cnX = colX[iChejatNag]! + colW[iChejatNag]! - 2;
    doc.setFontSize(7.5);
    cnTotals.forEach((t, ti) => {
      doc.text(t, cnX, totalsTop + 4.5 + 3.6 * ti, { align: "right" });
    });
    if (cnTotals.length === 0) doc.text("-", cnX, totalsTop + 4.5, { align: "right" });
    doc.setFontSize(8);
  }
  if (iLabour >= 0) doc.text(hasLabour ? estNum(sumLabour, 2) : "-", colX[iLabour]! + colW[iLabour]! - 2, totalsTop + 4.5, { align: "right" });
  if (iOtherCharges >= 0) doc.text(hasOtherCharges ? estNum(sumOtherCharges, 2) : "-", colX[iOtherCharges]! + colW[iOtherCharges]! - 2, totalsTop + 4.5, { align: "right" });
  if (iAmount >= 0) doc.text(estNum(bill.subtotal, 2), colX[iAmount]! + colW[iAmount]! - 2, totalsTop + 4.5, { align: "right" });
  const tableEnd = totalsTop + estimateTotalsHeightMm(cnTotals.length);

  // Full grid over the table.
  doc.setDrawColor(gray[0], gray[1], gray[2]);
  doc.setLineWidth(0.3);
  doc.rect(x0, tableTop, tableW, tableEnd - tableTop);
  doc.line(x0, tableTop + 7, x0 + tableW, tableTop + 7);
  for (const top of rowTops) doc.line(x0, top, x0 + tableW, top);
  doc.line(x0, totalsTop, x0 + tableW, totalsTop);
  for (let c = 1; c < colW.length; c += 1) doc.line(colX[c]!, tableTop, colX[c]!, tableEnd);

  // ── Adjustments block (estimate style: LESS / RECEIPT CASH / CLOSING) ─
  const deliveryCharge = bill.deliveryCharge;
  const discount = bill.discount;

  const valX = x0 + tableW - 2;
  let adjY = tableEnd + 8;
  doc.setFont("notosans", "normal");
  doc.setFontSize(8);
  doc.setTextColor(colors.mediumGray[0], colors.mediumGray[1], colors.mediumGray[2]);
  const adjRow = (label: string, value: string, bold = false) => {
    doc.setFont("notosans", bold ? "bold" : "normal");
    // Right-align the label to the value column so long custom titles
    // (up to 60 chars) never run into the amount.
    doc.text(label, valX - doc.getTextWidth(value) - 4, adjY, { align: "right" });
    doc.text(value, valX, adjY, { align: "right" });
    adjY += 6;
  };
  if (discount > 0) adjRow("LESS:", `- ${estNum(discount, 2)}`);
  if (bill.materialReturnedValue > 0) {
    const matLabel = `${materialReturnedTitleOf(bill)}${
      bill.materialReturnedWeight ? ` (${bill.materialReturnedWeight})` : ""
    }`;
    adjRow(`${matLabel}:`, `- ${estNum(bill.materialReturnedValue, 2)}`);
  }
  if (deliveryCharge > 0) adjRow("Delivery:", `+ ${estNum(deliveryCharge, 2)}`);
  if (bill.amountPaid > 0) adjRow(receiptLabelOf(bill), `- ${estNum(bill.amountPaid, 2)}`);
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  adjRow("Closing Balance:", bill.dueAmount > 0 ? estNum(bill.dueAmount, 2) : "NIL", true);

  // Amount in words — right-aligned directly under the adjustments block so
  // the price-in-words sits with the prices it describes (review: "place the
  // text price more correctly"), directly above the seal.
  const wordsY = adjY + 5;
  doc.setTextColor(colors.mediumGray[0], colors.mediumGray[1], colors.mediumGray[2]);
  doc.setFontSize(6.5);
  doc.setFont("notosans", "italic");
  // amountInWords already ends with "Only" — just prefix Rs.
  const words = doc.splitTextToSize(`Rs.${bill.amountInWords}`, contentWidth - 20) as string[];
  doc.text(words, valX, wordsY, { align: "right" });

  // Footer
  const footerY = yOffset + billHeight - 12;
  doc.setDrawColor(colors.gold[0], colors.gold[1], colors.gold[2]);
  doc.setLineWidth(0.3);
  doc.line(margin + 10, footerY - 3, pageWidth - margin - 10, footerY - 3);

  doc.setTextColor(colors.mediumGray[0], colors.mediumGray[1], colors.mediumGray[2]);
  doc.setFontSize(8);
  doc.setFont("notosans", "italic");
  doc.text("Thank you for your business!", pageWidth / 2, footerY + 2, {
    align: "center",
  });

  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFontSize(7);
  doc.setFont("notosans", "normal");
  doc.text(bill.shop.email ?? "", pageWidth / 2, footerY + 6, {
    align: "center",
  });

  // Signature stamp (seal.png) — right-aligned above the footer separator
  // (matching Classic's placement), with the sign line drawn inside the
  // stamp's blank signature gap (as Classic does).
  const sealW = ECOM_SEAL_W;
  const sealH = sealW * SEAL_ASPECT;
  const sealX = pageWidth - margin - 10 - sealW;
  const sealY = yOffset + billHeight - 15 - 2 - sealH;
  doc.addImage(BILL_SEAL_DATA_URI, "PNG", sealX, sealY, sealW, sealH);
  const signLineY = sealY + 0.636 * sealH;
  doc.setDrawColor(colors.text[0], colors.text[1], colors.text[2]);
  doc.setLineWidth(0.3);
  doc.line(sealX + 0.4 * sealW, signLineY, sealX + 0.985 * sealW, signLineY);
}

function drawClassicJewelleryBill(
  doc: jsPDF,
  yOffset: number,
  bill: BillDocument,
  billHeight: number,
  pageWidth: number,
  margin: number,
  contentWidth: number,
  colorTheme: ClassicTheme,
  settings: BillTemplateSettings,
): void {
  const { primary, secondary, accent, dark } = colorTheme;

  // Watermark (subtle) - Draw first so it appears in background
  doc.setTextColor(245, 245, 245);
  doc.setFontSize(50);
  doc.setFont("notosans", "bold");
  doc.text("JW", pageWidth / 2, yOffset + billHeight / 2 + 10, {
    align: "center",
  });

  // Decorative double border
  doc.setDrawColor(primary[0], primary[1], primary[2]);
  doc.setLineWidth(1);
  doc.rect(margin, yOffset, contentWidth, billHeight);

  doc.setDrawColor(accent[0], accent[1], accent[2]);
  doc.setLineWidth(0.3);
  doc.rect(margin + 2, yOffset + 2, contentWidth - 4, billHeight - 4);

  // Corner decorations
  drawCornerDecoration(doc, margin + 4, yOffset + 4, primary);
  drawCornerDecoration(doc, pageWidth - margin - 4, yOffset + 4, primary, true);
  drawCornerDecoration(doc, margin + 4, yOffset + billHeight - 4, primary, false, true);
  drawCornerDecoration(doc, pageWidth - margin - 4, yOffset + billHeight - 4, primary, true, true);

  // Phone at top-left corner (per review: the right-side second Ph was unused)
  doc.setTextColor(dark[0], dark[1], dark[2]);
  doc.setFontSize(9);
  doc.setFont("notosans", "bold");
  doc.text("Ph: " + (bill.shop.phones[0] ?? ""), margin + 12, yOffset + 12);

  // Blessing text
  doc.setTextColor(primary[0], primary[1], primary[2]);
  doc.setFontSize(9);
  doc.setFont("notosans", "italic");
  doc.text("|| JAI SHREE SHYAM ||", pageWidth / 2, yOffset + 10, {
    align: "center",
  });

  // Shop name - Large ornate header
  doc.setTextColor(secondary[0], secondary[1], secondary[2]);
  doc.setFontSize(26);
  doc.setFont("notosans", "bold");
  doc.text(bill.shop.name, pageWidth / 2, yOffset + 22, {
    align: "center",
  });

  // Decorative line under shop name
  doc.setDrawColor(primary[0], primary[1], primary[2]);
  doc.setLineWidth(0.8);
  doc.line(pageWidth / 2 - 50, yOffset + 25, pageWidth / 2 + 50, yOffset + 25);

  // Tagline banner
  doc.setFillColor(primary[0], primary[1], primary[2]);
  doc.roundedRect(pageWidth / 2 - 45, yOffset + 27, 90, 7, 1, 1, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("notosans", "bold");
  doc.text("Gold & Silver Jewellery Experts", pageWidth / 2, yOffset + 32, {
    align: "center",
  });

  // Address
  doc.setTextColor(dark[0], dark[1], dark[2]);
  doc.setFontSize(10);
  doc.setFont("notosans", "normal");
  doc.text("Add: " + (bill.shop.address ?? ""), pageWidth / 2, yOffset + 40, {
    align: "center",
  });

  // Divider line
  doc.setDrawColor(accent[0], accent[1], accent[2]);
  doc.setLineWidth(0.5);
  doc.line(margin + 8, yOffset + 44, pageWidth - margin - 8, yOffset + 44);

  // Bill details row
  const detailsY = yOffset + 52;
  doc.setTextColor(primary[0], primary[1], primary[2]);
  doc.setFontSize(12);
  doc.setFont("notosans", "bold");
  doc.text(`${billKindLabel(bill)} No: ` + bill.billNo, margin + 10, detailsY);
  doc.text("Date: " + bill.date, pageWidth - margin - 10, detailsY, {
    align: "right",
  });

  // Rate rows sit directly below the date (per review) — primary accent.
  const rateRows = rateRowsOf(bill, settings);
  rateRows.forEach((row, i) => {
    doc.setFontSize(9);
    doc.setTextColor(primary[0], primary[1], primary[2]);
    money(doc, row, pageWidth - margin - 10, detailsY + 6 + i * 5, "right", true);
  });

  // Customer details
  doc.setTextColor(dark[0], dark[1], dark[2]);
  doc.setFontSize(11);
  doc.setFont("notosans", "normal");
  const customerY = detailsY + 10 + rateRows.length * 5;
  doc.text("Customer: " + (bill.customerName || "________________________________"), margin + 10, customerY);
  doc.text("Address: " + (bill.customerAddress || "________________________________"), margin + 10, customerY + 7);
  if (bill.customerPhone) {
    doc.text("Phone: " + bill.customerPhone, margin + 10, customerY + 14);
  }

  // Items Table Header
  const tableHeaderY = customerY + (bill.customerPhone ? 22 : 16);
  doc.setFillColor(primary[0], primary[1], primary[2]);
  doc.rect(margin + 6, tableHeaderY - 5, contentWidth - 12, 9, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("notosans", "bold");
  const showWeight = settings.weightAfterName;
  const weightX = margin + 78;
  const qtyX = showWeight ? margin + 112 : margin + 100;
  const rateX = showWeight ? margin + 142 : margin + 128;
  doc.text("NAME", margin + 12, tableHeaderY);
  if (showWeight) doc.text("WEIGHT", weightX, tableHeaderY, { align: "center" });
  doc.text("QTY", qtyX, tableHeaderY, { align: "center" });
  doc.text("RATE", rateX, tableHeaderY, { align: "center" });
  doc.text("AMOUNT", pageWidth - margin - 15, tableHeaderY, { align: "right" });

  // Items — 12mm rows with the separator centred in the gap so text never
  // hugs the rules (review: "product rows don't have proper spacing").
  doc.setTextColor(dark[0], dark[1], dark[2]);
  let itemY = tableHeaderY + 10;
  const rowHeight = 12;

  bill.lines.forEach((item, index) => {
    // Subtle row separator — midway between this row's baseline and the
    // previous one's, so clearance is equal above and below the rule.
    if (index > 0) {
      doc.setDrawColor(accent[0], accent[1], accent[2]);
      doc.setLineWidth(0.2);
      doc.line(margin + 8, itemY - rowHeight / 2, pageWidth - margin - 8, itemY - rowHeight / 2);
    }

    // Product name (bold) with the (purity) suffix beside it
    doc.setFontSize(10);
    doc.setFont("notosans", "bold");
    const displayName = item.productName || "-";
    doc.text(displayName, margin + 12, itemY);
    const itemPurity = item.purity?.trim();
    if (itemPurity) {
      const nameW = doc.getTextWidth(displayName);
      doc.setFont("notosans", "normal");
      doc.setFontSize(9);
      doc.text(` (${itemPurity})`, margin + 13 + nameW, itemY);
      doc.setFont("notosans", "bold");
      doc.setFontSize(10);
    }

    // Description (smaller, italic)
    if (item.description) {
      doc.setFontSize(8);
      doc.setFont("notosans", "italic");
      doc.setTextColor(100, 100, 100);
      doc.text(item.description, margin + 12, itemY + 4);
      doc.setTextColor(dark[0], dark[1], dark[2]);
    }

    doc.setFont("notosans", "normal");
    doc.setFontSize(10);
    if (showWeight) {
      doc.text(weightText(item), weightX, itemY, { align: "center" });
    }
    doc.text(item.quantity.toString(), qtyX, itemY, {
      align: "center",
    });
    money(doc, formatCurrency(item.price), rateX, itemY, "center");

    money(doc, formatCurrency(item.total), pageWidth - margin - 15, itemY, "right", true);

    itemY += item.description ? rowHeight + 2 : rowHeight;
  });

  // Totals section (values come from core's BillDocument)
  const subtotal = bill.subtotal;
  const deliveryCharge = bill.deliveryCharge;
  const discount = bill.discount;
  const grandTotal = bill.total;

  let totalY = itemY + 6;

  // Show subtotal + extras when there are extras
  if (deliveryCharge > 0 || discount > 0 || bill.materialReturnedValue > 0) {
    doc.setTextColor(dark[0], dark[1], dark[2]);
    doc.setFontSize(10);
    doc.setFont("notosans", "normal");
    doc.text("Subtotal:", pageWidth - margin - 55, totalY);
    money(doc, formatCurrency(subtotal), pageWidth - margin - 12, totalY, "right");
    totalY += 6;
    if (deliveryCharge > 0) {
      doc.text("Delivery:", pageWidth - margin - 55, totalY);
      money(doc, formatCurrency(deliveryCharge), pageWidth - margin - 12, totalY, "right");
      totalY += 6;
    }
    if (discount > 0) {
      doc.text("Discount:", pageWidth - margin - 55, totalY);
      money(doc, `- ${formatCurrency(discount)}`, pageWidth - margin - 12, totalY, "right");
      totalY += 6;
    }
    if (bill.materialReturnedValue > 0) {
      const matLabel = `${materialReturnedTitleOf(bill)}${
        bill.materialReturnedWeight ? ` (${bill.materialReturnedWeight})` : ""
      }`;
      const matVal = `- ${formatCurrency(bill.materialReturnedValue)}`;
      const matValX = pageWidth - margin - 12;
      // Right-align the label to the value column so long custom titles
      // (up to 60 chars) never run into the amount.
      doc.text(`${matLabel}:`, matValX - doc.getTextWidth(matVal) - 4, totalY, { align: "right" });
      money(doc, matVal, matValX, totalY, "right");
      totalY += 6;
    }
  }

  // Total line
  doc.setDrawColor(primary[0], primary[1], primary[2]);
  doc.setLineWidth(0.8);
  doc.line(pageWidth - margin - 80, totalY - 2, pageWidth - margin - 8, totalY - 2);

  doc.setFillColor(secondary[0], secondary[1], secondary[2]);
  doc.roundedRect(pageWidth - margin - 80, totalY, 72, 12, 2, 2, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("notosans", "bold");
  doc.text("GRAND TOTAL:", pageWidth - margin - 75, totalY + 8);
  doc.setFontSize(13);
  money(doc, formatCurrency(grandTotal), pageWidth - margin - 12, totalY + 8, "right", true);

  // Amount in words — directly BELOW the GRAND TOTAL box, wrapped to the
  // box width (review: "the price line in words should be right below grand
  // total" instead of floating off on the left).
  const wordsY = totalY + 16;
  const signatureY = yOffset + billHeight - 20;
  doc.setFontSize(8);
  doc.setFont("notosans", "italic");
  const words = doc.splitTextToSize(bill.amountInWords, 72) as string[];
  if (wordsY + words.length * 3.6 + 2 < signatureY) {
    doc.setTextColor(dark[0], dark[1], dark[2]);
    doc.text(words, pageWidth - margin - 80, wordsY);
  }

  // Signature stamp — seal.png replaces the old "For {shop}" text, sign line
  // and "Authorized Signature" label (the image carries all three). The line
  // stays at its ORIGINAL y (signatureY + 8) so the block footprint — and
  // therefore measureClassicBillHeight — is unchanged.
  const sealW = CLASSIC_SEAL_W;
  const sealH = sealW * SEAL_ASPECT;
  const lineY = signatureY + 8;
  const sealX = pageWidth - margin - 10 - sealW;
  const sealY = lineY - 0.636 * sealH;
  doc.addImage(BILL_SEAL_DATA_URI, "PNG", sealX, sealY, sealW, sealH);
  // Sign line inside the stamp's blank gap, just above PROPRIETOR.
  doc.setDrawColor(dark[0], dark[1], dark[2]);
  doc.setLineWidth(0.3);
  doc.line(sealX + 0.4 * sealW, lineY, sealX + 0.985 * sealW, lineY);

  // Footer note
  doc.setTextColor(primary[0], primary[1], primary[2]);
  doc.setFontSize(8);
  doc.setFont("notosans", "italic");
  doc.text("Thank you for your purchase!", margin + 15, signatureY + 10);
}

function drawCornerDecoration(
  doc: jsPDF,
  x: number,
  y: number,
  color: [number, number, number],
  flipX = false,
  flipY = false,
): void {
  const size = 8;
  const xDir = flipX ? -1 : 1;
  const yDir = flipY ? -1 : 1;

  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(0.8);
  doc.line(x, y, x + size * xDir, y);
  doc.line(x, y, x, y + size * yDir);

  // Small diamond at corner
  doc.setFillColor(color[0], color[1], color[2]);
  doc.circle(x + 2 * xDir, y + 2 * yDir, 1, "F");
}
