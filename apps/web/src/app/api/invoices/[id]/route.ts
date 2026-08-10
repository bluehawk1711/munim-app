import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getInvoice, deleteInvoice, InvoiceError } from "@munim/core"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const invoice = await getInvoice(db, id)
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  return NextResponse.json({
    ...invoice,
    date: invoice.date.toISOString(),
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
  })
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params
    await deleteInvoice(db, id)
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof InvoiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to delete invoice" }, { status: 500 })
  }
}
