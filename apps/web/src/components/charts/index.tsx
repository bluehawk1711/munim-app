"use client"

import * as React from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { formatCurrency, formatNumber } from "@/lib/format"
import type {
  MonthlySalesPoint,
  SoldPerMonthPoint,
  StockDistributionPoint,
  TopProduct,
} from "@/lib/types"

const AXIS_STYLE = { fontSize: 11 }

// ---------- Monthly Sales (Area) ----------
const monthlySalesConfig = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
} satisfies ChartConfig

const stockDistributionConfig: ChartConfig = {
  in: { label: "In Stock", color: "var(--chart-2)" },
  low: { label: "Low Stock", color: "var(--chart-4)" },
  out: { label: "Out of Stock", color: "var(--chart-5)" },
}

const topProductsConfig: ChartConfig = {
  quantitySold: { label: "Units Sold", color: "var(--chart-1)" },
}

const soldPerMonthConfig: ChartConfig = {
  quantity: { label: "Units Sold", color: "var(--chart-2)" },
}

export function MonthlySalesChart({ data }: { data: MonthlySalesPoint[] }) {
  return (
    <ChartContainer config={monthlySalesConfig} className="aspect-auto h-[260px] w-full">
      <AreaChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.5} />
            <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tick={AXIS_STYLE} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={48}
          tick={AXIS_STYLE}
          tickFormatter={(v: number) =>
            v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`
          }
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              formatter={(value) => (
                <span className="font-mono font-medium tabular-nums">
                  {formatCurrency(Number(value))}
                </span>
              )}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="var(--chart-1)"
          strokeWidth={2}
          fill="url(#fillRevenue)"
        />
      </AreaChart>
    </ChartContainer>
  )
}

// ---------- Stock Distribution (Donut) ----------
export function StockDistributionChart({ data }: { data: StockDistributionPoint[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  return (
    <div className="relative">
      <ChartContainer config={stockDistributionConfig} className="aspect-auto h-[220px] w-full">
        <PieChart>
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent nameKey="name" hideLabel />}
          />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={58}
            outerRadius={84}
            strokeWidth={2}
            paddingAngle={2}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold">{formatNumber(total)}</span>
        <span className="text-xs text-muted-foreground">Products</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-1.5 text-xs">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: d.color }}
            />
            <span className="text-muted-foreground">{d.name}</span>
            <span className="font-medium">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------- Top Selling Products (Horizontal Bar) ----------
export function TopProductsChart({ data }: { data: TopProduct[] }) {
  const chartData = data.map((d) => ({
    name: d.productName.length > 18 ? d.productName.slice(0, 17) + "…" : d.productName,
    fullName: d.productName,
    quantitySold: d.quantitySold,
    revenue: d.revenue,
  }))
  return (
    <ChartContainer config={topProductsConfig} className="aspect-auto h-[260px] w-full">
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ left: 8, right: 24, top: 0, bottom: 0 }}
      >
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" tickLine={false} axisLine={false} tick={AXIS_STYLE} />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          width={120}
          tick={AXIS_STYLE}
        />
        <ChartTooltip
          cursor={{ fill: "var(--muted)" }}
          content={
            <ChartTooltipContent
              labelKey="fullName"
              formatter={(value, _name, item) => (
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono font-medium tabular-nums">
                    {Number(value)} units
                  </span>
                  <span className="text-muted-foreground">
                    {formatCurrency(Number((item?.payload as { revenue?: number } | undefined)?.revenue ?? 0))} revenue
                  </span>
                </div>
              )}
            />
          }
        />
        <Bar dataKey="quantitySold" fill="var(--chart-1)" radius={4}>
          <LabelList
            dataKey="quantitySold"
            position="right"
            className="fill-foreground"
            style={{ fontSize: 11, fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

// ---------- Products Sold Per Month (Bar) ----------
export function SoldPerMonthChart({ data }: { data: SoldPerMonthPoint[] }) {
  return (
    <ChartContainer config={soldPerMonthConfig} className="aspect-auto h-[260px] w-full">
      <BarChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tick={AXIS_STYLE} />
        <YAxis tickLine={false} axisLine={false} width={32} tick={AXIS_STYLE} />
        <ChartTooltip
          cursor={{ fill: "var(--muted)" }}
          content={<ChartTooltipContent />}
        />
        <Bar dataKey="quantity" fill="var(--chart-2)" radius={[6, 6, 0, 0]}>
          <LabelList
            dataKey="quantity"
            position="top"
            className="fill-foreground"
            style={{ fontSize: 11, fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
