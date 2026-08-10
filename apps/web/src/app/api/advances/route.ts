import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { listAdvances, createAdvance, listPayments, recordPayment, AdvanceError } from "@munim/core"
import { z } from "zod"

export const dynamic = "force-dynamic"

function serializeAdvance(a: { date: Date; createdAt: Date }) {
  return { ...a, date: a.date.toISOString(), createdAt: a.createdAt.toISOString() }
}

type AdvanceLike = { date: Date; createdAt: Date }

function toIso(a: AdvanceLike) {
  return { ...a, date: a.date.toISOString(), createdAt: a.createdAt.toISOString() }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const partyId = searchParams.get("partyId") || undefined
  const advances = await listAdvances(db, partyId)
  return NextResponse.json(advances.map(serializeAdvance))
}

const advanceSchema = z.object({
  partyId: z.string().min(1, "Please select a party"),
  direction: z.enum(["GIVEN", "TAKEN"]),
  amount: z.coerce.number().positive("Amount must be positive"),
  date: z.string().optional(),
  note: z.string().max(300).optional().or(z.literal("")),
})

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json()
    const values = advanceSchema.parse(body)
    const advance = await createAdvance(db, values)
    if (!advance) throw new AdvanceError("Failed to create advance", "CREATE_FAILED", 500)
    return NextResponse.json(toIso(advance), { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input" }, { status: 400 })
    }
    if (err instanceof AdvanceError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to record advance" }, { status: 500 })
  }
}
