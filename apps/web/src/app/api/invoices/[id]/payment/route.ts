import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { recordInvoicePayment, InvoiceError } from "@munim/core"
import { z } from "zod"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

const paymentSchema = z.object({
  amount: z.coerce.number().positive("Payment amount must be positive"),
  method: z.string().optional(),
  date: z.string().optional(),
  note: z.string().optional(),
})

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = await request.json()
    const values = paymentSchema.parse(body)
    const invoice = await recordInvoicePayment(db, id, values)
    if (!invoice) throw new InvoiceError("Invoice not found", "NOT_FOUND", 404)
    return NextResponse.json({
      ...invoice,
      date: invoice.date.toISOString(),
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input" }, { status: 400 })
    }
    if (err instanceof InvoiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to record payment" }, { status: 500 })
  }
}
