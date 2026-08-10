import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { listProducts, createProduct, ProductError } from "@munim/core"
import { productSchema } from "@/lib/validators"
import { serializeProduct } from "@/lib/serialize"
import { z } from "zod"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const filters = {
    search: searchParams.get("search")?.trim() || "",
    color: searchParams.get("color") || undefined,
    size: searchParams.get("size") || undefined,
    category: searchParams.get("category") || undefined,
    status: (searchParams.get("status") as never) || undefined,
    page: Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1),
    pageSize: Math.max(1, Math.min(1000, parseInt(searchParams.get("pageSize") || "20", 10) || 20)),
  }

  const { products, pagination } = await listProducts(db, filters)
  return NextResponse.json({
    products: products.map(serializeProduct),
    pagination,
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const values = productSchema.parse(body)
    const product = await createProduct(db, values)
    return NextResponse.json(serializeProduct(product as never), { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input" }, { status: 400 })
    }
    if (err instanceof ProductError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error("Create product error:", err)
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 })
  }
}
