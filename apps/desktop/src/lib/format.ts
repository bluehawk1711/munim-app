import { formatCurrency, formatDate, formatDateTime, formatWeight } from "@munim/core";

/** INR shorthand used across the desktop app. */
export function money(value: number): string {
  return formatCurrency(value, "INR");
}

/**
 * Parses a core `monthLabel` string ("Sep 2026") into a Date for the
 * time-series charts (they key their x-axis on real dates).
 */
export function monthLabelToDate(label: string): Date {
  const [mon, year] = label.split(" ");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const idx = months.indexOf(mon ?? "");
  const y = Number(year);
  if (idx < 0 || !Number.isFinite(y)) return new Date(NaN);
  return new Date(y, idx, 1);
}

export { formatCurrency, formatDate, formatDateTime, formatWeight };
