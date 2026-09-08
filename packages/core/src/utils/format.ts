export function formatCurrency(value: number, currency = "₹"): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${currency}${safe.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatNumber(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toLocaleString("en-IN");
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function monthLabel(date: Date): string {
  return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

/**
 * Format a weight value with its display unit.
 * e.g. (24.5, "gm") → "24.5 gm", (24500, "mg") → "24500 mg".
 * Shared by all three apps so labels and reports read identically.
 */
export function formatWeight(weight: number | null | undefined, unit?: string | null): string {
  const safe = Number.isFinite(weight) ? (weight ?? 0) : 0;
  if (safe === 0) return "—";
  const u = unit === "mg" ? "mg" : "gm";
  // Round to avoid floating-point display artefacts (e.g. 197.33000000000004)
  const rounded = Math.round(safe * 1000) / 1000;
  return `${rounded} ${u}`;
}

export function todayISO(): string {
  return new Date().toISOString();
}
