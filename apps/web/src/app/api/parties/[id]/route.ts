import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { updateParty, deleteParty, getPartyLedger, PartyError } from "@munim/core"
import { eq } from "drizzle-orm"
import { schema } from "@munim/core"
import { z } from "zod"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const party = await db.query.parties.findFirst({ where: eq(schema.parties.id, id) })
  if (!party) return NextResponse.json({ error: "Party not found" }, { status: 404 })
  const ledger = await getPartyLedger(db, id)
  return NextResponse.json({
    party: { ...party, createdAt: party.createdAt.toISOString() },
    ledger: {
      ...ledger,
      lines: ledger.lines.map((l) => ({ ...l, date: l.date.toISOString() })),
    },
  })
}

const partySchema = z.object({
  name: z.string().min(1).max(120).optional(),
  phone: z.string().max(40).optional().or(z.literal("")),
  email: z.string().max(200).optional().or(z.literal("")),
  address: z.string().max(300).optional().or(z.literal("")),
  type: z.enum(["CUSTOMER", "SUPPLIER", "WORKER", "OTHER"]).optional(),
  notes: z.string().max(500).optional().or(z.literal("")),
})

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = await request.json()
    const values = partySchema.parse(body)
    const party = await updateParty(db, id, values)
    return NextResponse.json({ ...party, createdAt: party.createdAt.toISOString() })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input" }, { status: 400 })
    }
    if (err instanceof PartyError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to update party" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params
    await deleteParty(db, id)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: "Failed to delete party" }, { status: 500 })
  }
}
