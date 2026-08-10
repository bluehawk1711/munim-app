import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getDashboard } from "@munim/core"
import { getPartyBalances } from "@munim/core"
import type { DashboardStats } from "@/lib/types"

export const dynamic = "force-dynamic"

export async function GET() {
  const data = await getDashboard(db)
  // Real receivables/payables come from the party ledger (advances + unpaid invoices)
  const balances = await getPartyBalances(db)
  const receivables = balances.filter((b) => b.balance > 0.001).reduce((s, b) => s + b.balance, 0)
  const payables = balances.filter((b) => b.balance < -0.001).reduce((s, b) => s + Math.abs(b.balance), 0)

  const stats: DashboardStats = {
    ...data,
    receivables,
    payables,
    recentInvoices: data.recentInvoices.map((inv) => ({
      ...inv,
      date: inv.date.toISOString(),
      createdAt: inv.createdAt.toISOString(),
    })),
    recentActivity: data.recentActivity.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
    recentAdvances: data.recentAdvances.map((a) => ({
      ...a,
      date: a.date.toISOString(),
      createdAt: a.createdAt.toISOString(),
    })),
  }

  return NextResponse.json(stats)
}
