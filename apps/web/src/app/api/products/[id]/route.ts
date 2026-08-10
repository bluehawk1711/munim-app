import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getProduct, updateProduct, deleteProduct, ProductError } from "@munim/core"
import { productSchema } from "@/lib/validators"
import { serializeProduct } from "@/lib/serialize"
import { destroyImageByUrl } from "@/lib/cloudinary"
import { z } from "zod"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const product = await getProduct(db, id)
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 })
  return NextResponse.json(serializeProduct(product as never))
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const body: unknown = await request.json()
    const values = productSchema.parse(body)
    const product = await updateProduct(db, id, values)
    return NextResponse.json(serializeProduct(product as never))
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input" }, { status: 400 })
    }
    if (err instanceof ProductError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error("Update product error:", err)
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params
    const existing = await getProduct(db, id)
    if (!existing) return NextResponse.json({ error: "Product not found" }, { status: 404 })
    await destroyImageByUrl(existing.imageUrl)
    await deleteProduct(db, id)
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof ProductError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error("Delete product error:", err)
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 })
  }
}
