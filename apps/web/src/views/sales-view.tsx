"use client"

import * as React from "react"
import {
  Search,
  X,
  Receipt,
  IndianRupee,
  ShoppingCart,
  TrendingUp,
  Undo2,
  AlertTriangle,
  Loader2,
  Plus,
} from "lucide-react"
import { Button, Input, Card, CardContent, Skeleton, Badge, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@munim/ui"







import { SalesTable } from "@/components/sales/sales-table"
import { useSales, useUndoSale } from "@/hooks/use-sales"
import { useAppStore } from "@/store/view-store"
import { formatCurrency, formatNumber } from "@/lib/format"
import type { Sale } from "@/lib/types"
import { toast } from "sonner"

type RangeKey = "all" | "today" | "7d" | "30d" | "month" | "year"

function rangeToDates(range: RangeKey): { startDate?: string; endDate?: string } {
  if (range === "all") return {}
  const now = new Date()
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  switch (range) {
    case "today":
      return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) }
    case "7d":
      start.setDate(start.getDate() - 6)
      return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) }
    case "30d":
      start.setDate(start.getDate() - 29)
      return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) }
    case "month":
      start.setDate(1)
      return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) }
    case "year":
      start.setMonth(0, 1)
      return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) }
  }
}

export function SalesView() {
  const setSellDialogOpen = useAppStore((s) => s.setSellDialogOpen)
  const [search, setSearch] = React.useState("")
  const [range, setRange] = React.useState<RangeKey>("all")
  const [undoTarget, setUndoTarget] = React.useState<Sale | null>(null)
  const [undoOpen, setUndoOpen] = React.useState(false)

  const undo = useUndoSale()

  const { startDate, endDate } = rangeToDates(range)
  const { data: sales, isLoading } = useSales({ search, startDate, endDate })

  const totalRevenue = sales?.reduce((s, x) => s + x.total, 0) ?? 0
  const totalQty = sales?.reduce((s, x) => s + x.quantity, 0) ?? 0
  const avgSale = sales && sales.length > 0 ? totalRevenue / sales.length : 0

  function handleUndo(s: Sale) {
    setUndoTarget(s)
    setUndoOpen(true)
  }

  async function confirmUndo() {
    if (!undoTarget) return
    try {
      await undo.mutateAsync(undoTarget.id)
      toast.success("Sale undone", {
        description: `${undoTarget.invoiceNumber} reversed — stock restored.`,
      })
      setUndoOpen(false)
    } catch (err) {
      toast.error("Undo failed", { description: err instanceof Error ? err.message : "Unknown error" })
    }
  }

  const hasFilters = !!search || range !== "all"

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={Receipt} label="Total Sales" value={formatNumber(sales?.length ?? 0)} />
        <SummaryCard icon={IndianRupee} label="Total Revenue" value={formatCurrency(totalRevenue)} accent="primary" />
        <SummaryCard icon={ShoppingCart} label="Units Sold" value={formatNumber(totalQty)} />
        <SummaryCard icon={TrendingUp} label="Avg. Sale Value" value={formatCurrency(avgSale)} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoice, product, SKU…"
              className="h-9 pl-9"
              aria-label="Search sales"
            />
          </div>
          <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
            <SelectTrigger className="h-9 w-[160px]" aria-label="Filter by date range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="month">This month</SelectItem>
              <SelectItem value="year">This year</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setRange("all") }} className="h-9 gap-1">
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          )}
        </div>
        <Button onClick={() => setSellDialogOpen(true)} className="h-9 gap-1.5">
          <Plus className="h-4 w-4" /> New Sale
        </Button>
      </div>

      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Filters:</span>
          {search && <Badge variant="secondary">Search: “{search}”</Badge>}
          {range !== "all" && <Badge variant="secondary">Range: {range}</Badge>}
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <Card>
          <CardContent className="space-y-2 p-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : (
        <SalesTable sales={sales ?? []} onUndo={handleUndo} />
      )}

      <AlertDialog open={undoOpen} onOpenChange={setUndoOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <AlertDialogTitle>Undo this sale?</AlertDialogTitle>
                <AlertDialogDescription>
                  Sale <strong>{undoTarget?.invoiceNumber}</strong> ({undoTarget?.quantity} × {undoTarget?.productName}) will be
                  removed and the stock restored. This cannot be undone.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmUndo}
              disabled={undo.isPending}
              className="bg-amber-600 text-white hover:bg-amber-600/90"
            >
              {undo.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Undo2 className="mr-1.5 h-4 w-4" />}
              Undo sale
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  accent = "muted",
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  accent?: "primary" | "muted"
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent === "primary" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-lg font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}
