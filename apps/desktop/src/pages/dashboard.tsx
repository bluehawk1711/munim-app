import type { ElementType } from "react";
import { motion } from "motion/react";
import { Banknote, HandCoins, PackageSearch, TrendingUp, Wallet, AlertTriangle } from "lucide-react";
import { getDashboard, formatDate } from "@munim/core";
import { getCore } from "@/lib/core";
import { useAsync } from "@/lib/use-async";
import { money } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function StatCard({ label, value, sub, icon: Icon }: { label: string; value: string; sub?: string; icon: ElementType }) {
  return (
    <motion.div
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
    </motion.div>
  );
}

export function DashboardPage() {
  const { data, error, loading, reload } = useAsync(() => getDashboard(getCore()), []);

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <AlertTriangle className="text-destructive h-8 w-8" />
        <p className="max-w-md text-sm text-muted-foreground">{error}</p>
        <button onClick={reload} className="text-primary text-sm underline">
          Retry
        </button>
      </div>
    );
  }

  if (loading || !data) {
    return <p className="text-muted-foreground p-8 text-sm">Loading dashboard…</p>;
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
    </div>
  );
}
