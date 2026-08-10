"use client"

import * as React from "react"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getStockStatus, type StockStatus } from "@/lib/types"

const STATUS_CONFIG: Record<
  StockStatus,
  { label: string; className: string; dot: string }
> = {
  in_stock: {
    label: "In Stock",
    className:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  low_stock: {
    label: "Low Stock",
    className:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  out_of_stock: {
    label: "Out of Stock",
    className: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400",
    dot: "bg-rose-500",
  },
}

export function StockBadge({ stock }: { stock: number }) {
  const status = getStockStatus(stock)
  const cfg = STATUS_CONFIG[status]
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", cfg.className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </Badge>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <Card className={cn("border-dashed", className)}>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Icon className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">{title}</p>
            {description && (
              <p className="mx-auto max-w-sm text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {action}
        </CardContent>
      </Card>
    </motion.div>
  )
}

export function LoadingState({ message = "Loading…" }: { message?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
        {message}
      </CardContent>
    </Card>
  )
}

/** Animated stat card with count-up effect */
export function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  trend?: { value: string; positive: boolean }
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <Card className="card-lift">
        <CardContent className="flex items-start justify-between p-5">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
            {trend && (
              <p className={cn("text-xs", trend.positive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                {trend.positive ? "↑" : "↓"} {trend.value}
              </p>
            )}
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

/** Skeleton loader with shimmer animation */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("skeleton-shimmer rounded-lg", className)} />
  )
}

/** Staggered list item entrance — wraps children in motion.div */
export function StaggerItem({
  children,
  index = 0,
  className,
}: {
  children: React.ReactNode
  index?: number
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}