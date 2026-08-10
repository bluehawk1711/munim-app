import { useState } from "react";
import { CalendarDays, CalendarRange, CalendarClock, Calendar, Package, AlertTriangle, ShoppingCart, Loader2, RefreshCw, TrendingUp, FileSpreadsheet, FileText } from "lucide-react";
import { getReport, reportToCsv, type ReportType } from "@munim/core";
import { getCore } from "@/lib/core";
import { useAsync } from "@/lib/use-async";
import { money, formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const REPORT_OPTIONS: {
  key: ReportType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "daily", label: "Daily Sales", description: "Today's transactions", icon: CalendarDays },
  { key: "weekly", label: "Weekly Sales", description: "Last 7 days", icon: CalendarRange },
  { key: "monthly", label: "Monthly Sales", description: "This month", icon: CalendarClock },
  { key: "yearly", label: "Yearly Sales", description: "This year", icon: Calendar },
  { key: "stock", label: "Product Stock", description: "All inventory", icon: Package },
  { key: "low_stock", label: "Low Stock", description: "Items to restock", icon: AlertTriangle },
  { key: "sold", label: "Sold Products", description: "Custom date range", icon: ShoppingCart },
];

export function ReportsPage() {
  const [type, setType] = useState<ReportType | null>("monthly");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [active, setActive] = useState<{ type: ReportType; start?: string; end?: string } | null>({ type: "monthly" });

  const { data: report, loading, reload } = useAsync(
    () =>
      active
        ? getReport(getCore(), active.type, active.start || undefined, active.end || undefined)
        : Promise.resolve(null),
    [active?.type, active?.start, active?.end],
  );

  const isCustomRange = type === "sold";
  const totals = report?.totals;

  function generate() {
    if (!type) return;
    setActive({ type, start: startDate || undefined, end: endDate || undefined });
  }

  async function handleCsv() {
    if (!report || report.rows.length === 0) return;
    const csv = reportToCsv(report);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.title.replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Generate Report</CardTitle>
          <CardDescription className="text-xs">
            Choose a report type, then generate. Same shared data as the web app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {REPORT_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const activeType = type === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setType(opt.key)}
                  className={`flex items-start gap-2.5 rounded-lg border p-3 text-left transition-all hover:bg-accent ${
                    activeType ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                      activeType ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight">{opt.label}</p>
                    <p className="text-[11px] text-muted-foreground">{opt.description}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {isCustomRange && (
            <div className="grid gap-3 sm:grid-cols-2 lg:max-w-md">
              <div className="space-y-1.5">
                <Label htmlFor="startDate" className="text-xs">Start Date</Label>
                <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endDate" className="text-xs">End Date</Label>
                <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9" />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button onClick={generate} disabled={!type} className="gap-1.5">
              <RefreshCw className="h-4 w-4" /> Generate Report
            </Button>
            {active && (
              <Badge variant="secondary" className="gap-1">
                Active: {REPORT_OPTIONS.find((o) => o.key === active.type)?.label}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

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
                <Button variant="outline" size="sm" onClick={handleCsv} disabled={!report || report.rows.length === 0 || loading} className="gap-1.5">
                  <FileSpreadsheet className="h-4 w-4" /> Export CSV
                </Button>
                <Button variant="ghost" size="icon" onClick={reload} disabled={loading} aria-label="Refresh report" className="h-8 w-8">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading || !report ? (
              <p className="text-muted-foreground p-6 text-sm">Loading report…</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="h-10 text-xs">Product Name</TableHead>
                      <TableHead className="text-xs">SKU</TableHead>
                      <TableHead className="text-xs">Color</TableHead>
                      <TableHead className="text-xs">Size</TableHead>
                      <TableHead className="text-right text-xs">Stock</TableHead>
                      <TableHead className="text-right text-xs">Sold Qty</TableHead>
                      <TableHead className="text-right text-xs">Revenue</TableHead>
                      <TableHead className="text-right text-xs">Profit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                          No data for this report in the selected period.
                        </TableCell>
                      </TableRow>
                    ) : (
                      report.rows.map((r) => (
                        <TableRow key={`${r.sku}-${r.productId}`} className="hover:bg-muted/30">
                          <TableCell className="font-medium">{r.productName}</TableCell>
                          <TableCell className="font-mono text-xs">{r.sku}</TableCell>
                          <TableCell>{r.color}</TableCell>
                          <TableCell>{r.size}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.stock}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.soldQuantity}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{money(r.revenue)}</TableCell>
                          <TableCell className={`text-right tabular-nums ${r.profit < 0 ? "text-destructive" : ""}`}>{money(r.profit)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>

                {totals && report.rows.length > 0 && (
                  <>
                    <Separator />
                    <div className="grid gap-3 p-4 sm:grid-cols-4">
                      <TotalCard label="Total Stock" value={String(totals.stock)} />
                      <TotalCard label="Total Sold" value={String(totals.soldQuantity)} />
                      <TotalCard label="Total Revenue" value={money(totals.revenue)} accent />
                      <TotalCard label="Total Profit" value={money(totals.profit)} />
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TotalCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-lg border p-3 ${accent ? "border-primary/30 bg-primary/5" : ""}`}>
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${accent ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
        <TrendingUp className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}
