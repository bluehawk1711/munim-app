import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { deleteCatalogItem, renameCatalogItem, ProductError } from "@munim/core"
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
    const updated = await renameCatalogItem(db, "size", id, name)
    return NextResponse.json(updated)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input" }, { status: 400 })
    }
    if (err instanceof ProductError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error("Update size error:", err)
    return NextResponse.json({ error: "Failed to update size" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params
    return NextResponse.json(await deleteCatalogItem(db, "size", id))
  } catch (err) {
    if (err instanceof ProductError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error("Delete size error:", err)
    return NextResponse.json({ error: "Failed to delete size" }, { status: 500 })
  }
}
