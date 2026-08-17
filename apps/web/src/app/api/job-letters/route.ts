import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { listJobLetters, saveJobLetter, jobLetterSchema, serializeJobLetter } from "@munim/core"
import { z } from "zod"

export const dynamic = "force-dynamic"

export async function GET() {
  const letters = await listJobLetters(db)
  return NextResponse.json(letters.map(serializeJobLetter))
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json()
    const values = jobLetterSchema.parse(body)
    const letter = await saveJobLetter(db, values)
    return NextResponse.json(serializeJobLetter(letter), { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input" }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to save job letter" }, { status: 500 })
  }
}
