import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { findProductByBarcode } from "@munim/core"
import { serializeProduct } from "@/lib/serialize"

export const dynamic = "force-dynamic"

/**
 * Fast exact barcode lookup (indexed) — the shop-counter path. Returns the
 * product immediately or a 404. Scanners (camera + USB) hit this route.
 */
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("barcode") ?? ""
  if (!code.trim()) {
    return NextResponse.json({ error: "Missing barcode" }, { status: 400 })
  }
  const product = await findProductByBarcode(db, code)
  if (!product) {
    return NextResponse.json({ error: "No product with that barcode" }, { status: 404 })
  }
  return NextResponse.json(serializeProduct(product as never))
}
