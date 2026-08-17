import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import {
  deleteCatalogItem,
  renameCatalogItem,
  ProductError,
  type CatalogKind,
} from "@munim/core"
import { z } from "zod"

export const dynamic = "force-dynamic"

const KIND_SCHEMA = z.enum(["color", "size", "category"])

const nameSchema = z
  .string()
  .min(1, "Name is required")
  .max(40, "Name must be 40 characters or less")
  .transform((s) => s.trim())

type Params = { params: Promise<{ kind: string; id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const { kind, id } = await params
  const parsed = KIND_SCHEMA.safeParse(kind)
  if (!parsed.success) {
    return NextResponse.json({ error: "Unknown catalog kind" }, { status: 400 })
  }
  try {
    const body: unknown = await request.json()
    const { name } = z.object({ name: nameSchema }).parse(body)
    const updated = await renameCatalogItem(db, parsed.data as CatalogKind, id, name)
    return NextResponse.json(updated)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input" }, { status: 400 })
    }
    if (err instanceof ProductError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error("Rename catalog item error:", err)
    return NextResponse.json({ error: "Failed to rename catalog item" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { kind, id } = await params
  const parsed = KIND_SCHEMA.safeParse(kind)
  if (!parsed.success) {
    return NextResponse.json({ error: "Unknown catalog kind" }, { status: 400 })
  }
  try {
    return NextResponse.json(await deleteCatalogItem(db, parsed.data as CatalogKind, id))
  } catch (err) {
    if (err instanceof ProductError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error("Delete catalog item error:", err)
    return NextResponse.json({ error: "Failed to delete catalog item" }, { status: 500 })
  }
}
