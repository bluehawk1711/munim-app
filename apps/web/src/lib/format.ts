import { format, formatDistanceToNow, parseISO } from "date-fns"

export const CURRENCY = "₹"

export function formatCurrency(value: number): string {
  const safe = Number.isFinite(value) ? value : 0
  return `${CURRENCY}${safe.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatNumber(value: number): string {
  const safe = Number.isFinite(value) ? value : 0
  return safe.toLocaleString("en-IN")
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date
  return format(d, "dd MMM yyyy")
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date
  return format(d, "dd MMM yyyy, hh:mm a")
}

export function formatTimeAgo(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date
  return formatDistanceToNow(d, { addSuffix: true })
}

export function monthLabel(date: Date): string {
  return format(date, "MMM yyyy")
}

/** Weight value → display string using the selected unit. */
export function formatWeight(weight: number | null | undefined, unit?: string | null): string {
  const safe = Number.isFinite(weight) ? (weight ?? 0) : 0
  if (safe === 0) return "—"
  const u = unit === "mg" ? "mg" : "gm"
  return `${safe} ${u}`
}
