import type { ElementType } from "react";
import * as m from "motion/react-m";
import { Banknote, HandCoins, PackageSearch, TrendingUp, Wallet, AlertTriangle, Database, Settings } from "lucide-react";
import { getDashboard, formatDate } from "@munim/core";
import { getCore } from "@/lib/core";
import { useAsync } from "@/lib/use-async";
import { money } from "@/lib/format";
import { navigate } from "@/lib/navigation";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@munim/ui";

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
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon }: { label: string; value: string; sub?: string; icon: ElementType }) {
  return (
    <m.div
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 240, damping: 22, mass: 0.8 }}
      whileHover={{ y: -3 }}
    >
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex items-start justify-between p-4">
          <div>
            <p className="text-muted-foreground text-xs font-medium">{label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
            {sub ? <p className="text-muted-foreground mt-1 text-xs">{sub}</p> : null}
          </div>
          <div className="bg-primary/10 text-primary rounded-lg p-2">
            <Icon className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    </m.div>
  );
}

export function DashboardPage() {
  const { data, error, loading, reload } = useAsync(() => getDashboard(getCore()), []);

  if (error) {
    const noConfig = error.includes("No database URL configured");
    const host = error.match(/@([^/]+)/)?.[1] ?? null;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <div className="bg-destructive/10 text-destructive rounded-2xl p-4">
          {noConfig ? <Database className="h-8 w-8" /> : <AlertTriangle className="h-8 w-8" />}
        </div>
        <p className="text-base font-semibold">
          {noConfig ? "Database not configured" : "Couldn't load dashboard"}
        </p>
        <p className="text-muted-foreground max-w-md text-sm">
          {noConfig
            ? "Add your shared Neon connection string in Settings — the same one the web app uses."
            : host
              ? `Tried to reach ${host} but the query failed. Check the connection string in Settings.`
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

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total Revenue" value={money(data.totalRevenue)} sub={`${data.invoicesCount} invoices`} icon={TrendingUp} />
        <StatCard label="This Month" value={money(data.monthlyRevenue)} sub={`${data.productsSoldToday} items sold today`} icon={Banknote} />
        <StatCard label="Unpaid Amount" value={money(data.unpaidAmount)} sub="Open invoices" icon={Wallet} />
        <StatCard label="Receivables" value={money(data.receivables)} sub="Money owed to you" icon={HandCoins} />
        <StatCard label="Payables" value={money(data.payables)} sub="Money you owe" icon={Wallet} />
        <StatCard label="Low / Out of Stock" value={`${data.lowStockCount} / ${data.outOfStockCount}`} sub={`${data.totalProducts} products`} icon={PackageSearch} />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Recent Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground text-center">
                      No invoices yet
                    </TableCell>
                  </TableRow>
                ) : (
                  data.recentInvoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                      <TableCell>{inv.customerName ?? "—"}</TableCell>
                      <TableCell>{formatDate(inv.date)}</TableCell>
                      <TableCell className="text-right font-medium">{money(inv.total)}</TableCell>
                      <TableCell>
                        <Badge variant={inv.status === "PAID" ? "success" : inv.status === "PARTIAL" ? "warning" : "secondary"}>
                          {inv.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Recent Advances</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.recentAdvances.length === 0 ? (
                <p className="text-muted-foreground text-sm">No open advances</p>
              ) : (
                data.recentAdvances.map((adv) => (
                  <div key={adv.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{adv.partyName ?? "Party"}</p>
                      <p className="text-muted-foreground text-xs">{formatDate(adv.date)}</p>
                    </div>
                    <span className={adv.direction === "GIVEN" ? "text-destructive font-medium" : "text-emerald-600 font-medium dark:text-emerald-400"}>
                      {adv.direction === "GIVEN" ? "Given" : "Taken"} {money(adv.amount)}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.recentActivity.length === 0 ? (
                <p className="text-muted-foreground text-sm">No activity yet</p>
              ) : (
                data.recentActivity.map((act) => (
                  <div key={act.id} className="text-sm">
                    <p className="line-clamp-1">{act.detail}</p>
                    <p className="text-muted-foreground text-xs">{formatDate(act.createdAt)}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Charts — lightweight CSS bars (desktop has no chart lib) */}
      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Top Selling Products</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.topProducts.length === 0 ? (
              <p className="text-muted-foreground text-sm">No sales yet</p>
            ) : (
              data.topProducts.map((p) => {
                const max = Math.max(...data.topProducts.map((t) => t.revenue), 1);
                return (
                  <BarRow
                    key={p.productName + (p.sku ?? "")}
                    label={p.productName}
                    sub={`${p.quantitySold} sold · ${money(p.revenue)}`}
                    value={p.revenue}
                    max={max}
                    color="var(--chart-1)"
                  />
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Invoice Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.invoiceStatus.length === 0 ? (
              <p className="text-muted-foreground text-sm">No invoices yet</p>
            ) : (
              data.invoiceStatus.map((s) => (
                <BarRow
                  key={s.name}
                  label={s.name}
                  sub={`${s.value} invoices`}
                  value={s.value}
                  max={Math.max(...data.invoiceStatus.map((x) => x.value), 1)}
                  color={s.color}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Sales by Category</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.salesByCategory.length === 0 ? (
              <p className="text-muted-foreground text-sm">No sales yet</p>
            ) : (
              data.salesByCategory.map((c) => (
                <BarRow
                  key={c.name}
                  label={c.name}
                  sub={money(c.value)}
                  value={c.value}
                  max={Math.max(...data.salesByCategory.map((x) => x.value), 1)}
                  color={c.color}
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Advances Given vs Taken</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.advanceSplit.length === 0 ? (
              <p className="text-muted-foreground text-sm">No open advances</p>
            ) : (
              data.advanceSplit.map((a) => (
                <BarRow
                  key={a.name}
                  label={a.name}
                  sub={money(a.value)}
                  value={a.value}
                  max={Math.max(...data.advanceSplit.map((x) => x.value), 1)}
                  color={a.color}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
