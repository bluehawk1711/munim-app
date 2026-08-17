import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import {
  createCatalogItem,
  listCatalogItems,
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

type Params = { params: Promise<{ kind: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { kind } = await params
  const parsed = KIND_SCHEMA.safeParse(kind)
  if (!parsed.success) {
    return NextResponse.json({ error: "Unknown catalog kind" }, { status: 400 })
  }
  return NextResponse.json(await listCatalogItems(db, parsed.data as CatalogKind))
}

export async function POST(request: Request, { params }: Params) {
  const { kind } = await params
  const parsed = KIND_SCHEMA.safeParse(kind)
  if (!parsed.success) {
    return NextResponse.json({ error: "Unknown catalog kind" }, { status: 400 })
  }
  try {
    const body: unknown = await request.json()
    const { name } = z.object({ name: nameSchema }).parse(body)
    const item = await createCatalogItem(db, parsed.data as CatalogKind, name)
    return NextResponse.json(item, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input" }, { status: 400 })
    }
    if (err instanceof ProductError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error("Create catalog item error:", err)
    return NextResponse.json({ error: "Failed to create catalog item" }, { status: 500 })
  }
}
