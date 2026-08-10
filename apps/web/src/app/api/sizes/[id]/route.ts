import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { schema, eq, sql } from "@munim/core"
import { z } from "zod"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

const nameSchema = z
  .string()
  .min(1, "Name is required")
  .max(40, "Name must be 40 characters or less")
  .transform((s) => s.trim())

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const body: unknown = await request.json()
    const { name } = z.object({ name: nameSchema }).parse(body)

    const existing = await db.select().from(schema.sizes).where(eq(schema.sizes.id, id))
    if (!existing[0]) return NextResponse.json({ error: "Size not found" }, { status: 404 })

    const dup = await db.select().from(schema.sizes).where(eq(schema.sizes.name, name))
    if (dup[0] && dup[0].id !== id) {
      return NextResponse.json({ error: `Size "${name}" already exists` }, { status: 409 })
    }

    const updated = await db
      .update(schema.sizes)
      .set({ name })
      .where(eq(schema.sizes.id, id))
      .returning()
    return NextResponse.json(updated[0])
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input" }, { status: 400 })
    }
    console.error("Update size error:", err)
    return NextResponse.json({ error: "Failed to update size" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params
    const size = await db.select().from(schema.sizes).where(eq(schema.sizes.id, id))
    if (!size[0]) return NextResponse.json({ error: "Size not found" }, { status: 404 })

    const inUse = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.products)
      .where(eq(schema.products.sizeId, id))
    if ((inUse[0]?.count ?? 0) > 0) {
      return NextResponse.json(
        { error: `Cannot delete "${size[0].name}" — it is used by ${inUse[0]?.count} product(s).` },
        { status: 400 }
      )
    }

    await db.delete(schema.sizes).where(eq(schema.sizes.id, id))
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Delete size error:", err)
    return NextResponse.json({ error: "Failed to delete size" }, { status: 500 })
  }
}
