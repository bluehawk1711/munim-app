import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { listInvoices, createInvoice, InvoiceError, type Invoice } from "@munim/core"
import { z } from "zod"

export const dynamic = "force-dynamic"

function serializeInvoice(inv: Invoice) {
  return {
    ...inv,
    date: inv.date.toISOString(),
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
    items: inv.items.map((i) => ({ ...i })),
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const { invoices, pagination } = await listInvoices(db, {
    search: searchParams.get("search")?.trim() || "",
    status: (searchParams.get("status") as never) || undefined,
    partyId: searchParams.get("partyId") || undefined,
    startDate: searchParams.get("startDate") || undefined,
    endDate: searchParams.get("endDate") || undefined,
    page: Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1),
    pageSize: Math.max(1, Math.min(200, parseInt(searchParams.get("pageSize") || "20", 10) || 20)),
  })
  return NextResponse.json({ invoices: invoices.map(serializeInvoice), pagination })
}

const invoiceItemSchema = z.object({
  productId: z.string().optional(),
  productName: z.string().min(1, "Item name is required"),
  sku: z.string().optional(),
  color: z.string().optional(),
  size: z.string().optional(),
  description: z.string().optional(),
  quantity: z.coerce.number().positive("Quantity must be positive"),
  price: z.coerce.number().min(0),
})

const invoiceSchema = z.object({
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerAddress: z.string().optional(),
  partyId: z.string().optional(),
  date: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, "At least one line item is required"),
  deliveryCharge: z.coerce.number().min(0).optional(),
  discount: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
  shopDetails: z.any().optional(),
  templateSettings: z.any().optional(),
  amountPaid: z.coerce.number().min(0).optional(),
  paymentMethod: z.string().optional(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const values = invoiceSchema.parse(body)
    const invoice = await createInvoice(db, values)
    return NextResponse.json(serializeInvoice(invoice!), { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input" }, { status: 400 })
    }
    if (err instanceof InvoiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error("Create invoice error:", err)
    return NextResponse.json({ error: "Failed to create invoice" }, { status: 500 })
  }
}
