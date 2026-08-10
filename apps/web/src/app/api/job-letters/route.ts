import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { listJobLetters, saveJobLetter } from "@munim/core"
import { z } from "zod"

export const dynamic = "force-dynamic"

function serializeLetter(l: { createdAt: Date }) {
  return { ...l, createdAt: l.createdAt.toISOString() }
}

export async function GET() {
  const letters = await listJobLetters(db)
  return NextResponse.json(letters.map(serializeLetter))
}

const jobLetterSchema = z.object({
  title: z.string().min(1, "Title is required"),
  employeeName: z.string().optional(),
  position: z.string().optional(),
  monthlySalary: z.coerce.number().min(0).optional(),
  data: z.any(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const values = jobLetterSchema.parse(body)
    const letter = await saveJobLetter(db, values)
    return NextResponse.json(serializeLetter(letter), { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input" }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to save job letter" }, { status: 500 })
  }
}
