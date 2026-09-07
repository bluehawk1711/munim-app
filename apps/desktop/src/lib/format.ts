import { formatCurrency, formatDate, formatDateTime, formatWeight } from "@munim/core";

/** INR shorthand used across the desktop app (space after the code so
 *  values like "INR 1,234.00" breathe in tight tiles). */
export function money(value: number): string {
  return formatCurrency(value, "INR ");
}

/**
 * Parses a core `monthLabel` string ("Sep 2026") into a Date for the
 * time-series charts (they key their x-axis on real dates).
 * Returns epoch (1970-01-01) for unparseable labels so charts never crash.
 */
export function monthLabelToDate(label: string): Date {
  const [mon, year] = label.split(" ");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const idx = months.indexOf(mon ?? "");
  const y = Number(year);
  if (idx < 0 || !Number.isFinite(y)) return new Date(0);
  return new Date(y, idx, 1);
}

export { formatCurrency, formatDate, formatDateTime, formatWeight };
