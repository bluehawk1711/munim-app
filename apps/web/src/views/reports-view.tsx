"use client"

import * as React from "react"
import {
  CalendarDays,
  CalendarRange,
  CalendarClock,
  Calendar,
  Package,
  AlertTriangle,
  ShoppingCart,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
  TrendingUp,
  Weight,
} from "lucide-react"
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription, Badge, Separator, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Skeleton, ReportFilterPanel } from "@munim/ui"

import { useReport } from "@/hooks/use-dashboard"
import { useArticles } from "@/hooks/use-articles"
import { useCatalog } from "@/hooks/use-catalog"
import { useParties } from "@/hooks/use-parties"
import { exportReportToExcel, exportReportToPdf } from "@/lib/export"
import {
  reportToCsv,
  emptyReportFilterForm,
  toReportFilters,
  type ReportFilters,
  type ReportFilterFormValues,
  type ReportType,
} from "@munim/core"
import { formatCurrency, formatNumber, formatDateTime, formatWeight } from "@/lib/format"
import { cn } from "@/lib/utils"
import { toast } from "@munim/ui"

const REPORT_OPTIONS: {
  key: ReportType
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { key: "daily", label: "Daily Sales", description: "Today's transactions", icon: CalendarDays },
  { key: "weekly", label: "Weekly Sales", description: "Last 7 days", icon: CalendarRange },
  { key: "monthly", label: "Monthly Sales", description: "This month", icon: CalendarClock },
  { key: "yearly", label: "Yearly Sales", description: "This year", icon: Calendar },
  { key: "stock", label: "Product Stock", description: "All inventory", icon: Package },
  { key: "low_stock", label: "Low Stock", description: "Items to restock", icon: AlertTriangle },
  { key: "sold", label: "Sold Products", description: "Items sold in a period", icon: ShoppingCart },
]

export function ReportsView() {
  const [type, setType] = React.useState<ReportType>("monthly")
  const [form, setForm] = React.useState<ReportFilterFormValues>(emptyReportFilterForm)
  const [active, setActive] = React.useState<ReportFilters | null>({ type: "monthly" })

  const { data: report, isLoading, isFetching, refetch } = useReport(active)

  // Filter option sources — the same masters the rest of the app uses.
  const { data: articles } = useArticles()
  const { data: colors } = useCatalog("color")
  const { data: sizes } = useCatalog("size")
  const { data: categories } = useCatalog("category")
  const { data: parties } = useParties()

  const filterOptions = React.useMemo(
    () => ({
      articles: articles ?? [],
      categories: categories ?? [],
      colors: colors ?? [],
      sizes: sizes ?? [],
      parties: parties ?? [],
    }),
    [articles, categories, colors, sizes, parties]
  )

  function generate() {
    setActive(toReportFilters(type, form))
  }

  async function handleExcel() {
    if (!report) return
    try {
      await exportReportToExcel(report)
      toast.success("Excel report exported")
    } catch (e) {
      toast.error("Excel export failed", { description: e instanceof Error ? e.message : "Unknown error" })
    }
  }

  async function handlePdf() {
    if (!report) return
    try {
      await exportReportToPdf(report)
      toast.success("PDF report exported")
    } catch (e) {
      toast.error("PDF export failed", { description: e instanceof Error ? e.message : "Unknown error" })
    }
  }

  async function handleCsv() {
    if (!report || report.rows.length === 0) return
    try {
      const csv = reportToCsv(report)
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${report.type}-report.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.success("CSV report exported")
    } catch (e) {
      toast.error("CSV export failed", { description: e instanceof Error ? e.message : "Unknown error" })
    }
  }

  return (
    <div className="space-y-4">
      {/* Report type selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Generate Report</CardTitle>
          <CardDescription className="text-xs">Choose a report type, then generate and export.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {REPORT_OPTIONS.map((opt) => {
              const Icon = opt.icon
              const active = type === opt.key
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setType(opt.key)}
                  className={cn(
                    "flex items-start gap-2.5 rounded-lg border p-3 text-left transition-all hover:bg-accent",
                    active ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"
                  )}
                >
                  <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight">{opt.label}</p>
                    <p className="text-[11px] text-muted-foreground">{opt.description}</p>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="border-t pt-4">
            <ReportFilterPanel
              value={form}
              onChange={setForm}
              options={filterOptions}
              onApply={generate}
              busy={isFetching}
            />
          </div>

          <div className="flex items-center gap-2">
            {active && (
              <Badge variant="secondary" className="gap-1">
                Active: {REPORT_OPTIONS.find((o) => o.key === active.type)?.label}
                {active.startDate ? ` · ${active.startDate}` : ""}
                {active.endDate ? ` → ${active.endDate}` : ""}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Report results */}
      {active && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-base">{report?.title ?? "Report"}</CardTitle>
                <CardDescription className="text-xs">
                  {report ? (
                    <>
                      Period: {report.periodLabel} · Generated {formatDateTime(report.generatedAt)}
                    </>
                  ) : (
                    "Generating report…"
                  )}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleCsv} disabled={!report || report.rows.length === 0 || isLoading} className="gap-1.5">
                  <FileSpreadsheet className="h-4 w-4" /> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={handleExcel} disabled={!report || isLoading} className="gap-1.5">
                  <FileSpreadsheet className="h-4 w-4" /> Excel
                </Button>
                <Button variant="outline" size="sm" onClick={handlePdf} disabled={!report || isLoading} className="gap-1.5">
                  <FileText className="h-4 w-4" /> PDF
                </Button>
                <Button variant="ghost" size="icon" onClick={() => refetch()} disabled={isFetching} aria-label="Refresh report" className="h-8 w-8">
                  {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : report ? (
              <>
                {/* Day-wise Daily Sales — one section per DATE with that day's
                    products, invoice count and takings (core `getReport`
                    fills `days` for the daily report only). */}
                {(report.days?.length ?? 0) > 0 ? (
                  <div className="divide-y">
                    {report.days.map((d) => (
                      <div key={d.day} className="p-4">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold">{d.label}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {d.invoices} invoice{d.invoices !== 1 ? "s" : ""} · {formatNumber(d.daySoldQuantity)} sold
                            </p>
                          </div>
                          <p className="text-sm font-bold tabular-nums">{formatCurrency(d.dayRevenue)}</p>
                        </div>
                        <div className="overflow-hidden rounded-lg border">
                          <div className="bg-muted/40 grid grid-cols-[1fr_60px_80px_90px_90px] gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground">
                            <span>Product</span>
                            <span className="text-right">Qty</span>
                            <span className="text-right">Wt</span>
                            <span className="text-right">Revenue</span>
                            <span className="text-right">Stock</span>
                          </div>
                          <div className="divide-y">
                            {d.rows.length === 0 ? (
                              <p className="px-3 py-4 text-center text-xs text-muted-foreground">No sales this day.</p>
                            ) : (
                              d.rows.map((r) => (
                                <div key={`${d.day}-${r.sku ?? "n"}-${r.productId ?? r.productName}`} className="grid grid-cols-[1fr_60px_80px_90px_90px] gap-2 px-3 py-2 text-sm hover:bg-muted/30">
                                  <div className="min-w-0">
                                    <p className="truncate font-medium">{r.productName}</p>
                                    <p className="truncate text-[11px] text-muted-foreground">{r.sku}</p>
                                  </div>
                                  <span className="text-right tabular-nums">{formatNumber(r.soldQuantity)}</span>
                                  <span className="text-right tabular-nums">{r.soldWeight > 0 ? formatWeight(r.soldWeight, r.weightUnit) : "—"}</span>
                                  <span className="text-right font-semibold tabular-nums">{formatCurrency(r.revenue)}</span>
                                  <span className="text-right tabular-nums">{formatNumber(r.stock)}</span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="h-10 text-xs">Product Name</TableHead>
                        <TableHead className="text-xs">SKU</TableHead>
                        <TableHead className="text-xs">Article</TableHead>
                        <TableHead className="text-xs">Category</TableHead>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs">Color</TableHead>
                        <TableHead className="text-xs">Size</TableHead>
                        <TableHead className="text-right text-xs">Stock</TableHead>
                        <TableHead className="text-right text-xs">Sold Qty</TableHead>
                        <TableHead className="text-right text-xs">Sold Wt</TableHead>
                        <TableHead className="text-right text-xs">Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.rows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={11} className="py-10 text-center text-sm text-muted-foreground">
                            No data for this report in the selected period.
                          </TableCell>
                        </TableRow>
                      ) : (
                        report.rows.map((r) => (
                          <TableRow key={`${r.sku ?? "n"}-${r.productId ?? r.productName}`} className="hover:bg-muted/30">
                            <TableCell className="font-medium">{r.productName}</TableCell>
                            <TableCell className="font-mono text-xs">{r.sku}</TableCell>
                            <TableCell className="text-xs">{r.articleName ?? "—"}</TableCell>
                            <TableCell className="text-xs">{r.categoryName ?? "—"}</TableCell>
                            <TableCell className="text-xs">{r.productType ?? "—"}</TableCell>
                            <TableCell>{r.color}</TableCell>
                            <TableCell>{r.size}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatNumber(r.stock)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatNumber(r.soldQuantity)}</TableCell>
                            <TableCell className="text-right tabular-nums">{r.soldWeight > 0 ? formatWeight(r.soldWeight, r.weightUnit) : "—"}</TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(r.revenue)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                )}

                {report.rows.length > 0 && (
                  <>
                    <Separator />
                    <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
                      <TotalCard label="Total Stock" value={formatNumber(report.totals.stock)} icon={Package} />
                      <TotalCard label="Total Sold" value={formatNumber(report.totals.soldQuantity)} icon={ShoppingCart} />
                      <TotalCard
                        label="Weight Sold"
                        value={(report.totals.weightSoldGm ?? 0) > 0 ? formatWeight(report.totals.weightSoldGm) : "—"}
                        icon={Weight}
                      />
                      <TotalCard
                        label="Material Received"
                        value={
                          (report.totals.materialReceivedGm ?? 0) > 0 || (report.totals.materialReceivedValue ?? 0) > 0
                            ? `${(report.totals.materialReceivedGm ?? 0) > 0 ? formatWeight(report.totals.materialReceivedGm) + " · " : ""}₹${formatNumber(report.totals.materialReceivedValue ?? 0)}`
                            : "—"
                        }
                        icon={Weight}
                      />
                      <TotalCard label="Total Revenue" value={formatCurrency(report.totals.revenue)} icon={TrendingUp} accent />
                    </div>
                  </>
                )}
              </>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function TotalCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  accent?: boolean
}) {
  return (
    <div className={cn("flex items-center gap-3 rounded-lg border p-3", accent && "border-primary/30 bg-primary/5")}>
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", accent ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  )
}
