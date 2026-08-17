import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { createSale, listInvoices, InvoiceError, type Invoice, type InvoiceItem, saleSchema } from "@munim/core"
import { z } from "zod"
import type { Sale } from "@/lib/types"

export const dynamic = "force-dynamic"

type InvoiceWithItems = Invoice & { items: InvoiceItem[] }

/** Maps core invoices + items into the flattened Sale DTO the UI expects. */
function toSaleDto(invoice: InvoiceWithItems): Sale {
  const item = (invoice.items ?? [])[0]
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

const INVOICE_STATUSES = ["DRAFT", "UNPAID", "PARTIAL", "PAID"] as const;

function statusParam(value: string | null): "DRAFT" | "UNPAID" | "PARTIAL" | "PAID" | undefined {
  return INVOICE_STATUSES.find((s) => s === value);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const { invoices } = await listInvoices(db, {
    search: searchParams.get("search")?.trim() || "",
    status: statusParam(searchParams.get("status")),
    startDate: searchParams.get("startDate") || undefined,
    endDate: searchParams.get("endDate") || undefined,
    pageSize: 500,
  })
  return NextResponse.json(invoices.map((i) => toSaleDto(i)))
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json()
    const values = saleSchema.parse(body)
    const invoice = await createSale(db, {
      productId: values.productId,
      quantity: values.quantity,
      paid: true,
      paymentMethod: "cash",
    })
    if (!invoice) throw new InvoiceError("Failed to create sale", "CREATE_FAILED", 500)
    return NextResponse.json(toSaleDto(invoice as InvoiceWithItems), { status: 201 })
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
