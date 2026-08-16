import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { backfillBarcodes } from "@munim/core"

export const dynamic = "force-dynamic"

/**
 * Assigns generated EAN-13 barcodes to every product that doesn't have one.
 * Safe backfill — products with an existing barcode are never touched.
 */
export async function POST() {
  try {
    const result = await backfillBarcodes(db)
    return NextResponse.json(result)
  } catch (err) {
    console.error("Backfill barcodes error:", err)
    return NextResponse.json({ error: "Failed to backfill barcodes" }, { status: 500 })
  }
}
