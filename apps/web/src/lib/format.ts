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

/** Weight stored in milligrams → "350 mg" / "24.5 g" / "1.5 kg". */
export function formatWeight(milligrams: number | null | undefined): string {
  const safe = Number.isFinite(milligrams) ? (milligrams ?? 0) : 0
  if (safe === 0) return "—"
  const trim = (n: number) => String(Math.round(n * 100) / 100)
  if (safe >= 1_000_000) return `${trim(safe / 1_000_000)} kg`
  if (safe >= 1000) return `${trim(safe / 1000)} g`
  return `${safe} mg`
}
