import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { deleteInvoice, InvoiceError } from "@munim/core"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params
    await deleteInvoice(db, id)
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof InvoiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error("Undo sale error:", err)
    return NextResponse.json({ error: "Failed to undo sale" }, { status: 500 })
  }
}
