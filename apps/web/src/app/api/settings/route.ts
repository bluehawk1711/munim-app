import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSettings, updateSettings, type ShopSettingsInput } from "@munim/core"

export const dynamic = "force-dynamic"

export async function GET() {
  const settings = await getSettings(db)
  return NextResponse.json(settings)
}

export async function PUT(request: Request) {
  try {
    const body: unknown = await request.json()
    // JSON boundary cast — updateSettings only picks the keys it knows; this is
    // the single entry point (sanctioned exception, see AGENTS.md).
    const settings = await updateSettings(db, body as ShopSettingsInput)
    return NextResponse.json(settings)
  } catch (err) {
    console.error("Update settings error:", err)
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 })
  }
}
