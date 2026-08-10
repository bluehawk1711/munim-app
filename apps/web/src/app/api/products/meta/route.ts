import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { listMeta } from "@munim/core"

export const dynamic = "force-dynamic"

export async function GET() {
  const meta = await listMeta(db)
  return NextResponse.json(meta)
}
