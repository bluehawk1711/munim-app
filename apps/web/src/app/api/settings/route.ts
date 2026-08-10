import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSettings, updateSettings } from "@munim/core"

export const dynamic = "force-dynamic"

export async function GET() {
  const settings = await getSettings(db)
  return NextResponse.json(settings)
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const settings = await updateSettings(db, body)
    return NextResponse.json(settings)
  } catch (err) {
    console.error("Update settings error:", err)
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 })
  }
}
