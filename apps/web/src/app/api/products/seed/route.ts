import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { seedProducts } from "@munim/core"

export const dynamic = "force-dynamic"

export async function POST() {
  const result = await seedProducts(db)
  return NextResponse.json(result)
}
