"use client"

// Client-side export helpers for Excel (ExcelJS), CSV, and PDF (jsPDF + AutoTable).
// Heavy libraries are imported dynamically so they only load when an export runs.

import type { Product, ReportData } from "@/lib/types"
import { formatCurrency, formatNumber, formatDateTime, CURRENCY } from "@/lib/format"

const COMPANY = "StockPilot"
const COMPANY_SUB = "Inventory & Sales Management"

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function timestamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")
}

// ---------------- Excel (products) ----------------
export async function exportProductsToExcel(products: Product[]) {
  const ExcelJS = (await import("exceljs")).default
  const wb = new ExcelJS.Workbook()
  wb.creator = COMPANY
  wb.created = new Date()

  const ws = wb.addWorksheet("Products", {
    views: [{ state: "frozen", ySplit: 1 }],
  })

  ws.columns = [
    { header: "Product Name", key: "name", width: 28 },
    { header: "SKU", key: "sku", width: 16 },
    { header: "Color", key: "color", width: 12 },
    { header: "Size", key: "size", width: 12 },
    { header: "Stock", key: "stock", width: 10 },
    { header: "Purchase Price", key: "purchasePrice", width: 16 },
    { header: "Selling Price", key: "sellingPrice", width: 16 },
    { header: "Notes", key: "notes", width: 30 },
    { header: "Created", key: "createdAt", width: 20 },
  ]

  // Header style
  const headerRow = ws.getRow(1)
  headerRow.height = 22
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } }
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } }
  headerRow.alignment = { vertical: "middle", horizontal: "left" }
  headerRow.border = {
    bottom: { style: "thin", color: { argb: "FF0F766E" } },
  }

  products.forEach((p) => {
    const row = ws.addRow({
      name: p.name,
      sku: p.sku,
      color: p.color,
      size: p.size,
      stock: p.stock,
      purchasePrice: p.purchasePrice,
      sellingPrice: p.sellingPrice,
      notes: p.notes ?? "",
      createdAt: new Date(p.createdAt).toLocaleString(),
    })
    row.getCell("stock").alignment = { horizontal: "right" }
    row.getCell("purchasePrice").numFmt = `"${CURRENCY}"#,##0.00`
    row.getCell("sellingPrice").numFmt = `"${CURRENCY}"#,##0.00`
    if (p.stock <= 0) {
      row.getCell("stock").font = { color: { argb: "FFDC2626" }, bold: true }
    }
  })

  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: ws.columns.length },
  }

  const buffer = await wb.xlsx.writeBuffer()
  triggerDownload(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `products-${timestamp()}.xlsx`
  )
}

// ---------------- CSV (products) ----------------
export function exportProductsToCsv(products: Product[]) {
  const headers = ["Product Name", "SKU", "Color", "Size", "Stock", "Purchase Price", "Selling Price", "Notes", "Created"]
  const rows = products.map((p) =>
    [
      p.name,
      p.sku,
      p.color,
      p.size,
      p.stock,
      p.purchasePrice,
      p.sellingPrice,
      p.notes ?? "",
      new Date(p.createdAt).toISOString(),
    ]
      .map((v) => {
        const s = String(v ?? "")
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
      })
      .join(",")
  )
  const csv = [headers.join(","), ...rows].join("\n")
  triggerDownload(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `products-${timestamp()}.csv`)
}

// ---------------- Excel (report) ----------------
export async function exportReportToExcel(report: ReportData) {
  const ExcelJS = (await import("exceljs")).default
  const wb = new ExcelJS.Workbook()
  wb.creator = COMPANY
  wb.created = new Date()

  const ws = wb.addWorksheet(report.title.slice(0, 28), {
    views: [{ state: "frozen", ySplit: 5 }],
  })

  // Title block
  ws.mergeCells("A1:G1")
  const title = ws.getCell("A1")
  title.value = COMPANY
  title.font = { bold: true, size: 16, color: { argb: "FF0F766E" } }
  title.alignment = { horizontal: "left", vertical: "middle" }
  ws.getRow(1).height = 24

  ws.mergeCells("A2:G2")
  const sub = ws.getCell("A2")
  sub.value = report.title
  sub.font = { bold: true, size: 13 }

  ws.mergeCells("A3:G3")
  ws.getCell("A3").value = `Period: ${report.periodLabel}`

  ws.mergeCells("A4:G4")
  ws.getCell("A4").value = `Generated: ${formatDateTime(report.generatedAt)}`
  ws.getCell("A4").font = { italic: true, color: { argb: "FF6B7280" } }

  // Header row (row 6)
  ws.columns = [
    { header: "Product Name", key: "productName", width: 30 },
    { header: "SKU", key: "sku", width: 16 },
    { header: "Color", key: "color", width: 12 },
    { header: "Size", key: "size", width: 12 },
    { header: "Stock", key: "stock", width: 10 },
    { header: "Sold Qty", key: "soldQuantity", width: 12 },
    { header: "Revenue", key: "revenue", width: 16 },
  ]

  const headerRow = ws.getRow(6)
  headerRow.height = 22
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } }
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } }
  headerRow.alignment = { vertical: "middle" }

  report.rows.forEach((r) => {
    const row = ws.addRow({
      productName: r.productName,
      sku: r.sku,
      color: r.color,
      size: r.size,
      stock: r.stock,
      soldQuantity: r.soldQuantity,
      revenue: r.revenue,
    })
    row.getCell("stock").alignment = { horizontal: "right" }
    row.getCell("soldQuantity").alignment = { horizontal: "right" }
    row.getCell("revenue").numFmt = `"${CURRENCY}"#,##0.00`
    row.getCell("revenue").alignment = { horizontal: "right" }
  })

  // Totals
  const totalRow = ws.addRow({
    productName: "TOTAL",
    stock: report.totals.stock,
    soldQuantity: report.totals.soldQuantity,
    revenue: report.totals.revenue,
  })
  totalRow.font = { bold: true }
  totalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6F4F1" } }
  totalRow.getCell("stock").alignment = { horizontal: "right" }
  totalRow.getCell("soldQuantity").alignment = { horizontal: "right" }
  totalRow.getCell("revenue").numFmt = `"${CURRENCY}"#,##0.00`
  totalRow.getCell("revenue").alignment = { horizontal: "right" }

  const buffer = await wb.xlsx.writeBuffer()
  triggerDownload(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${report.type}-report-${timestamp()}.xlsx`
  )
}

// ---------------- PDF (report) ----------------
export async function exportReportToPdf(report: ReportData) {
  const { jsPDF } = await import("jspdf")
  const autoTable = (await import("jspdf-autotable")).default

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()

  const drawHeader = () => {
    // Company title
    doc.setFont("helvetica", "bold")
    doc.setFontSize(18)
    doc.setTextColor(15, 118, 110)
    doc.text(COMPANY, 40, 40)

    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(107, 114, 128)
    doc.text(COMPANY_SUB, 40, 54)

    // Report title
    doc.setFont("helvetica", "bold")
    doc.setFontSize(13)
    doc.setTextColor(31, 41, 55)
    doc.text(report.title, pageWidth - 40, 40, { align: "right" })

    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(107, 114, 128)
    doc.text(`Period: ${report.periodLabel}`, pageWidth - 40, 54, { align: "right" })
    doc.text(`Generated: ${formatDateTime(report.generatedAt)}`, pageWidth - 40, 66, { align: "right" })

    doc.setDrawColor(15, 118, 110)
    doc.setLineWidth(1)
    doc.line(40, 74, pageWidth - 40, 74)
  }

  drawHeader()

  autoTable(doc, {
    startY: 86,
    head: [["Product Name", "SKU", "Color", "Size", "Stock", "Sold Qty", "Revenue"]],
    body: report.rows.map((r) => [
      r.productName,
      r.sku,
      r.color,
      r.size,
      formatNumber(r.stock),
      formatNumber(r.soldQuantity),
      formatCurrency(r.revenue),
    ]),
    foot: [[
      "TOTAL",
      "",
      "",
      "",
      formatNumber(report.totals.stock),
      formatNumber(report.totals.soldQuantity),
      formatCurrency(report.totals.revenue),
    ]],
    theme: "striped",
    headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: [31, 41, 55] },
    footStyles: { fillColor: [230, 244, 241], textColor: [15, 118, 110], fontStyle: "bold", fontSize: 9 },
    alternateRowStyles: { fillColor: [247, 250, 250] },
    columnStyles: {
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
    },
    margin: { left: 40, right: 40 },
    didDrawPage: () => {
      const pageCount = doc.getNumberOfPages()
      const currentPage = doc.getCurrentPageInfo().pageNumber
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8)
      doc.setTextColor(107, 114, 128)
      doc.text(
        `Page ${currentPage} of ${pageCount}`,
        pageWidth - 40,
        doc.internal.pageSize.getHeight() - 20,
        { align: "right" }
      )
      doc.text(
        `Confidential · ${COMPANY}`,
        40,
        doc.internal.pageSize.getHeight() - 20
      )
    },
  })

  doc.save(`${report.type}-report-${timestamp()}.pdf`)
}
