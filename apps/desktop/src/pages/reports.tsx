import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CalendarRange,
  CalendarClock,
  Calendar,
  Coins,
  FileSpreadsheet,
  Loader2,
  Package,
  RefreshCw,
  Scale,
  Search,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import type { ReportType } from "@munim/core";
import { getApi } from "@/lib/api";
import { useDashboard, useReport, useQueryState } from "@munim/query";
import { money, formatWeight, monthLabelToDate } from "@/lib/format";
import { toast } from "@munim/ui";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Separator,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@munim/ui";
import { AreaChart, Area } from "@/components/charts/area-chart";
import { BarChart } from "@/components/charts/bar-chart";
import { Bar } from "@/components/charts/bar";
import PieChart from "@/components/charts/pie-chart";
import { PieSlice } from "@/components/charts/pie-slice";
import { PieCenter } from "@/components/charts/pie-center";
import { Grid } from "@/components/charts/grid";
import { XAxis } from "@/components/charts/x-axis";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { ChartTooltip } from "@/components/charts/tooltip";
import { Legend, LegendItem, LegendMarker, LegendLabel, LegendValue } from "@/components/charts/legend";

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
  { key: "sold", label: "Sold Products", description: "Items sold in a period", icon: ShoppingCart },
];

/** Small metric tile inside a hero card (e.g. "Daily Avg" block). */
function HeroSubMetric({ label, value, accent }: { label: string; value: string; accent?: "primary" | "success" | "destructive" }) {
  const color =
    accent === "primary" ? "text-primary" : accent === "success" ? "text-emerald-600 dark:text-emerald-400" : accent === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div className="bg-muted/50 rounded-lg border p-2.5">
      <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">{label}</p>
      <p className={`mt-0.5 text-sm font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

export function ReportsPage() {
  const [type, setType] = useState<ReportType | null>("monthly");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [active, setActive] = useState<{ type: ReportType; start?: string; end?: string } | null>({
    type: "monthly",
  });

  // Cached per (type, start, end) — the shared @munim/query hook owns fetch;
  // `active` gating keeps the fetch off until "Generate" is clicked.
  const { data: report, loading, reload } = useQueryState(
    useReport(active?.type ?? null, active?.start || undefined, active?.end || undefined),
  );
  // Shared dashboard stats power the 6-month trajectory (same cache as Home).
  const { data: dash } = useQueryState(useDashboard());

  const totals = report?.totals;

  // Itemized audit table search (client-side, like the reference's SKU filter).
  const [rowQuery, setRowQuery] = useState("");
  const rows = useMemo(() => {
    const list = report?.rows ?? [];
    const q = rowQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (r) =>
        r.productName.toLowerCase().includes(q) ||
        (r.sku ?? "").toLowerCase().includes(q) ||
        (r.color ?? "").toLowerCase().includes(q),
    );
  }, [report, rowQuery]);

  // Trajectory series from the shared monthlySales data (real dates for the
  // time-series chart's x-axis).
  const trajSeries = useMemo(
    () =>
      (dash?.monthlySales ?? []).map((mth) => ({
        date: monthLabelToDate(mth.month),
        label: mth.month,
        revenue: mth.revenue,
      })),
    [dash],
  );
  const peak = trajSeries.length > 0 ? trajSeries.reduce((best, cur) => (cur.revenue > best.revenue ? cur : best)) : null;
  const trajAvg = trajSeries.length > 0 ? trajSeries.reduce((a, b) => a + b.revenue, 0) / trajSeries.length : 0;

  // Category & karatage split (real salesByCategory from the dashboard).
  const categoryRows = dash?.salesByCategory ?? [];
  const categoryTotal = categoryRows.reduce((acc, c) => acc + c.value, 0);
  const pieData = categoryRows.map((c) => ({ label: c.name, value: c.value, color: c.color }));
  const categoryLegend = categoryRows.map((c) => ({ label: c.name, value: c.value, color: c.color, maxValue: categoryTotal }));
  const [pieHovered, setPieHovered] = useState<number | null>(null);

  // Units sold per month (real soldPerMonth series from the dashboard).
  const unitsSeries = useMemo(
    () => (dash?.soldPerMonth ?? []).map((m) => ({ name: m.month, label: m.month.split(" ")[0] ?? m.month, quantity: m.quantity })),
    [dash],
  );

  function generate() {
    if (!type) return;
    setActive({ type, start: startDate || undefined, end: endDate || undefined });
  }

  async function handleCsv() {
    if (!report || report.rows.length === 0 || !active) return;
    try {
      // Server-side CSV via the shared reportToCsv (kept consistent with web).
      const csv = await getApi().reports.csv({
        type: active.type,
        startDate: active.start || undefined,
        endDate: active.end || undefined,
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${report.title.replace(/\s+/g, "-").toLowerCase()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exported", { description: report.title });
    } catch (err) {
      toast.error("CSV export failed", { description: err instanceof Error ? err.message : undefined });
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Header band ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-primary text-2xl font-bold tracking-tight">Reports &amp; Business Analytics Suite</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            Store turnover, gross profit realization, metal weight movement and sales reports for the same shared data
            as web &amp; mobile.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCsv} disabled={!report || report.rows.length === 0 || loading}>
            <FileSpreadsheet className="h-4 w-4" /> Export CSV
          </Button>
          <Button variant="ghost" size="icon" onClick={reload} disabled={loading} aria-label="Refresh report" className="h-8 w-8">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* ── Report window bar ───────────────────────────────────────── */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-3 lg:flex-row lg:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="startDate" className="text-xs">Start date — optional, applies to any report</Label>
            <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9" />
          </div>
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="endDate" className="text-xs">End date — blank = type's default period</Label>
            <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9" />
          </div>
          <Button onClick={generate} disabled={!type} className="gap-1.5">
            <RefreshCw className="h-4 w-4" /> Generate Report
          </Button>
          {active ? (
            <Badge variant="secondary" className="gap-1">
              Active: {REPORT_OPTIONS.find((o) => o.key === active.type)?.label}
              {active.start ? ` · ${active.start}` : ""}
              {active.end ? ` → ${active.end}` : ""}
            </Badge>
          ) : null}
        </CardContent>
      </Card>

      {/* ── Report type tabs ────────────────────────────────────────── */}
      <div className="bg-muted/60 flex flex-wrap gap-1 rounded-full p-1">
        {REPORT_OPTIONS.map((opt) => {
          const selected = type === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => setType(opt.key)}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                selected ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <opt.icon className="h-3.5 w-3.5" /> {opt.label}
            </button>
          );
        })}
      </div>

      {/* ── Hero tiles ──────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">Total Turnout / Sales</p>
              <div className="bg-primary/10 text-primary rounded-lg p-1.5"><TrendingUp className="h-4 w-4" /></div>
            </div>
            <p className="mt-1 text-2xl font-bold tracking-tight">
              {loading && !report ? "—" : money(totals?.revenue ?? 0)}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <HeroSubMetric label="Sold Qty" value={String(totals?.soldQuantity ?? 0)} />
              <HeroSubMetric label="Weight Sold" value={totals && totals.soldWeight > 0 ? formatWeight(totals.soldWeight) : "—"} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">Gross Profit Realized</p>
              <div className="rounded-lg bg-emerald-500/10 p-1.5 text-emerald-600 dark:text-emerald-400"><Coins className="h-4 w-4" /></div>
            </div>
            <p className="mt-1 text-2xl font-bold tracking-tight">
              {loading && !report ? "—" : money(totals?.profit ?? 0)}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <HeroSubMetric
                label="Margin"
                value={totals && totals.revenue > 0 ? `${Math.round((totals.profit / totals.revenue) * 100)}%` : "—"}
                accent="success"
              />
              <HeroSubMetric
                label="Procurement"
                value={money((totals?.revenue ?? 0) - (totals?.profit ?? 0))}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">Metal Weight Dispatched</p>
              <div className="bg-primary/10 text-primary rounded-lg p-1.5"><Scale className="h-4 w-4" /></div>
            </div>
            <p className="mt-1 text-2xl font-bold tracking-tight">
              {totals && totals.soldWeight > 0 ? formatWeight(totals.soldWeight) : "—"}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <HeroSubMetric label="Stock On Hand" value={String(totals?.stock ?? 0)} />
              <HeroSubMetric label="Weight Pct" value={totals && totals.stock > 0 ? `${Math.round((totals.soldQuantity / totals.stock) * 100)}%` : "—"} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">Items Needing Action</p>
              <div className="rounded-lg bg-amber-500/10 p-1.5 text-amber-700 dark:text-amber-400"><Package className="h-4 w-4" /></div>
            </div>
            <p className="mt-1 text-2xl font-bold tracking-tight">{report ? rows.length : "—"}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <HeroSubMetric
                label="Low / Out SKUs"
                value={dash ? `${dash.lowStockCount} / ${dash.outOfStockCount}` : "—"}
                accent="destructive"
              />
              <HeroSubMetric label="Total Products" value={dash ? String(dash.totalProducts) : "—"} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Trajectory + category split + units run ─────────────────── */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Revenue &amp; Daily Realization Trajectory</CardTitle>
                <CardDescription className="text-xs">
                  Billing run across the last 6 months (shared dashboard series — cached with Home).
                </CardDescription>
              </div>
              {peak && peak.revenue > 0 ? (
                <Badge variant="secondary" className="gap-1">
                  Peak · {peak.label}: {money(peak.revenue)}
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {trajSeries.length === 0 ? (
              <p className="text-muted-foreground text-sm">No sales recorded yet.</p>
            ) : (
              <AreaChart data={trajSeries} className="h-60" margin={{ top: 20, right: 16, bottom: 4, left: 4 }}>
                <Grid horizontal numTicksRows={4} />
                <Area
                  dataKey="revenue"
                  fill="var(--chart-1)"
                  stroke="var(--chart-1)"
                  fillOpacity={0.32}
                  gradientToOpacity={0.02}
                  strokeWidth={2.5}
                  showMarkers
                />
                <XAxis numTicks={6} />
                <ChartTooltip
                  titleKey="label"
                  rows={(p) => [{ label: String(p.label ?? "Revenue"), value: money(Number(p.revenue)), color: "var(--chart-1)" }]}
                />
              </AreaChart>
            )}
            <Separator />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">
                <span className="text-foreground font-semibold">6-month run</span> · billing trend from the shared dashboard
              </span>
              <span>
                <span className="text-muted-foreground">Average / month:</span>{" "}
                <span className="font-semibold tabular-nums">{money(trajAvg)}</span>
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">Category &amp; Karat Split</CardTitle>
                <span className="text-muted-foreground text-xs tabular-nums">{money(categoryTotal)} total</span>
              </div>
              <CardDescription className="text-xs">Sales contribution by product category — hover to inspect</CardDescription>
            </CardHeader>
            <CardContent>
              {pieData.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">No sales yet.</p>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <PieChart data={pieData} innerRadius={62} size={200} hoverOffset={8} hoveredIndex={pieHovered} onHoverChange={setPieHovered}>
                    {pieData.map((slice, i) => (
                      <PieSlice key={slice.label} index={i} color={slice.color} />
                    ))}
                    <PieCenter>
                      {({ value, label }) => (
                        <div className="max-w-24 text-center">
                          <p className="text-muted-foreground truncate text-[10px] font-semibold tracking-wide uppercase">{label}</p>
                          <p className="text-sm font-bold tabular-nums">{money(value)}</p>
                        </div>
                      )}
                    </PieCenter>
                  </PieChart>
                  <Legend items={categoryLegend} className="w-full">
                    <LegendItem className="rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/60">
                      <LegendMarker />
                      <LegendLabel className="min-w-0 flex-1 truncate" />
                      <LegendValue showPercentage formatValue={(v) => money(v)} />
                    </LegendItem>
                  </Legend>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">Units Sold by Month</CardTitle>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {unitsSeries.reduce((a, b) => a + b.quantity, 0)} pcs / 6 mo
                </span>
              </div>
              <CardDescription className="text-xs">Pieces sold per billing month (shared dashboard series)</CardDescription>
            </CardHeader>
            <CardContent>
              {unitsSeries.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">No sales yet.</p>
              ) : (
                <BarChart data={unitsSeries} xDataKey="label" className="h-40" margin={{ top: 12, right: 8, bottom: 4, left: 4 }}>
                  <Grid horizontal numTicksRows={3} />
                  <Bar dataKey="quantity" fill="var(--chart-2)" />
                  <BarXAxis />
                  <ChartTooltip
                    rows={(p) => [{ label: String(p.name ?? "Units sold"), value: `${Number(p.quantity)} pcs`, color: "var(--chart-2)" }]}
                  />
                </BarChart>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Itemized performance & margin audit ─────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Itemized Performance &amp; Margin Audit</CardTitle>
              <CardDescription className="text-xs">
                Line-by-line turnover, procurement vs realized cost, and per-product margin — live from the counter.
              </CardDescription>
            </div>
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
              <Input
                value={rowQuery}
                onChange={(e) => setRowQuery(e.target.value)}
                placeholder="Filter SKU, name…"
                className="h-9 w-full pl-8 sm:w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading || !report ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="h-10 text-xs">Product / Barcode</TableHead>
                    <TableHead className="text-right text-xs">Units Sold</TableHead>
                    <TableHead className="text-right text-xs">Stock On Hand</TableHead>
                    <TableHead className="text-right text-xs">Revenue</TableHead>
                    <TableHead className="text-right text-xs">Cost Basis</TableHead>
                    <TableHead className="text-right text-xs">Realized Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                        {rowQuery ? "No rows match the filter." : "No data for this report in the selected period."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((r) => {
                      const marginPct = r.revenue > 0 ? Math.round((r.profit / r.revenue) * 100) : 0;
                      return (
                        <TableRow key={`${r.sku}-${r.productId}`} className="hover:bg-muted/30">
                          <TableCell>
                            <p className="font-medium">{r.productName}</p>
                            <p className="text-muted-foreground text-xs">
                              {[r.sku, r.color, r.size, r.weight != null ? formatWeight(r.weight) : null].filter(Boolean).join(" · ")}
                            </p>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{r.soldQuantity}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            <span className={r.stock <= 0 ? "text-destructive font-medium" : ""}>{r.stock}</span>
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{money(r.revenue)}</TableCell>
                          <TableCell className="text-muted-foreground text-right tabular-nums">{money(r.revenue - r.profit)}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            <span className={r.profit < 0 ? "text-destructive font-semibold" : "font-semibold text-emerald-600 dark:text-emerald-400"}>
                              {money(r.profit)} <span className="text-[11px] font-medium">({marginPct}%)</span>
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>

              {totals && report.rows.length > 0 && (
                <>
                  <Separator />
                  <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
                    <TotalCard label="Total Stock" value={String(totals.stock)} />
                    <TotalCard label="Total Sold" value={String(totals.soldQuantity)} />
                    <TotalCard label="Weight Sold" value={totals.soldWeight > 0 ? formatWeight(totals.soldWeight) : "—"} icon={Scale} />
                    <TotalCard label="Total Revenue" value={money(totals.revenue)} accent />
                    <TotalCard label="Total Profit" value={money(totals.profit)} />
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TotalCard({
  label,
  value,
  accent,
  icon: Icon = TrendingUp,
}: {
  label: string;
  value: string;
  accent?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-lg border p-3 ${accent ? "border-primary/30 bg-primary/5" : ""}`}>
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${accent ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}
