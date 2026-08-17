import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { listInvoices, createInvoice, InvoiceError, invoiceSchema, serializeInvoice, type Invoice, type InvoiceItem } from "@munim/core"
import { z } from "zod"

export const dynamic = "force-dynamic"

type InvoiceWithItems = Invoice & { items: InvoiceItem[] }

const INVOICE_STATUSES = ["DRAFT", "UNPAID", "PARTIAL", "PAID"] as const

function statusParam(value: string | null): "DRAFT" | "UNPAID" | "PARTIAL" | "PAID" | undefined {
  return INVOICE_STATUSES.find((s) => s === value)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const result = await listInvoices(db, {
    search: searchParams.get("search")?.trim() || "",
    status: statusParam(searchParams.get("status")),
    partyId: searchParams.get("partyId") || undefined,
    startDate: searchParams.get("startDate") || undefined,
    endDate: searchParams.get("endDate") || undefined,
    page: Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1),
    pageSize: Math.max(1, Math.min(200, parseInt(searchParams.get("pageSize") || "20", 10) || 20)),
  })
  return NextResponse.json({
    invoices: result.invoices.map((i) => serializeInvoice(i)),
    pagination: result.pagination,
  })
}


export async function POST(request: Request) {
  try {
    const body: unknown = await request.json()
    const values = invoiceSchema.parse(body)
    const invoice = await createInvoice(db, values)
    if (!invoice) throw new InvoiceError("Failed to create invoice", "CREATE_FAILED", 500)
    return NextResponse.json(serializeInvoice(invoice), { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input" }, { status: 400 })
    }
    if (err instanceof InvoiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error("Create invoice error:", err)
    return NextResponse.json({ error: "Failed to create invoice" }, { status: 500 })
  }
}
