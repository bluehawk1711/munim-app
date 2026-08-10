import { jsPDF } from "jspdf";
import { JobLetterData, BillData, BillDetails } from "../types";
import { numberToWords, formatCurrency } from "./numberToWords";

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

export function generateBillPDF(data: BillData): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 8;

  const drawBill = (yOffset: number, billData: BillDetails) => {
    const isEcommerce = data.settings.template === "ecommerce";
    const billHeight = (pageHeight - 16) / (data.settings.twoInOne ? 2 : 1);
    const contentWidth = pageWidth - 2 * margin;

    if (isEcommerce) {
      drawEcommerceBill(
        doc,
        yOffset,
        billData,
        data,
        billHeight,
        pageWidth,
        margin,
        contentWidth,
      );
    } else {
      const colorTheme = classicColors[data.settings.classicColor || "red"];
      drawClassicJewelleryBill(
        doc,
        yOffset,
        billData,
        data,
        billHeight,
        pageWidth,
        margin,
        contentWidth,
        colorTheme,
      );
    }
  };

  if (data.settings.twoInOne) {
    drawBill(margin, data);
    if (data.settings.mode === "distinct" && data.secondBill) {
      drawBill(pageHeight / 2 + 4, data.secondBill);
    } else {
      drawBill(pageHeight / 2 + 4, data);
    }
  } else {
    drawBill(margin, data);
  }

  doc.save(`Bill_${data.billNo}.pdf`);
}

function drawEcommerceBill(
  doc: jsPDF,
  yOffset: number,
  billData: BillDetails,
  data: BillData,
  billHeight: number,
  pageWidth: number,
  margin: number,
  contentWidth: number,
): void {
  const colors = ecommerceColors;

  // Outer border with gold accent
  doc.setDrawColor(colors.gold[0], colors.gold[1], colors.gold[2]);
  doc.setLineWidth(1.5);
  doc.rect(margin, yOffset, contentWidth, billHeight);

  // Inner subtle border
  doc.setDrawColor(
    colors.lightGray[0],
    colors.lightGray[1],
    colors.lightGray[2],
  );
  doc.setLineWidth(0.3);
  doc.rect(margin + 2, yOffset + 2, contentWidth - 4, billHeight - 4);

  // Header section with dark background
  doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.rect(margin + 3, yOffset + 3, contentWidth - 6, 28, "F");

  // Company name (left side in header) - WHITE text
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(data.shopDetails.name, margin + 10, yOffset + 15);

  // Company details (smaller, below company name) - GOLD text
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(colors.gold[0], colors.gold[1], colors.gold[2]);
  doc.text(data.shopDetails.address, margin + 10, yOffset + 21);
  doc.text(
    "Tel: " + data.shopDetails.phones.join(" | "),
    margin + 10,
    yOffset + 26,
  );

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
  doc.text("#" + billData.billNo, pageWidth - margin - 10, yOffset + 21, {
    align: "right",
  });
  doc.setFontSize(8);
  doc.text("Date: " + billData.date, pageWidth - margin - 10, yOffset + 27, {
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
  doc.text(billData.customerName || "-", margin + 10, billToY + 9);

  // Customer details - smaller, gray
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(
    colors.mediumGray[0],
    colors.mediumGray[1],
    colors.mediumGray[2],
  );
  doc.text(billData.customerAddress || "", margin + 10, billToY + 14);
  doc.text(billData.customerPhone || "", margin + 10, billToY + 19);

  // Items Table Header
  const tableHeaderY = billToY + 28;
  doc.setFillColor(
    colors.lightGray[0],
    colors.lightGray[1],
    colors.lightGray[2],
  );
  doc.rect(margin + 5, tableHeaderY - 4, contentWidth - 10, 8, "F");

  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("PRODUCT", margin + 10, tableHeaderY);
  doc.text("QTY", margin + 105, tableHeaderY, { align: "center" });
  doc.text("PRICE", margin + 130, tableHeaderY, { align: "center" });
  doc.text("TOTAL", pageWidth - margin - 15, tableHeaderY, { align: "right" });

  // Items - DARK text
  doc.setFont("helvetica", "normal");
  let itemY = tableHeaderY + 10;
  const rowHeight = 8;

  billData.items.forEach((item, index) => {
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
    doc.setTextColor(
      colors.mediumGray[0],
      colors.mediumGray[1],
      colors.mediumGray[2],
    );
    doc.text(item.quantity.toString(), margin + 105, itemY, {
      align: "center",
    });

    // Price - Normal, Gray
    doc.text("Rs. " + item.price.toLocaleString(), margin + 130, itemY, {
      align: "center",
    });

    // Total - Bold, Dark
    doc.setFont("helvetica", "bold");
    doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
    doc.text(
      "Rs. " + (item.quantity * item.price).toLocaleString(),
      pageWidth - margin - 15,
      itemY,
      { align: "right" },
    );

    itemY += rowHeight;
  });

  // Subtotal and delivery calculations
  const subtotal = billData.items.reduce(
    (acc, item) => acc + item.quantity * item.price,
    0,
  );
  const deliveryCharge = billData.deliveryCharge || 0;
  const grandTotal = subtotal + deliveryCharge;

  // Totals section
  const totalY = itemY + 8;

  doc.setDrawColor(colors.gold[0], colors.gold[1], colors.gold[2]);
  doc.setLineWidth(0.3);
  doc.line(
    pageWidth - margin - 80,
    totalY - 8,
    pageWidth - margin - 10,
    totalY - 8,
  );

  // Subtotal row
  doc.setTextColor(
    colors.mediumGray[0],
    colors.mediumGray[1],
    colors.mediumGray[2],
  );
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Subtotal:", pageWidth - margin - 60, totalY - 2);
  doc.text(
    "Rs. " + subtotal.toLocaleString(),
    pageWidth - margin - 15,
    totalY - 2,
    { align: "right" },
  );

  // Delivery charge row (if applicable)
  let grandTotalY = totalY + 5;
  if (deliveryCharge > 0) {
    doc.text("Delivery:", pageWidth - margin - 60, totalY + 4);
    doc.text(
      "Rs. " + deliveryCharge.toLocaleString(),
      pageWidth - margin - 15,
      totalY + 4,
      { align: "right" },
    );
    grandTotalY = totalY + 12;
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
  doc.text(
    "Rs. " + grandTotal.toLocaleString(),
    pageWidth - margin - 15,
    grandTotalY + 6,
    { align: "right" },
  );

  // Footer
  const footerY = yOffset + billHeight - 12;
  doc.setDrawColor(colors.gold[0], colors.gold[1], colors.gold[2]);
  doc.setLineWidth(0.3);
  doc.line(margin + 10, footerY - 3, pageWidth - margin - 10, footerY - 3);

  doc.setTextColor(
    colors.mediumGray[0],
    colors.mediumGray[1],
    colors.mediumGray[2],
  );
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.text("Thank you for your business!", pageWidth / 2, footerY + 2, {
    align: "center",
  });

  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(data.shopDetails.email || "", pageWidth / 2, footerY + 6, {
    align: "center",
  });
}

function drawClassicJewelleryBill(
  doc: jsPDF,
  yOffset: number,
  billData: BillDetails,
  data: BillData,
  billHeight: number,
  pageWidth: number,
  margin: number,
  contentWidth: number,
  colorTheme: typeof classicColors.red,
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
  drawCornerDecoration(
    doc,
    margin + 4,
    yOffset + billHeight - 4,
    primary,
    false,
    true,
  );
  drawCornerDecoration(
    doc,
    pageWidth - margin - 4,
    yOffset + billHeight - 4,
    primary,
    true,
    true,
  );

  // Phone numbers at top corners
  doc.setTextColor(dark[0], dark[1], dark[2]);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Ph: " + data.shopDetails.phones[0], margin + 12, yOffset + 12);
  doc.text(
    "Ph: " + (data.shopDetails.phones[1] || ""),
    pageWidth - margin - 12,
    yOffset + 12,
    { align: "right" },
  );

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
  doc.text(data.shopDetails.name, pageWidth / 2, yOffset + 22, {
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
  doc.text("Add: " + data.shopDetails.address, pageWidth / 2, yOffset + 40, {
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
  doc.text("Bill No: " + billData.billNo, margin + 10, detailsY);
  doc.text("Date: " + billData.date, pageWidth - margin - 10, detailsY, {
    align: "right",
  });

  // Customer details
  doc.setTextColor(dark[0], dark[1], dark[2]);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  const customerY = detailsY + 10;
  doc.text(
    "Customer: " +
      (billData.customerName || "________________________________"),
    margin + 10,
    customerY,
  );
  doc.text(
    "Address: " +
      (billData.customerAddress || "________________________________"),
    margin + 10,
    customerY + 7,
  );
  if (billData.customerPhone) {
    doc.text("Phone: " + billData.customerPhone, margin + 10, customerY + 14);
  }

  // Items Table Header
  const tableHeaderY = customerY + (billData.customerPhone ? 22 : 16);
  doc.setFillColor(primary[0], primary[1], primary[2]);
  doc.rect(margin + 6, tableHeaderY - 5, contentWidth - 12, 9, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("NAME", margin + 12, tableHeaderY);
  doc.text("QTY", margin + 100, tableHeaderY, { align: "center" });
  doc.text("RATE", margin + 128, tableHeaderY, { align: "center" });
  doc.text("AMOUNT", pageWidth - margin - 15, tableHeaderY, { align: "right" });

  // Items
  doc.setTextColor(dark[0], dark[1], dark[2]);
  let itemY = tableHeaderY + 10;
  const rowHeight = 10;

  billData.items.forEach((item, index) => {
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
    doc.text(item.quantity.toString(), margin + 100, itemY, {
      align: "center",
    });
    doc.text("Rs. " + item.price.toLocaleString(), margin + 128, itemY, {
      align: "center",
    });

    doc.setFont("helvetica", "bold");
    doc.text(
      "Rs. " + (item.quantity * item.price).toLocaleString(),
      pageWidth - margin - 15,
      itemY,
      { align: "right" },
    );

    itemY += item.description ? rowHeight + 2 : rowHeight;
  });

  // Subtotal and delivery calculations
  const subtotal = billData.items.reduce(
    (acc, item) => acc + item.quantity * item.price,
    0,
  );
  const deliveryCharge = billData.deliveryCharge || 0;
  const grandTotal = subtotal + deliveryCharge;

  // Total section
  let totalY = itemY + 6;

  // Show delivery if applicable
  if (deliveryCharge > 0) {
    doc.setTextColor(dark[0], dark[1], dark[2]);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Subtotal:", pageWidth - margin - 55, totalY);
    doc.text(
      "Rs. " + subtotal.toLocaleString(),
      pageWidth - margin - 12,
      totalY,
      { align: "right" },
    );
    totalY += 6;
    doc.text("Delivery:", pageWidth - margin - 55, totalY);
    doc.text(
      "Rs. " + deliveryCharge.toLocaleString(),
      pageWidth - margin - 12,
      totalY,
      { align: "right" },
    );
    totalY += 6;
  }

  // Total line
  doc.setDrawColor(primary[0], primary[1], primary[2]);
  doc.setLineWidth(0.8);
  doc.line(
    pageWidth - margin - 80,
    totalY - 2,
    pageWidth - margin - 8,
    totalY - 2,
  );

  doc.setFillColor(secondary[0], secondary[1], secondary[2]);
  doc.roundedRect(pageWidth - margin - 80, totalY, 72, 12, 2, 2, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("GRAND TOTAL:", pageWidth - margin - 75, totalY + 8);
  doc.setFontSize(13);
  doc.text(
    "Rs. " + grandTotal.toLocaleString(),
    pageWidth - margin - 12,
    totalY + 8,
    { align: "right" },
  );

  // Signature section
  const signatureY = yOffset + billHeight - 20;
  doc.setTextColor(dark[0], dark[1], dark[2]);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("For " + data.shopDetails.name, pageWidth - margin - 50, signatureY);
  doc.setDrawColor(primary[0], primary[1], primary[2]);
  doc.setLineWidth(0.3);
  doc.line(
    pageWidth - margin - 55,
    signatureY + 8,
    pageWidth - margin - 10,
    signatureY + 8,
  );
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

export function generateJobLetterPDF(data: JobLetterData): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  drawDecorativeBorder(doc, pageWidth, pageHeight, margin);

  const headerY = 35;

  // Company Header with elegant styling
  doc.setFont("times", "bold");
  doc.setFontSize(26);
  doc.setTextColor(139, 119, 42);
  doc.text(data.companyName, pageWidth / 2, headerY, { align: "center" });

  // Decorative underline
  doc.setDrawColor(180, 160, 100);
  doc.setLineWidth(0.5);
  doc.line(pageWidth / 2 - 45, headerY + 4, pageWidth / 2 + 45, headerY + 4);

  doc.setFontSize(10);
  doc.setFont("times", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(data.companyAddress, pageWidth / 2, headerY + 12, {
    align: "center",
  });
  doc.text("Email: " + data.companyEmail, pageWidth / 2, headerY + 18, {
    align: "center",
  });

  // Main divider
  doc.setDrawColor(139, 119, 42);
  doc.setLineWidth(0.8);
  doc.line(margin + 10, headerY + 25, pageWidth - margin - 10, headerY + 25);

  let currentY = headerY + 42;
  const leftMargin = margin + 15;
  const lineHeight = 7;

  // Recipients section
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(11);
  doc.setFont("times", "normal");

  doc.text("To,", leftMargin, currentY);
  currentY += lineHeight;
  doc.setFont("times", "bold");
  doc.text(
    "Name: " + (data.employeeName || "_____________________________"),
    leftMargin,
    currentY,
  );
  doc.setFont("times", "normal");
  currentY += lineHeight;
  doc.text(
    "Address: " + (data.employeeAddress || "_____________________________"),
    leftMargin,
    currentY,
  );
  currentY += lineHeight * 2;

  // Subject line with emphasis
  doc.setFontSize(13);
  doc.setFont("times", "bold");
  doc.setTextColor(139, 119, 42);
  doc.text(
    "Subject: Appointment & Joining Confirmation Letter",
    leftMargin,
    currentY,
  );

  // Underline for subject
  doc.setDrawColor(180, 160, 100);
  doc.setLineWidth(0.3);
  doc.line(leftMargin, currentY + 2, leftMargin + 100, currentY + 2);
  currentY += lineHeight * 2;

  // Letter body
  doc.setFontSize(11);
  doc.setFont("times", "normal");
  doc.setTextColor(40, 40, 40);

  doc.text(
    "Dear " +
      (data.employeeName ? "Mr./Ms. " + data.employeeName : "_______________") +
      ",",
    leftMargin,
    currentY,
  );
  currentY += lineHeight * 1.5;

  // Position paragraph
  const positionText =
    "We are pleased to offer you the position of " +
    (data.position || "____________") +
    " at " +
    data.companyName +
    ".";
  doc.text(positionText, leftMargin, currentY);
  currentY += lineHeight;

  // Joining date
  const joiningDateObj = data.joiningDate ? new Date(data.joiningDate) : null;
  const joiningText =
    joiningDateObj && !isNaN(joiningDateObj.getTime())
      ? joiningDateObj.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : "_________ (Joining Date)";
  doc.text(
    "You are required to join on " + joiningText + ".",
    leftMargin,
    currentY,
  );
  currentY += lineHeight;

  if (data.additionalTasks) {
    doc.text(
      "Additional responsibilities: " + data.additionalTasks,
      leftMargin,
      currentY,
    );
    currentY += lineHeight;
  }
  currentY += lineHeight * 0.5;

  // Salary details
  const salaryInWords =
    data.monthlySalary > 0 ? numberToWords(data.monthlySalary) : "____________";
  const salaryFormatted =
    data.monthlySalary > 0 ? formatCurrency(data.monthlySalary) : "________";

  doc.setFont("times", "bold");
  doc.text("Compensation:", leftMargin, currentY);
  doc.setFont("times", "normal");
  currentY += lineHeight;
  doc.text(
    "Monthly Salary: Rs. " + salaryFormatted + " (" + salaryInWords + ")",
    leftMargin + 5,
    currentY,
  );
  currentY += lineHeight * 1.5;

  // Working hours
  doc.setFont("times", "bold");
  doc.text("Working Hours:", leftMargin, currentY);
  doc.setFont("times", "normal");
  currentY += lineHeight;

  if (data.workingHoursDescription) {
    doc.text(data.workingHoursDescription, leftMargin + 5, currentY);
    currentY += lineHeight;
  }
  doc.text(
    "Timing: " +
      (data.workingHoursFrom || "_________") +
      " to " +
      (data.workingHoursTo || "_________"),
    leftMargin + 5,
    currentY,
  );
  currentY += lineHeight;
  doc.text(
    "Weekly Off: " +
      (data.weeklyOff1 || "____________") +
      (data.weeklyOff2 ? ", " + data.weeklyOff2 : ""),
    leftMargin + 5,
    currentY,
  );
  currentY += lineHeight * 1.5;

  // Probation
  doc.text(
    "You will be under probation for " +
      (data.probationMonths > 0 ? data.probationMonths.toString() : "_") +
      " month(s) from the date of joining.",
    leftMargin,
    currentY,
  );
  currentY += lineHeight * 2.5;

  // Closing
  doc.text("Sincerely,", leftMargin, currentY);
  currentY += lineHeight * 2;

  doc.setDrawColor(139, 119, 42);
  doc.setLineWidth(0.3);
  doc.line(leftMargin, currentY, leftMargin + 50, currentY);
  currentY += lineHeight;
  doc.setFont("times", "bold");
  doc.text("Authorized Signatory", leftMargin, currentY);
  currentY += lineHeight;
  doc.setFont("times", "normal");
  doc.text(data.companyName, leftMargin, currentY);

  doc.save(
    data.employeeName
      ? "Job_Letter_" + data.employeeName.replace(/\s+/g, "_") + ".pdf"
      : "Job_Letter.pdf",
  );
}

function drawDecorativeBorder(
  doc: jsPDF,
  pageWidth: number,
  pageHeight: number,
  margin: number,
): void {
  // Outer gold border
  doc.setDrawColor(180, 160, 100);
  doc.setLineWidth(2);
  doc.rect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin);

  // Inner lighter border
  doc.setDrawColor(200, 180, 120);
  doc.setLineWidth(0.5);
  doc.rect(
    margin + 4,
    margin + 4,
    pageWidth - 2 * margin - 8,
    pageHeight - 2 * margin - 8,
  );

  // Corner flourishes
  const cornerSize = 15;
  doc.setDrawColor(180, 160, 100);
  doc.setLineWidth(1.2);

  // Top-left corner
  doc.line(margin + 6, margin + cornerSize, margin + 6, margin + 6);
  doc.line(margin + 6, margin + 6, margin + cornerSize, margin + 6);

  // Top-right corner
  doc.line(
    pageWidth - margin - 6,
    margin + cornerSize,
    pageWidth - margin - 6,
    margin + 6,
  );
  doc.line(
    pageWidth - margin - cornerSize,
    margin + 6,
    pageWidth - margin - 6,
    margin + 6,
  );

  // Bottom-left corner
  doc.line(
    margin + 6,
    pageHeight - margin - cornerSize,
    margin + 6,
    pageHeight - margin - 6,
  );
  doc.line(
    margin + 6,
    pageHeight - margin - 6,
    margin + cornerSize,
    pageHeight - margin - 6,
  );

  // Bottom-right corner
  doc.line(
    pageWidth - margin - 6,
    pageHeight - margin - cornerSize,
    pageWidth - margin - 6,
    pageHeight - margin - 6,
  );
  doc.line(
    pageWidth - margin - cornerSize,
    pageHeight - margin - 6,
    pageWidth - margin - 6,
    pageHeight - margin - 6,
  );

  // Corner diamonds
  doc.setFillColor(180, 160, 100);
  const diamondSize = 2;
  [
    [margin + 8, margin + 8],
    [pageWidth - margin - 8, margin + 8],
    [margin + 8, pageHeight - margin - 8],
    [pageWidth - margin - 8, pageHeight - margin - 8],
  ].forEach(([cx, cy]) => {
    doc.circle(cx, cy, diamondSize, "F");
  });
}
