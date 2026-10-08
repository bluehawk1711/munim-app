import { jsPDF } from "jspdf";
import { formatCurrency } from "../utils/format.js";
import { rateRowsOf } from "./billDocument.js";
import type { BillDocument, BillLine, BillTemplateSettings } from "./billDocument.js";
import { BILL_FONT_BOLD_B64, BILL_FONT_ITALIC_B64, BILL_FONT_REGULAR_B64 } from "./billFonts.js";
import { BILL_SEAL_DATA_URI, BILL_SEAL_HEIGHT, BILL_SEAL_WIDTH } from "./billSeal.js";
import { classicColors, ecommerceColors, type ClassicTheme } from "./billTheme.js";

export type { BillTemplateSettings } from "./billDocument.js";

/**
 * Signature stamp (seal.png, 816x294 transparent PNG) — mm widths per
 * template. The stamp carries its own "For M/s. …" header, signature gap and
 * "PROPRIETOR" label; the sign line is drawn INSIDE the gap at 30%..87%
 * width, 72% height of the image box.
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
 * Content height for the e-commerce template (mm, relative to yOffset) —
 * mirrors drawEcommerceBill's fixed layout so the frame hugs the content
 * instead of stretching to the page bottom.
 */
function measureEcommerceBillHeight(
  doc: jsPDF,
  bill: BillDocument,
  contentWidth: number,
): number {
  // Header (3..31) + bill-to (38..57) + table header are fixed; rows start at 76.
  const totalY = 84 + bill.lines.length * 8;
  let grandTotalY = totalY + 5;
  if (bill.deliveryCharge > 0) grandTotalY = totalY + 12;
  if (bill.discount > 0) grandTotalY += 7;
  const wordsY = grandTotalY + 16;
  doc.setFont("notosans", "italic");
  const wordsLines = doc.splitTextToSize(bill.amountInWords, contentWidth - 20).length;
  const contentEnd = Math.max(grandTotalY + 10, wordsY + wordsLines * 3.6);
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
  if (bill.deliveryCharge > 0 || bill.discount > 0) {
    totalY += 6; // subtotal row
    if (bill.deliveryCharge > 0) totalY += 6;
    if (bill.discount > 0) totalY += 6;
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
      ? measureEcommerceBillHeight(doc, billDoc, contentWidth)
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

  // Header section with dark background
  doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.rect(margin + 3, yOffset + 3, contentWidth - 6, 28, "F");

  // Company name (left side in header) - WHITE text
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("notosans", "bold");
  doc.text(bill.shop.name, margin + 10, yOffset + 15);

  // Company details (smaller, below company name) - GOLD text
  doc.setFontSize(8);
  doc.setFont("notosans", "normal");
  doc.setTextColor(colors.gold[0], colors.gold[1], colors.gold[2]);
  doc.text(bill.shop.address ?? "", margin + 10, yOffset + 21);
  doc.text("Tel: " + bill.shop.phones.join(" | "), margin + 10, yOffset + 26);

  // Invoice label (right side in header) - GOLD text
  doc.setTextColor(colors.gold[0], colors.gold[1], colors.gold[2]);
  doc.setFontSize(20);
  doc.setFont("notosans", "bold");
  doc.text("INVOICE", pageWidth - margin - 10, yOffset + 14, {
    align: "right",
  });

  // Invoice number - WHITE text
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("#" + bill.billNo, pageWidth - margin - 10, yOffset + 21, {
    align: "right",
  });
  doc.setFontSize(8);
  doc.text("Date: " + bill.date, pageWidth - margin - 10, yOffset + 27, {
    align: "right",
  });

  // Rate rows sit directly below the date (per review) — gold accent.
  rateRowsOf(bill, settings).forEach((row, i) => {
    doc.setFontSize(8);
    doc.setTextColor(colors.gold[0], colors.gold[1], colors.gold[2]);
    money(doc, row, pageWidth - margin - 10, yOffset + 36 + i * 4.5, "right", true);
  });

  // Bill To section - DARK text for readability
  const billToY = yOffset + 38;
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFontSize(9);
  doc.setFont("notosans", "bold");
  doc.text("BILL TO:", margin + 10, billToY);

  doc.setDrawColor(colors.gold[0], colors.gold[1], colors.gold[2]);
  doc.setLineWidth(0.5);
  doc.line(margin + 10, billToY + 2, margin + 35, billToY + 2);

  // Customer name - larger, bold, dark
  doc.setFont("notosans", "bold");
  doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
  doc.setFontSize(11);
  doc.text(bill.customerName || "-", margin + 10, billToY + 9);

  // Customer details - smaller, gray
  doc.setFontSize(8);
  doc.setFont("notosans", "normal");
  doc.setTextColor(colors.mediumGray[0], colors.mediumGray[1], colors.mediumGray[2]);
  doc.text(bill.customerAddress ?? "", margin + 10, billToY + 14);
  doc.text(bill.customerPhone ?? "", margin + 10, billToY + 19);

  // Items Table Header
  const tableHeaderY = billToY + 28;
  doc.setFillColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2]);
  doc.rect(margin + 5, tableHeaderY - 4, contentWidth - 10, 8, "F");

  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFontSize(8);
  doc.setFont("notosans", "bold");
  const showWeight = settings.weightAfterName;
  const weightX = margin + 87;
  const qtyX = showWeight ? margin + 112 : margin + 105;
  const priceX = showWeight ? margin + 137 : margin + 130;
  doc.text("PRODUCT", margin + 10, tableHeaderY);
  if (showWeight) doc.text("WEIGHT", weightX, tableHeaderY, { align: "center" });
  doc.text("QTY", qtyX, tableHeaderY, { align: "center" });
  doc.text("PRICE", priceX, tableHeaderY, { align: "center" });
  doc.text("TOTAL", pageWidth - margin - 15, tableHeaderY, { align: "right" });

  // Items - DARK text
  doc.setFont("notosans", "normal");
  let itemY = tableHeaderY + 10;
  const rowHeight = 8;

  bill.lines.forEach((item, index) => {
    // Alternate row background
    if (index % 2 === 1) {
      doc.setFillColor(252, 252, 253);
      doc.rect(margin + 5, itemY - 4, contentWidth - 10, rowHeight, "F");
    }

    // Product Name - Bold, Dark
    doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
    doc.setFontSize(9);
    doc.setFont("notosans", "bold");
    doc.text(item.productName || "-", margin + 10, itemY);

    // Quantity - Normal, Gray
    doc.setFont("notosans", "normal");
    doc.setTextColor(colors.mediumGray[0], colors.mediumGray[1], colors.mediumGray[2]);
    if (showWeight) {
      doc.text(weightText(item), weightX, itemY, { align: "center" });
    }
    doc.text(item.quantity.toString(), qtyX, itemY, {
      align: "center",
    });

    // Price - Normal, Gray
    money(doc, formatCurrency(item.price), priceX, itemY, "center");

    // Total - Bold, Dark (from the shared model)
    doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
    money(doc, formatCurrency(item.total), pageWidth - margin - 15, itemY, "right", true);

    itemY += rowHeight;
  });

  // Totals section (values come from core's BillDocument)
  const subtotal = bill.subtotal;
  const deliveryCharge = bill.deliveryCharge;
  const discount = bill.discount;
  const grandTotal = bill.total;

  const totalY = itemY + 8;

  doc.setDrawColor(colors.gold[0], colors.gold[1], colors.gold[2]);
  doc.setLineWidth(0.3);
  doc.line(pageWidth - margin - 80, totalY - 8, pageWidth - margin - 10, totalY - 8);

  // Subtotal row
  doc.setTextColor(colors.mediumGray[0], colors.mediumGray[1], colors.mediumGray[2]);
  doc.setFontSize(8);
  doc.setFont("notosans", "normal");
  doc.text("Subtotal:", pageWidth - margin - 60, totalY - 2);
  money(doc, formatCurrency(subtotal), pageWidth - margin - 15, totalY - 2, "right");

  let grandTotalY = totalY + 5;
  if (deliveryCharge > 0) {
    doc.text("Delivery:", pageWidth - margin - 60, totalY + 4);
    money(doc, formatCurrency(deliveryCharge), pageWidth - margin - 15, totalY + 4, "right");
    grandTotalY = totalY + 12;
  }
  if (discount > 0) {
    doc.text("Discount:", pageWidth - margin - 60, grandTotalY);
    money(doc, `- ${formatCurrency(discount)}`, pageWidth - margin - 15, grandTotalY, "right");
    grandTotalY += 7;
  }

  // Grand Total box
  doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.roundedRect(pageWidth - margin - 70, grandTotalY - 2, 60, 12, 2, 2, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("notosans", "bold");
  doc.text("TOTAL", pageWidth - margin - 65, grandTotalY + 5);
  doc.setTextColor(colors.gold[0], colors.gold[1], colors.gold[2]);
  doc.setFontSize(11);
  money(doc, formatCurrency(grandTotal), pageWidth - margin - 15, grandTotalY + 6, "right", true);

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

  // Amount in words (shared, from core) — only if there is room
  const wordsY = grandTotalY + 16;
  if (wordsY + 12 < footerY) {
    doc.setTextColor(colors.mediumGray[0], colors.mediumGray[1], colors.mediumGray[2]);
    doc.setFontSize(6.5);
    doc.setFont("notosans", "italic");
    const words = doc.splitTextToSize(bill.amountInWords, contentWidth - 20) as string[];
    doc.text(words, margin + 10, wordsY);
  }

  // Signature stamp (seal.png) — centered above the footer separator.
  const sealW = ECOM_SEAL_W;
  const sealH = sealW * SEAL_ASPECT;
  doc.addImage(
    BILL_SEAL_DATA_URI,
    "PNG",
    (pageWidth - sealW) / 2,
    yOffset + billHeight - 15 - 2 - sealH,
    sealW,
    sealH,
  );
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
  doc.text("Bill No: " + bill.billNo, margin + 10, detailsY);
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

    // Product name (bold)
    doc.setFontSize(10);
    doc.setFont("notosans", "bold");
    doc.text(item.productName || "-", margin + 12, itemY);

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
  if (deliveryCharge > 0 || discount > 0) {
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
  const sealY = lineY - 0.72 * sealH;
  doc.addImage(BILL_SEAL_DATA_URI, "PNG", sealX, sealY, sealW, sealH);
  // Sign line inside the stamp's blank gap, just above PROPRIETOR.
  doc.setDrawColor(dark[0], dark[1], dark[2]);
  doc.setLineWidth(0.3);
  doc.line(sealX + 0.3 * sealW, lineY, sealX + 0.87 * sealW, lineY);

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
