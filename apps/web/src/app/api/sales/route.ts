import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { createSale, listInvoices, InvoiceError, type Invoice } from "@munim/core"
import { saleSchema } from "@/lib/validators"
import { z } from "zod"
import type { Sale } from "@/lib/types"

export const dynamic = "force-dynamic"

/** Maps core invoices + items into the flattened Sale DTO the UI expects. */
function toSaleDto(invoice: Invoice): Sale {
  const item = invoice.items[0]
  return {
    id: invoice.id,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    productId: item?.productId ?? null,
    productName: item?.productName ?? invoice.customerName ?? "—",
    sku: item?.sku ?? null,
    color: item?.color ?? null,
    size: item?.size ?? null,
    quantity: item?.quantity ?? 0,
    sellingPrice: item?.price ?? invoice.total,
    total: invoice.total,
    status: invoice.status,
    createdAt: invoice.createdAt.toISOString(),
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const { invoices } = await listInvoices(db, {
    search: searchParams.get("search")?.trim() || "",
    startDate: searchParams.get("startDate") || undefined,
    endDate: searchParams.get("endDate") || undefined,
    pageSize: 500,
  })
  return NextResponse.json(invoices.map(toSaleDto))
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const values = saleSchema.parse(body)
    const invoice = await createSale(db, {
      productId: values.productId,
      quantity: values.quantity,
      sellingPrice: values.sellingPrice,
      paid: true,
      paymentMethod: "cash",
    })
    return NextResponse.json(toSaleDto(invoice!), { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input" }, { status: 400 })
    }
    if (err instanceof InvoiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error("Create sale error:", err)
    return NextResponse.json({ error: "Failed to complete sale" }, { status: 500 })
  }
}
