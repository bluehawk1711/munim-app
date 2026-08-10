"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

type StatCardProps = {
  title: string
  value: React.ReactNode
  icon: React.ComponentType<{ className?: string }>
  hint?: React.ReactNode
  accent?: "primary" | "amber" | "rose" | "teal"
  loading?: boolean
}

const ACCENT_STYLES: Record<NonNullable<StatCardProps["accent"]>, string> = {
  primary: "bg-primary/10 text-primary",
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  rose: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  teal: "bg-teal-500/15 text-teal-600 dark:text-teal-400",
}

export function StatCard({
  title,
  value,
  icon: Icon,
  hint,
  accent = "primary",
  loading,
}: StatCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <p className="truncate text-2xl font-semibold tracking-tight">{value}</p>
            )}
            {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
          </div>
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
              ACCENT_STYLES[accent]
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
