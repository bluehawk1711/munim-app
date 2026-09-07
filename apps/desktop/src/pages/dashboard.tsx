import { useMemo, useState } from "react";
import type { ElementType } from "react";
import * as m from "motion/react-m";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Banknote,
  CalendarDays,
  Database,
  Eye,
  FileDown,
  HandCoins,
  PackageSearch,
  Plus,
  Settings,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { buildBillDocument, formatDate, type BillShopDetails, type InvoiceDto } from "@munim/core";
import { useDashboard, useInvoices, useProducts, useQueryState, useSettings } from "@munim/query";
import { money, monthLabelToDate } from "@/lib/format";
import { downloadBillPdf } from "@/lib/billPdf";
import { navigate } from "@/lib/navigation";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@munim/ui";
import { AreaChart, Area } from "@/components/charts/area-chart";
import { LineChart, Line } from "@/components/charts/line-chart";
import RadarChart from "@/components/charts/radar-chart";
import { RadarArea } from "@/components/charts/radar-area";
import { RadarGrid } from "@/components/charts/radar-grid";
import { RadarAxis } from "@/components/charts/radar-axis";
import { RadarLabels } from "@/components/charts/radar-labels";
import { Grid } from "@/components/charts/grid";
import { XAxis } from "@/components/charts/x-axis";
import { ChartTooltip } from "@/components/charts/tooltip";
import { Legend, LegendItem, LegendMarker, LegendLabel, LegendValue } from "@/components/charts/legend";

/* ─── Stat tiles (top grid) ──────────────────────────────────────────── */

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  valueClass,
  progress,
  progressClass,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: ElementType;
  valueClass?: string;
  /** Optional progress meter (0..1) shown under the value (Stock Alert tile). */
  progress?: number;
  progressClass?: string;
}) {
  return (
    <m.div
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 240, damping: 22, mass: 0.8 }}
      whileHover={{ y: -3 }}
    >
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex items-start justify-between p-4">
          <div className="min-w-0">
            <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">{label}</p>
            <p className={`mt-1 text-2xl font-bold tracking-tight ${valueClass ?? ""}`}>{value}</p>
            {sub ? <p className="text-muted-foreground mt-1 text-xs">{sub}</p> : null}
            {progress != null ? (
              <div className="bg-muted mt-2 h-1.5 w-full overflow-hidden rounded-full">
                <div className={`h-full rounded-full ${progressClass ?? "bg-primary"}`} style={{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }} />
              </div>
            ) : null}
          </div>
          <div className="bg-primary/10 text-primary rounded-lg p-2">
            <Icon className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    </m.div>
  );
}

/* ─── Category / list bar row ────────────────────────────────────────── */

function BarRow({
  label,
  sub,
  value,
  max,
  color,
}: {
  label: string;
  sub: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.max(2, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="truncate font-medium">{label}</span>
        <span className="text-muted-foreground shrink-0 tabular-nums">{sub}</span>
      </div>
      <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

/* ─── PDF export for the settlements table ───────────────────────────── */

function invoiceToBillDocument(inv: InvoiceDto, shop: BillShopDetails, currency: string) {
  return buildBillDocument({
    billNo: inv.invoiceNumber,
    date: inv.date,
    customerName: inv.customerName,
    customerPhone: inv.customerPhone,
    customerAddress: inv.customerAddress,
    shop,
    lines: inv.items.map((it) => ({
      productName: it.productName,
      description: it.description,
      sku: it.sku,
      color: it.color,
      size: it.size,
      quantity: it.quantity,
      price: it.price,
    })),
    discount: inv.discount,
    deliveryCharge: inv.deliveryCharge,
    amountPaid: inv.amountPaid,
    status: inv.status,
    currency,
  });
}

/* ─── Page ───────────────────────────────────────────────────────────── */

export function DashboardPage() {
  const { data, error, loading, reload } = useQueryState(useDashboard());
  const { data: settings } = useQueryState(useSettings());
  const [trajMode, setTrajMode] = useState<"revenue" | "orders">("revenue");
  const [radarHovered, setRadarHovered] = useState<number | null>(null);

  // Recent settlement invoices — paged straight from the shared list API.
  const [page, setPage] = useState(1);
  const invoicesQ = useQueryState(useInvoices({ page, pageSize: 6 }));
  const invoices = invoicesQ.data?.invoices ?? [];
  const pagination = invoicesQ.data?.pagination;

  // Product thumbnails for Top Moving Products (join by SKU).
  const { data: productsData } = useQueryState(useProducts({ pageSize: 1000 }));
  const imageBySku = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const p of productsData?.products ?? []) map.set(p.sku, p.imageUrl);
    return map;
  }, [productsData]);

  const shop: BillShopDetails | null = settings
    ? { name: settings.shopName, address: settings.shopAddress, phones: settings.shopPhones, email: settings.shopEmail }
    : null;

  async function handlePdf(inv: InvoiceDto) {
    if (!shop) return;
    try {
      await downloadBillPdf(invoiceToBillDocument(inv, shop, settings?.currency ?? "INR"));
    } catch {
      /* surfaced by the Toaster in billPdf/generateBillPDF failures */
    }
  }

  if (error) {
    const noConfig = error.includes("No server URL configured");
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <div className="bg-destructive/10 text-destructive rounded-2xl p-4">
          {noConfig ? <Database className="h-8 w-8" /> : <AlertTriangle className="h-8 w-8" />}
        </div>
        <p className="text-base font-semibold">{noConfig ? "Server not configured" : "Couldn't load dashboard"}</p>
        <p className="text-muted-foreground max-w-md text-sm">
          {noConfig
            ? "Add the Munim API base URL in Settings — the same server the web app uses."
            : error}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={reload}>
            Retry
          </Button>
          <Button onClick={() => navigate("/settings")} className="gap-1.5">
            <Settings className="h-4 w-4" /> Open Settings
          </Button>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-2 p-4">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="space-y-2 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const monthLabel = new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  // Time-series rows for the bklit charts (they key the x-axis on real dates).
  const trajSeries = data.monthlySales.map((mth) => ({
    date: monthLabelToDate(mth.month),
    label: mth.month,
    revenue: mth.revenue,
    orders: mth.orders,
  }));
  const trajPeak = trajSeries.length > 0 ? trajSeries.reduce((best, cur) => (cur.revenue > best.revenue ? cur : best)) : null;
  const categoryTotal = data.salesByCategory.reduce((acc, c) => acc + c.value, 0);
  const radarMetrics = data.salesByCategory.map((c) => ({ key: c.name, label: c.name }));
  const radarData =
    data.salesByCategory.length > 0
      ? [
          {
            label: "Revenue share",
            color: "var(--chart-1)",
            values: Object.fromEntries(
              data.salesByCategory.map((c) => [c.name, categoryTotal > 0 ? Math.round((c.value / categoryTotal) * 100) : 0]),
            ),
          },
        ]
      : [];
  const categoryLegend = data.salesByCategory.map((c) => ({ label: c.name, value: c.value, color: c.color, maxValue: categoryTotal }));

  const netExposure = data.receivables + data.payables;
  const givenShare = netExposure > 0 ? data.receivables / netExposure : 0;
  const activeAdvances = data.recentAdvances.slice(0, 3);

  const stockAlerts = data.lowStockCount + data.outOfStockCount;

  return (
    <div className="space-y-5">
      {/* Quick-action bar */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold">
          <CalendarDays className="h-3.5 w-3.5" /> {monthLabel}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button size="sm" className="gap-1.5" onClick={() => navigate("/billing")}>
            <Plus className="h-4 w-4" /> New Bill
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate("/billing")}>
            <Banknote className="h-4 w-4" /> Quick Sale
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate("/products")}>
            <PackageSearch className="h-4 w-4" /> Stock / Barcode
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate("/parties")}>
            <Users className="h-4 w-4" /> Khata Entry
          </Button>
        </div>
      </div>

      {/* Hero stat grid */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total Revenue" value={money(data.totalRevenue)} sub={`${data.invoicesCount} invoiced to date`} icon={TrendingUp} />
        <StatCard label="This Month" value={money(data.monthlyRevenue)} sub={`${data.productsSoldToday} items sold today`} icon={Banknote} />
        <StatCard label="Unpaid Amount" value={money(data.unpaidAmount)} sub="Open credit terms" valueClass="text-destructive" icon={Wallet} />
        <StatCard label="Receivables" value={money(data.receivables)} sub="Owed by parties" icon={HandCoins} />
        <StatCard label="Payables" value={money(data.payables)} sub="Owed to karigars / vendors" icon={Wallet} />
        <StatCard
          label="Stock Alert"
          value={`${data.lowStockCount} / ${data.outOfStockCount}`}
          sub={stockAlerts > 0 ? `${stockAlerts} active SKUs need attention` : "All SKUs healthy"}
          icon={PackageSearch}
          progress={data.totalProducts > 0 ? stockAlerts / data.totalProducts : 0}
          progressClass="bg-destructive"
        />
      </div>

      {/* Trajectory + Khata position */}
      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Turnout &amp; Category Trajectory</CardTitle>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Figure 1.0 presents revenue and inventory turnover for the billing volume.
              </p>
            </div>
            <div className="bg-muted flex rounded-full p-0.5">
              {(["revenue", "orders"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setTrajMode(mode)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                    trajMode === mode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {mode === "revenue" ? "Monthly" : "Quantity"}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-semibold">Billing Run · 6 months</span>
                <span className="text-primary font-semibold">
                  Peak: {trajPeak && trajPeak.revenue > 0 ? trajPeak.label : "—"}
                </span>
              </div>
              {trajSeries.length === 0 ? (
                <p className="text-muted-foreground text-sm">No sales yet</p>
              ) : trajMode === "revenue" ? (
                <AreaChart data={trajSeries} className="h-52" margin={{ top: 16, right: 12, bottom: 4, left: 4 }}>
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
              ) : (
                <LineChart data={trajSeries} className="h-52" margin={{ top: 16, right: 12, bottom: 4, left: 4 }}>
                  <Grid horizontal numTicksRows={4} />
                  <Line dataKey="orders" stroke="var(--chart-2)" strokeWidth={2.5} showMarkers />
                  <XAxis numTicks={6} />
                  <ChartTooltip
                    titleKey="label"
                    rows={(p) => [{ label: String(p.label ?? "Orders"), value: `${Number(p.orders)} pcs`, color: "var(--chart-2)" }]}
                  />
                </LineChart>
              )}
            </div>
            <div className="border-t pt-4">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-semibold">Sales Distribution by Category</span>
                <span className="text-muted-foreground tabular-nums">{money(categoryTotal)} Total</span>
              </div>
              {data.salesByCategory.length >= 3 ? (
                <div className="flex flex-col items-center gap-4 sm:flex-row">
                  <RadarChart
                    data={radarData}
                    metrics={radarMetrics}
                    size={230}
                    levels={4}
                    margin={44}
                    hoveredIndex={radarHovered}
                    onHoverChange={setRadarHovered}
                    className="shrink-0"
                  >
                    <RadarGrid showLabels={false} />
                    <RadarAxis />
                    <RadarLabels interactive fontSize={10} />
                    <RadarArea index={0} color="var(--chart-1)" />
                  </RadarChart>
                  <Legend items={categoryLegend} title="Share of revenue" className="min-w-0 flex-1">
                    <LegendItem className="rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/60">
                      <LegendMarker />
                      <LegendLabel className="min-w-0 flex-1 truncate" />
                      <LegendValue showPercentage formatValue={(v) => money(v)} />
                    </LegendItem>
                  </Legend>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.salesByCategory.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No sales yet</p>
                  ) : (
                    data.salesByCategory.map((c) => (
                      <BarRow
                        key={c.name}
                        label={c.name}
                        sub={`${money(c.value)} (${categoryTotal > 0 ? Math.round((c.value / categoryTotal) * 100) : 0}%)`}
                        value={c.value}
                        max={Math.max(...data.salesByCategory.map((x) => x.value), 1)}
                        color={c.color}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Khata &amp; Karigar Position</CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate("/parties")}>
              Audited
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-xl border p-3">
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">Net Outstanding Balance</p>
                <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">Payable to Workshop</span>
              </div>
              <div className="mt-1 flex items-end justify-between gap-2">
                <p className="text-2xl font-bold tracking-tight">{money(netExposure)}</p>
                <span className="text-muted-foreground pb-0.5 text-[11px]">Net Debit</span>
              </div>
              <div className="mt-3 flex h-2 overflow-hidden rounded-full">
                <div className="bg-destructive" style={{ width: `${givenShare * 100}%` }} />
                <div className="bg-emerald-500" style={{ width: `${(1 - givenShare) * 100}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-destructive inline-flex items-center gap-1 font-semibold">
                  <ArrowUpRight className="h-3.5 w-3.5" /> Given: {money(data.receivables)}
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                  <ArrowDownLeft className="h-3.5 w-3.5" /> Took: {money(data.payables)}
                </span>
              </div>
            </div>

            <div>
              <p className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wide uppercase">Active Advances</p>
              <div className="space-y-2">
                {activeAdvances.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No open advances</p>
                ) : (
                  activeAdvances.map((adv) => (
                    <div key={adv.id} className="flex items-center justify-between gap-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{adv.partyName ?? "Party"}</p>
                        <p className="text-muted-foreground text-xs">{formatDate(adv.date)}</p>
                      </div>
                      <Badge variant={adv.direction === "GIVEN" ? "destructive" : "success"}>
                        {adv.direction === "GIVEN" ? "Given" : "Taken"} {money(adv.amount)}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top products + Recent settlements */}
      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Top Moving Products</CardTitle>
              <p className="text-muted-foreground mt-0.5 text-xs">Counter style units &amp; revenue-wise</p>
            </div>
            <BarChart3 className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent className="space-y-3">
            {data.topProducts.length === 0 ? (
              <p className="text-muted-foreground text-sm">No sales yet</p>
            ) : (
              data.topProducts.slice(0, 5).map((p) => {
                const img = imageBySku.get(p.sku ?? "") ?? null;
                return (
                  <div key={p.productName + (p.sku ?? "")} className="flex items-center gap-3">
                    <div className="bg-muted h-11 w-11 shrink-0 overflow-hidden rounded-lg">
                      {img ? <img src={img} alt="" className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{p.productName}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {[p.sku, `${p.quantitySold} pcs sold`].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold tabular-nums">{money(p.revenue)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent Settlement Invoices</CardTitle>
              <p className="text-muted-foreground mt-0.5 text-xs">Real-time counters bills generated with GST and purity breakup</p>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate("/invoices")}>
              View all
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground text-center">
                      No invoices yet
                    </TableCell>
                  </TableRow>
                ) : (
                  invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="text-primary max-w-28 truncate text-xs font-semibold">{inv.invoiceNumber}</TableCell>
                      <TableCell className="max-w-32 truncate">{inv.customerName ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap text-xs">{formatDate(inv.date)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{money(inv.total)}</TableCell>
                      <TableCell>
                        <Badge variant={inv.status === "PAID" ? "success" : inv.status === "PARTIAL" ? "warning" : inv.status === "UNPAID" ? "destructive" : "secondary"}>
                          {inv.status === "UNPAID" ? "UNPAID (DUE)" : inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Download PDF" onClick={() => void handlePdf(inv)}>
                            <FileDown className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Open invoices" onClick={() => navigate("/invoices")}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {pagination && pagination.totalCount > 0 ? (
              <div className="mt-3 flex items-center justify-between">
                <p className="text-muted-foreground text-xs">
                  Showing {(pagination.page - 1) * pagination.pageSize + 1}–
                  {Math.min(pagination.page * pagination.pageSize, pagination.totalCount)} of {pagination.totalCount} invoices
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-7" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" className="h-7" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Recent activity — compact footer strip */}
      {data.recentActivity.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {data.recentActivity.slice(0, 6).map((act) => (
              <div key={act.id} className="min-w-0 text-sm">
                <p className="line-clamp-1">{act.detail}</p>
                <p className="text-muted-foreground text-xs">{formatDate(act.createdAt)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
