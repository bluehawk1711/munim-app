import { jsPDF } from "jspdf";
import { formatCurrency } from "../utils/format.js";
import type { BillDocument, BillLine, BillTemplateSettings } from "./billDocument.js";

export type { BillTemplateSettings } from "./billDocument.js";

/** "24.5g" / "24500mg" — WEIGHT column display (dash when no snapshot). */
function weightText(item: BillLine): string {
  if (item.weight == null) return "-";
  return `${item.weight}${item.weightUnit === "mg" ? "mg" : "g"}`;
}

/** Shop rate rows gated by the per-bill toggles + present rate values. */
function rateRowsOf(bill: BillDocument, settings: BillTemplateSettings): string[] {
  const rows: string[] = [];
  if (settings.goldRateLine && bill.goldRate != null && bill.goldRate > 0) {
    rows.push(`Gold rate: ${formatCurrency(bill.goldRate)}/g`);
  }
  if (settings.silverRateLine && bill.silverRate != null && bill.silverRate > 0) {
    rows.push(`Silver rate: ${formatCurrency(bill.silverRate)}/g`);
  }
  return rows;
}

// Color themes for classic template
const classicColors = {
  red: {
    primary: [180, 40, 50] as [number, number, number],
    secondary: [140, 20, 30] as [number, number, number],
    accent: [220, 80, 80] as [number, number, number],
    dark: [100, 20, 25] as [number, number, number],
  },
  yellow: {
    primary: [180, 140, 50] as [number, number, number],
    secondary: [150, 110, 30] as [number, number, number],
    accent: [220, 180, 80] as [number, number, number],
    dark: [120, 90, 20] as [number, number, number],
  },
};

// E-commerce theme colors (luxury dark/gold)
const ecommerceColors = {
  primary: [15, 23, 42] as [number, number, number],
  gold: [180, 150, 80] as [number, number, number],
  goldDark: [140, 110, 50] as [number, number, number],
  lightGray: [248, 250, 252] as [number, number, number],
  mediumGray: [100, 116, 139] as [number, number, number],
  text: [30, 41, 59] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

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
  const wordsLines = doc.splitTextToSize(bill.amountInWords, contentWidth - 20).length;
  const contentEnd = Math.max(grandTotalY + 10, wordsY + wordsLines * 3.6);
  return contentEnd + 24; // footer zone: separator + thank-you + email + padding
}

/**
 * Content height for the classic jewellery template (mm, relative to yOffset)
 * — mirrors drawClassicJewelleryBill up to the signature block.
 */
function measureClassicBillHeight(
  doc: jsPDF,
  bill: BillDocument,
  contentWidth: number,
): number {
  const customerY = 62; // detailsY (52) + 10
  const tableHeaderY = customerY + (bill.customerPhone ? 22 : 16);
  let itemY = tableHeaderY + 10;
  for (const line of bill.lines) itemY += line.description ? 12 : 10;
  let totalY = itemY + 6;
  if (bill.deliveryCharge > 0 || bill.discount > 0) {
    totalY += 6; // subtotal row
    if (bill.deliveryCharge > 0) totalY += 6;
    if (bill.discount > 0) totalY += 6;
  }
  const wordsY = totalY + 18;
  const wordsLines = doc.splitTextToSize(bill.amountInWords, contentWidth - 20).length;
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
      : measureClassicBillHeight(doc, billDoc, contentWidth);
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
  doc.setFont("helvetica", "bold");
  doc.text(bill.shop.name, margin + 10, yOffset + 15);

  // Company details (smaller, below company name) - GOLD text
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(colors.gold[0], colors.gold[1], colors.gold[2]);
  doc.text(bill.shop.address ?? "", margin + 10, yOffset + 21);
  doc.text("Tel: " + bill.shop.phones.join(" | "), margin + 10, yOffset + 26);

  // Invoice label (right side in header) - GOLD text
  doc.setTextColor(colors.gold[0], colors.gold[1], colors.gold[2]);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
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

  // Bill To section - DARK text for readability
  const billToY = yOffset + 38;
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("BILL TO:", margin + 10, billToY);

  doc.setDrawColor(colors.gold[0], colors.gold[1], colors.gold[2]);
  doc.setLineWidth(0.5);
  doc.line(margin + 10, billToY + 2, margin + 35, billToY + 2);

  // Customer name - larger, bold, dark
  doc.setFont("helvetica", "bold");
  doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
  doc.setFontSize(11);
  doc.text(bill.customerName || "-", margin + 10, billToY + 9);

  // Customer details - smaller, gray
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(colors.mediumGray[0], colors.mediumGray[1], colors.mediumGray[2]);
  doc.text(bill.customerAddress ?? "", margin + 10, billToY + 14);
  doc.text(bill.customerPhone ?? "", margin + 10, billToY + 19);

  // Items Table Header
  const tableHeaderY = billToY + 28;
  doc.setFillColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2]);
  doc.rect(margin + 5, tableHeaderY - 4, contentWidth - 10, 8, "F");

  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
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
  doc.setFont("helvetica", "normal");
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
    doc.setFont("helvetica", "bold");
    doc.text(item.productName || "-", margin + 10, itemY);

    // Quantity - Normal, Gray
    doc.setFont("helvetica", "normal");
    doc.setTextColor(colors.mediumGray[0], colors.mediumGray[1], colors.mediumGray[2]);
    if (showWeight) {
      doc.text(weightText(item), weightX, itemY, { align: "center" });
    }
    doc.text(item.quantity.toString(), qtyX, itemY, {
      align: "center",
    });

    // Price - Normal, Gray
    doc.text(formatCurrency(item.price), priceX, itemY, {
      align: "center",
    });

    // Total - Bold, Dark (from the shared model)
    doc.setFont("helvetica", "bold");
    doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
    doc.text(formatCurrency(item.total), pageWidth - margin - 15, itemY, {
      align: "right",
    });

    itemY += rowHeight;
  });

  // Totals section (values come from core's BillDocument)
  const subtotal = bill.subtotal;
  const deliveryCharge = bill.deliveryCharge;
  const discount = bill.discount;
  const grandTotal = bill.total;

  const totalY = itemY + 8;

  // Shop rate rows (per-bill display toggles) — left side of the totals band
  rateRowsOf(bill, settings).forEach((row, i) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(colors.gold[0], colors.gold[1], colors.gold[2]);
    doc.text(row, margin + 10, totalY + i * 5);
  });

  doc.setDrawColor(colors.gold[0], colors.gold[1], colors.gold[2]);
  doc.setLineWidth(0.3);
  doc.line(pageWidth - margin - 80, totalY - 8, pageWidth - margin - 10, totalY - 8);

  // Subtotal row
  doc.setTextColor(colors.mediumGray[0], colors.mediumGray[1], colors.mediumGray[2]);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Subtotal:", pageWidth - margin - 60, totalY - 2);
  doc.text(formatCurrency(subtotal), pageWidth - margin - 15, totalY - 2, {
    align: "right",
  });

  let grandTotalY = totalY + 5;
  if (deliveryCharge > 0) {
    doc.text("Delivery:", pageWidth - margin - 60, totalY + 4);
    doc.text(formatCurrency(deliveryCharge), pageWidth - margin - 15, totalY + 4, {
      align: "right",
    });
    grandTotalY = totalY + 12;
  }
  if (discount > 0) {
    doc.text("Discount:", pageWidth - margin - 60, grandTotalY);
    doc.text(`- ${formatCurrency(discount)}`, pageWidth - margin - 15, grandTotalY, {
      align: "right",
    });
    grandTotalY += 7;
  }

  // Grand Total box
  doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.roundedRect(pageWidth - margin - 70, grandTotalY - 2, 60, 12, 2, 2, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL", pageWidth - margin - 65, grandTotalY + 5);
  doc.setTextColor(colors.gold[0], colors.gold[1], colors.gold[2]);
  doc.setFontSize(11);
  doc.text(formatCurrency(grandTotal), pageWidth - margin - 15, grandTotalY + 6, {
    align: "right",
  });

  // Footer
  const footerY = yOffset + billHeight - 12;
  doc.setDrawColor(colors.gold[0], colors.gold[1], colors.gold[2]);
  doc.setLineWidth(0.3);
  doc.line(margin + 10, footerY - 3, pageWidth - margin - 10, footerY - 3);

  doc.setTextColor(colors.mediumGray[0], colors.mediumGray[1], colors.mediumGray[2]);
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.text("Thank you for your business!", pageWidth / 2, footerY + 2, {
    align: "center",
  });

  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(bill.shop.email ?? "", pageWidth / 2, footerY + 6, {
    align: "center",
  });

  // Amount in words (shared, from core) — only if there is room
  const wordsY = grandTotalY + 16;
  if (wordsY + 12 < footerY) {
    doc.setTextColor(colors.mediumGray[0], colors.mediumGray[1], colors.mediumGray[2]);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "italic");
    const words = doc.splitTextToSize(bill.amountInWords, contentWidth - 20) as string[];
    doc.text(words, margin + 10, wordsY);
  }
}

function drawClassicJewelleryBill(
  doc: jsPDF,
  yOffset: number,
  bill: BillDocument,
  billHeight: number,
  pageWidth: number,
  margin: number,
  contentWidth: number,
  colorTheme: (typeof classicColors)["red"],
  settings: BillTemplateSettings,
): void {
  const { primary, secondary, accent, dark } = colorTheme;

  // Watermark (subtle) - Draw first so it appears in background
  doc.setTextColor(245, 245, 245);
  doc.setFontSize(50);
  doc.setFont("times", "bold");
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

  // Phone numbers at top corners
  doc.setTextColor(dark[0], dark[1], dark[2]);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Ph: " + (bill.shop.phones[0] ?? ""), margin + 12, yOffset + 12);
  doc.text("Ph: " + (bill.shop.phones[1] ?? ""), pageWidth - margin - 12, yOffset + 12, {
    align: "right",
  });

  // Blessing text
  doc.setTextColor(primary[0], primary[1], primary[2]);
  doc.setFontSize(9);
  doc.setFont("times", "italic");
  doc.text("|| JAI SHREE SHYAM ||", pageWidth / 2, yOffset + 10, {
    align: "center",
  });

  // Shop name - Large ornate header
  doc.setTextColor(secondary[0], secondary[1], secondary[2]);
  doc.setFontSize(26);
  doc.setFont("times", "bold");
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
  doc.setFont("helvetica", "bold");
  doc.text("Gold & Silver Jewellery Experts", pageWidth / 2, yOffset + 32, {
    align: "center",
  });

  // Address
  doc.setTextColor(dark[0], dark[1], dark[2]);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
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
  doc.setFont("helvetica", "bold");
  doc.text("Bill No: " + bill.billNo, margin + 10, detailsY);
  doc.text("Date: " + bill.date, pageWidth - margin - 10, detailsY, {
    align: "right",
  });

  // Customer details
  doc.setTextColor(dark[0], dark[1], dark[2]);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  const customerY = detailsY + 10;
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
  doc.setFont("helvetica", "bold");
  const showWeight = settings.weightAfterName;
  const weightX = margin + 78;
  const qtyX = showWeight ? margin + 112 : margin + 100;
  const rateX = showWeight ? margin + 142 : margin + 128;
  doc.text("NAME", margin + 12, tableHeaderY);
  if (showWeight) doc.text("WEIGHT", weightX, tableHeaderY, { align: "center" });
  doc.text("QTY", qtyX, tableHeaderY, { align: "center" });
  doc.text("RATE", rateX, tableHeaderY, { align: "center" });
  doc.text("AMOUNT", pageWidth - margin - 15, tableHeaderY, { align: "right" });

  // Items
  doc.setTextColor(dark[0], dark[1], dark[2]);
  let itemY = tableHeaderY + 10;
  const rowHeight = 10;

  bill.lines.forEach((item, index) => {
    // Subtle row separator
    if (index > 0) {
      doc.setDrawColor(accent[0], accent[1], accent[2]);
      doc.setLineWidth(0.2);
      doc.line(margin + 8, itemY - 3, pageWidth - margin - 8, itemY - 3);
    }

    // Product name (bold)
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(item.productName || "-", margin + 12, itemY);

    // Description (smaller, italic)
    if (item.description) {
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(100, 100, 100);
      doc.text(item.description, margin + 12, itemY + 4);
      doc.setTextColor(dark[0], dark[1], dark[2]);
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    if (showWeight) {
      doc.text(weightText(item), weightX, itemY, { align: "center" });
    }
    doc.text(item.quantity.toString(), qtyX, itemY, {
      align: "center",
    });
    doc.text(formatCurrency(item.price), rateX, itemY, {
      align: "center",
    });

    doc.setFont("helvetica", "bold");
    doc.text(formatCurrency(item.total), pageWidth - margin - 15, itemY, {
      align: "right",
    });

    itemY += item.description ? rowHeight + 2 : rowHeight;
  });

  // Totals section (values come from core's BillDocument)
  const subtotal = bill.subtotal;
  const deliveryCharge = bill.deliveryCharge;
  const discount = bill.discount;
  const grandTotal = bill.total;

  let totalY = itemY + 6;

  // Shop rate rows (per-bill display toggles) — left of the totals band
  rateRowsOf(bill, settings).forEach((row, i) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(primary[0], primary[1], primary[2]);
    doc.text(row, margin + 10, totalY + i * 5);
  });

  // Show subtotal + extras when there are extras
  if (deliveryCharge > 0 || discount > 0) {
    doc.setTextColor(dark[0], dark[1], dark[2]);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Subtotal:", pageWidth - margin - 55, totalY);
    doc.text(formatCurrency(subtotal), pageWidth - margin - 12, totalY, {
      align: "right",
    });
    totalY += 6;
    if (deliveryCharge > 0) {
      doc.text("Delivery:", pageWidth - margin - 55, totalY);
      doc.text(formatCurrency(deliveryCharge), pageWidth - margin - 12, totalY, {
        align: "right",
      });
      totalY += 6;
    }
    if (discount > 0) {
      doc.text("Discount:", pageWidth - margin - 55, totalY);
      doc.text(`- ${formatCurrency(discount)}`, pageWidth - margin - 12, totalY, {
        align: "right",
      });
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
  doc.setFont("helvetica", "bold");
  doc.text("GRAND TOTAL:", pageWidth - margin - 75, totalY + 8);
  doc.setFontSize(13);
  doc.text(formatCurrency(grandTotal), pageWidth - margin - 12, totalY + 8, {
    align: "right",
  });

  // Amount in words (shared, from core) — only if there is room
  const wordsY = totalY + 18;
  const signatureY = yOffset + billHeight - 20;
  if (wordsY + 10 < signatureY) {
    doc.setTextColor(dark[0], dark[1], dark[2]);
    doc.setFontSize(8);
    doc.setFont("times", "italic");
    const words = doc.splitTextToSize(bill.amountInWords, contentWidth - 20) as string[];
    doc.text(words, margin + 12, wordsY);
  }

  // Signature section
  doc.setTextColor(dark[0], dark[1], dark[2]);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("For " + bill.shop.name, pageWidth - margin - 50, signatureY);
  doc.setDrawColor(primary[0], primary[1], primary[2]);
  doc.setLineWidth(0.3);
  doc.line(pageWidth - margin - 55, signatureY + 8, pageWidth - margin - 10, signatureY + 8);
  doc.setFontSize(9);
  doc.text("Authorized Signature", pageWidth - margin - 50, signatureY + 13);

  // Footer note
  doc.setTextColor(primary[0], primary[1], primary[2]);
  doc.setFontSize(8);
  doc.setFont("times", "italic");
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
