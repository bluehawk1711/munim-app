"use client"

import {
  Package,
  Boxes,
  ShoppingCart,
  IndianRupee,
  TrendingDown,
  TrendingUp,
  Activity,
  Receipt,
  ArrowRight,
  Sparkles,
  HandCoins,
} from "lucide-react"
import { useDashboard } from "@/hooks/use-dashboard"
import { useAppStore } from "@/store/view-store"
import { StatCard } from "@/components/app/stat-card"
import { LoadingState, EmptyState } from "@/components/app/shared"
import dynamic from "next/dynamic"
const MonthlySalesChart = dynamic(() => import("@/components/charts").then((m) => m.MonthlySalesChart), { ssr: false })
const StockDistributionChart = dynamic(() => import("@/components/charts").then((m) => m.StockDistributionChart), { ssr: false })
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button, Badge, Separator, ScrollArea } from "@munim/ui"





import { formatCurrency, formatNumber, formatDateTime, formatTimeAgo } from "@/lib/format"
import { useSeedProducts } from "@/hooks/use-products"
import { toast } from "sonner"

export function DashboardView() {
  const { data, isLoading, isError, refetch } = useDashboard()
  const setView = useAppStore((s) => s.setView)
  const setSellDialogOpen = useAppStore((s) => s.setSellDialogOpen)
  const seed = useSeedProducts()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <div className="h-20 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2"><CardContent className="h-80 animate-pulse rounded bg-muted" /></Card>
          <Card><CardContent className="h-80 animate-pulse rounded bg-muted" /></Card>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <EmptyState
        icon={Activity}
        title="Couldn't load dashboard"
        description="There was a problem fetching your analytics. Please try again."
        action={
          <Button variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        }
      />
    )
  }

  const hasData = data && data.totalProducts > 0

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Products"
          value={formatNumber(data?.totalProducts ?? 0)}
          icon={Package}
          accent="primary"
          hint={`${formatNumber(data?.totalStock ?? 0)} units in stock`}
          loading={isLoading}
        />
        <StatCard
          title="Invoices"
          value={formatNumber(data?.invoicesCount ?? 0)}
          icon={Receipt}
          accent="teal"
          hint={`${formatCurrency(data?.unpaidAmount ?? 0)} outstanding`}
          loading={isLoading}
        />
        <StatCard
          title="Total Revenue"
          value={formatCurrency(data?.totalRevenue ?? 0)}
          icon={IndianRupee}
          accent="primary"
          hint={`Avg ${formatCurrency(data?.averageSale ?? 0)} / sale`}
          loading={isLoading}
        />
        <StatCard
          title="Low Stock"
          value={formatNumber(data?.lowStockCount ?? 0)}
          icon={TrendingDown}
          accent="amber"
          hint="Items needing restock"
          loading={isLoading}
        />
      </div>

      {/* Money position */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat icon={TrendingUp} label="Monthly Revenue" value={formatCurrency(data?.monthlyRevenue ?? 0)} />
        <MiniStat icon={HandCoins} label="We are owed" value={formatCurrency(data?.receivables ?? 0)} />
        <MiniStat icon={HandCoins} label="We owe (payable)" value={formatCurrency(data?.payables ?? 0)} />
        <MiniStat icon={ShoppingCart} label="Sold Today" value={formatNumber(data?.productsSoldToday ?? 0)} />
      </div>

      {!hasData && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col items-center gap-4 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">Welcome to Munim</p>
                <p className="text-xs text-muted-foreground">
                  Your inventory is empty. Load sample products to explore the dashboard.
                </p>
              </div>
            </div>
            <Button
              onClick={() =>
                seed.mutateAsync().then((r) => {
                  if (r.success) toast.success(`Seeded ${r.count} sample products`)
                  else toast.info("Products already exist")
                })
              }
              disabled={seed.isPending}
            >
              {seed.isPending ? "Loading sample data…" : "Load sample data"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base">Monthly Sales</CardTitle>
              <CardDescription className="text-xs">Revenue over the last 6 months</CardDescription>
            </div>
            <Badge variant="secondary" className="gap-1">
              <TrendingUp className="h-3 w-3" />
              {formatCurrency(data?.monthlyRevenue ?? 0)} this month
            </Badge>
          </CardHeader>
          <CardContent>
            <MonthlySalesChart data={data?.monthlySales ?? []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Stock Distribution</CardTitle>
            <CardDescription className="text-xs">By availability status</CardDescription>
          </CardHeader>
          <CardContent>
            <StockDistributionChart data={data?.stockDistribution ?? []} />
          </CardContent>
        </Card>
      </div>

      {/* Recent invoices + activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base">Recent Invoices</CardTitle>
              <CardDescription className="text-xs">Latest transactions</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setView("invoices")} className="gap-1">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {data && data.recentInvoices.length > 0 ? (
              <div className="divide-y">
                {data.recentInvoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between gap-3 px-6 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{inv.customerName || "Walk-in customer"}</p>
                      <p className="text-xs text-muted-foreground">
                        {inv.invoiceNumber} · {inv.items[0]?.productName ?? `${inv.items.length} items`} · {formatDateTime(inv.date)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCurrency(inv.total)}</p>
                      <Badge variant="outline" className="mt-0.5 font-normal">
                        {inv.status.charAt(0) + inv.status.slice(1).toLowerCase()}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-6 py-8">
                <EmptyState
                  icon={ShoppingCart}
                  title="No invoices yet"
                  description="Record your first sale or bill to see it here."
                  action={<Button size="sm" onClick={() => setSellDialogOpen(true)}>Sell a product</Button>}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <CardDescription className="text-xs">Latest system events</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {data && data.recentActivity.length > 0 ? (
              <ScrollArea className="h-[280px]">
                <div className="px-6 py-2">
                  {data.recentActivity.map((log) => (
                    <div key={log.id} className="flex gap-3 py-2.5">
                      <div className="relative flex flex-col items-center">
                        <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                        <span className="w-px flex-1 bg-border" />
                      </div>
                      <div className="min-w-0 flex-1 pb-1">
                        <p className="text-xs font-medium">{log.action.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}</p>
                        <p className="text-xs text-muted-foreground">{log.detail}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground/70">{formatTimeAgo(log.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="px-6 py-8">
                <p className="text-xs text-muted-foreground">No recent activity.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />
    </div>
  )
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-sm font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}
