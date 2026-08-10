import { jsPDF } from "jspdf";
import type { BillDocument } from "@munim/core";

const MONEY = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Renders the shared BillDocument (built by @munim/core) to a printable PDF.
 * The numbers, totals and amount-in-words come from core, so every app that
 * exports a bill shows the SAME bill — only this renderer differs per platform.
 */
export function downloadBillPdf(bill: BillDocument): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = 44;

  // ── Header: shop details (left) + bill meta (right)
  doc.setFillColor(10, 20, 40);
  doc.rect(0, 0, pageWidth, 72, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(bill.shop.name, margin, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(200, 210, 225);
  const shopLines = [
    bill.shop.address ?? "",
    `Ph: ${bill.shop.phones.join(", ")}${bill.shop.email ? `  |  ${bill.shop.email}` : ""}`,
  ].filter((l) => l !== "");
  shopLines.forEach((line, i) => doc.text(line, margin, 54 + i * 12));
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`INVOICE / BILL`, pageWidth - margin, 34, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`No: ${bill.billNo}`, pageWidth - margin, 50, { align: "right" });
  doc.text(`Date: ${bill.date}`, pageWidth - margin, 64, { align: "right" });
  y = 92;

  // ── Customer
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20, 30, 50);
  doc.text("BILL TO", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(bill.customerName ?? "Walk-in Customer", margin, y + 14);
  if (bill.customerAddress) doc.text(bill.customerAddress, margin, y + 26);
  if (bill.customerPhone) doc.text(`Ph: ${bill.customerPhone}`, margin, y + 38);
  y += 56;

  // ── Items table
  const colX = [margin, pageWidth - margin - 320, pageWidth - margin - 240, pageWidth - margin - 150, pageWidth - margin - 60, pageWidth - margin];
  const headers = ["#", "Item", "SKU", "Qty", "Rate", "Amount"];
  doc.setFillColor(245, 247, 250);
  doc.rect(margin, y - 14, pageWidth - margin * 2, 20, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  headers.forEach((h, i) => doc.text(h, colX[i] ?? margin, y - 2, { align: i === 0 ? "left" : "right" }));

  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  bill.lines.forEach((line, i) => {
    if (y > 720) {
      doc.addPage();
      y = 60;
    }
    doc.setFillColor(i % 2 === 0 ? 255 : 250, i % 2 === 0 ? 255 : 250, i % 2 === 0 ? 255 : 250);
    doc.rect(margin, y - 10, pageWidth - margin * 2, 18, "F");
    doc.setTextColor(20, 30, 50);
    doc.text(String(i + 1), colX[0] ?? margin, y);
    const name = line.productName.length > 26 ? `${line.productName.slice(0, 26)}…` : line.productName;
    doc.text(name, colX[1] ?? margin, y, { align: "right" });
    doc.text(line.sku ?? "", colX[2] ?? margin, y, { align: "right" });
    doc.text(String(line.quantity), colX[3] ?? margin, y, { align: "right" });
    doc.text(MONEY(line.price), colX[4] ?? margin, y, { align: "right" });
    doc.text(MONEY(line.total), colX[5] ?? margin, y, { align: "right" });
    y += 18;
  });

  // ── Totals
  y += 8;
  const totalX = pageWidth - margin - 150;
  const extraRows: [string, string][] = [
    ...(bill.discount > 0 ? ([["Discount", `- ${MONEY(bill.discount)}`]] as [string, string][]) : []),
    ...(bill.deliveryCharge > 0 ? ([["Delivery", `+ ${MONEY(bill.deliveryCharge)}`]] as [string, string][]) : []),
  ];
  const rows: [string, string][] = [["Subtotal", MONEY(bill.subtotal)], ...extraRows];
  doc.setFontSize(10);
  rows.forEach(([label, value]) => {
    doc.setTextColor(90, 100, 115);
    doc.text(label, totalX, y);
    doc.text(value, pageWidth - margin, y, { align: "right" });
    y += 16;
  });
  doc.setDrawColor(210, 215, 225);
  doc.line(totalX, y - 6, pageWidth - margin, y - 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(10, 20, 40);
  doc.text("TOTAL", totalX, y + 2);
  doc.text(MONEY(bill.total), pageWidth - margin, y + 2, { align: "right" });
  y += 24;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 100, 115);
  doc.text(`Amount paid: ${MONEY(bill.amountPaid)}   |   Due: ${MONEY(bill.dueAmount)}   |   Status: ${bill.status}`, totalX, y);
  y += 26;

  // ── Amount in words
  doc.setFontSize(10);
  doc.setTextColor(20, 30, 50);
  doc.setFont("helvetica", "bold");
  doc.text("Amount in words:", margin, y);
  doc.setFont("helvetica", "normal");
  const words = doc.splitTextToSize(bill.amountInWords, pageWidth - margin * 2) as string[];
  doc.text(words, margin, y + 16);
  y += 16 + words.length * 12 + 20;

  // ── Footer
  doc.setFontSize(9);
  doc.setTextColor(120, 130, 145);
  doc.text(`Generated by Munim — ${new Date().toLocaleString("en-IN")}`, margin, 800);
  doc.text("Thank you for your business!", pageWidth - margin, 800, { align: "right" });

  doc.save(`${bill.billNo}.pdf`);
}
