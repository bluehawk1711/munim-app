"use client"

import * as React from "react"
import { motion, useInView, useMotionValue, useSpring, useTransform } from "motion/react"
import { cn } from "@/lib/utils"
import { Card, CardContent, Skeleton } from "@munim/ui"



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

const ACCENT_GLOW: Record<NonNullable<StatCardProps["accent"]>, string> = {
  primary: "shadow-primary/20",
  amber: "shadow-amber-500/20",
  rose: "shadow-rose-500/20",
  teal: "shadow-teal-500/20",
}

/** Parses a formatted value like "₹1,23,456" or "42" into its numeric core. */
function parseValue(raw: React.ReactNode): { prefix: string; suffix: string; number: number } | null {
  if (typeof raw !== "string") return null
  const match = raw.match(/^(\D*)([\d,]+(?:\.\d+)?)(.*)$/)
  if (!match) return null
  const digits = match[2]
  if (!digits) return null
  const number = Number(digits.replace(/,/g, ""))
  if (!Number.isFinite(number)) return null
  return { prefix: match[1] ?? "", suffix: match[3] ?? "", number }
}

function CountUpValue({ raw }: { raw: React.ReactNode }) {
  const ref = React.useRef<HTMLParagraphElement>(null)
  const inView = useInView(ref, { once: true, margin: "-40px" })
  const parsed = React.useMemo(() => parseValue(raw), [raw])

  const motionValue = useMotionValue(0)
  const spring = useSpring(motionValue, { stiffness: 60, damping: 18, mass: 0.9 })
  const decimals = parsed ? (parsed.number % 1 !== 0 ? 2 : 0) : 0
  const text = useTransform(spring, (latest) => {
    // Keep paise when the source value has decimals; round to 2dp to avoid
    // float drift mid-animation.
    const n = Math.round(latest * 100) / 100
    return n.toLocaleString("en-IN", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  })

  React.useEffect(() => {
    if (inView && parsed) motionValue.set(parsed.number)
  }, [inView, parsed, motionValue])

  if (!parsed) {
    return <p className="truncate text-2xl font-semibold tracking-tight">{raw}</p>
  }

  return (
    <p ref={ref} className="truncate text-2xl font-semibold tracking-tight tabular-nums">
      {parsed.prefix}
      <motion.span>{text}</motion.span>
      {parsed.suffix}
    </p>
  )
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
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 220, damping: 22, mass: 0.8 }}
      whileHover={{ y: -3 }}
    >
      <Card className="card-lift overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              {loading ? (
                <Skeleton className="h-7 w-24" />
              ) : (
                <CountUpValue raw={value} />
              )}
              {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
            </div>
            <motion.div
              whileHover={{ rotate: 6, scale: 1.08 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm",
                ACCENT_STYLES[accent],
                ACCENT_GLOW[accent]
              )}
            >
              <Icon className="h-5 w-5" />
            </motion.div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
