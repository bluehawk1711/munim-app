import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { adjustStock, ProductError, stockAdjustmentSchema, serializeProduct } from "@munim/core"
import { z } from "zod"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const body: unknown = await request.json()
    const values = stockAdjustmentSchema.parse(body)
    const product = await adjustStock(db, id, values)
    return NextResponse.json(serializeProduct(product as never))
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input" }, { status: 400 })
    }
    if (err instanceof ProductError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error("Stock adjustment error:", err)
    return NextResponse.json({ error: "Failed to adjust stock" }, { status: 500 })
  }
}
