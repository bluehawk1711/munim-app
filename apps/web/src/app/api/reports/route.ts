import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getReport, type ReportType } from "@munim/core"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const type = (searchParams.get("type") ?? "monthly") as ReportType
  const report = await getReport(
    db,
    type,
    searchParams.get("startDate") || undefined,
    searchParams.get("endDate") || undefined
  )

  const isLive = type === "stock" || type === "low_stock"
  return NextResponse.json(report, {
    headers: isLive
      ? { "Cache-Control": "no-store" }
      : { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
  })
}
