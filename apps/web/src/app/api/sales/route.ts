import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { createSale, listInvoices, InvoiceError, serializeSale, saleSchema } from "@munim/core"
import { z } from "zod"

export const dynamic = "force-dynamic"

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
  return NextResponse.json(invoices.map((i) => serializeSale(i)))
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
    return NextResponse.json(serializeSale(invoice), { status: 201 })
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
