import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { listParties, createParty, getPartyBalances, getReceivables, getPayables, PartyError } from "@munim/core"
import { z } from "zod"

export const dynamic = "force-dynamic"

function serializeParty(p: { createdAt: Date }) {
  return { ...p, createdAt: p.createdAt.toISOString() }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type") || undefined
  const search = searchParams.get("search")?.trim() || undefined
  const withBalances = searchParams.get("balances") === "true"

  if (withBalances) {
    const [balances, receivables, payables] = await Promise.all([
      getPartyBalances(db),
      getReceivables(db),
      getPayables(db),
    ])
    return NextResponse.json({
      balances: balances.map(serializeParty),
      receivables: receivables.map(serializeParty),
      payables: payables.map(serializeParty),
    })
  }

  const parties = await listParties(db, type, search)
  return NextResponse.json(parties.map(serializeParty))
}

const partySchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  phone: z.string().max(40).optional().or(z.literal("")),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  address: z.string().max(300).optional().or(z.literal("")),
  type: z.enum(["CUSTOMER", "SUPPLIER", "WORKER", "OTHER"]).optional(),
  notes: z.string().max(500).optional().or(z.literal("")),
})

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json()
    const values = partySchema.parse(body)
    const party = await createParty(db, values)
    return NextResponse.json(serializeParty(party), { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input" }, { status: 400 })
    }
    if (err instanceof PartyError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: "Failed to create party" }, { status: 500 })
  }
}
