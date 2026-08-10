import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { addSize, listMeta, ProductError } from "@munim/core"
import { z } from "zod"

export const dynamic = "force-dynamic"

const nameSchema = z
  .string()
  .min(1, "Name is required")
  .max(40, "Name must be 40 characters or less")
  .transform((s) => s.trim())

export async function GET() {
  const meta = await listMeta(db)
  return NextResponse.json(meta.sizes.map((name) => ({ id: name, name })))
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json()
    const { name } = z.object({ name: nameSchema }).parse(body)
    const size = await addSize(db, name)
    return NextResponse.json(size, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input" }, { status: 400 })
    }
    if (err instanceof ProductError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error("Create size error:", err)
    return NextResponse.json({ error: "Failed to create size" }, { status: 500 })
  }
}
