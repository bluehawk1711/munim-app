import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { listPayments, recordPayment, AdvanceError } from "@munim/core"
import { z } from "zod"

export const dynamic = "force-dynamic"

function serializePayment(p: { date: Date; createdAt: Date }) {
  return { ...p, date: p.date.toISOString(), createdAt: p.createdAt.toISOString() }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const partyId = searchParams.get("partyId") || undefined
  const payments = await listPayments(db, partyId)
  return NextResponse.json(payments.map(serializePayment))
}

const paymentSchema = z.object({
  partyId: z.string().optional(),
  direction: z.enum(["IN", "OUT"]),
  amount: z.coerce.number().positive("Amount must be positive"),
  method: z.string().max(40).optional(),
  date: z.string().optional(),
  note: z.string().max(300).optional().or(z.literal("")),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const values = paymentSchema.parse(body)
    const payment = await recordPayment(db, values)
    if (!payment) throw new AdvanceError("Failed to record payment", "CREATE_FAILED", 500)
    return NextResponse.json(serializePayment(payment), { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input" }, { status: 400 })
    }
    if (err instanceof AdvanceError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to record payment" }, { status: 500 })
  }
}
