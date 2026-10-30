import { formatCurrency, formatDate, formatDateTime, formatWeight } from "@munim/core";

/** INR shorthand used across the desktop app (space after the code so
 *  values like "INR 1,234.00" breathe in tight tiles). */
export function money(value: number): string {
  return formatCurrency(value, "INR ");
}

/**
 * Parses a core `monthLabel` string ("Sep 2026") into a Date for the
 * time-series charts (they key their x-axis on real dates).
 *
 * Must accept every abbreviation `toLocaleDateString("en-IN")` can emit —
 * notably **"Sept 2026"** (en-IN uses 4 letters for September). Matching only
 * "Sep" silently turned that month into the 1970 epoch fallback, stretching
 * the axis across 56 years and squashing all real months into the far right,
 * on top of each other.
 *
 * Returns epoch (1970-01-01) for unparseable labels so charts never crash.
 */
export function monthLabelToDate(label: string): Date {
  const [rawMonth, year] = label.trim().split(/\s+/);
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const idx = months.indexOf((rawMonth ?? "").toLowerCase().slice(0, 3));
  const y = Number(year);
  if (idx < 0 || !Number.isFinite(y) || !year) return new Date(0);
  return new Date(y, idx, 1);
}

export { formatCurrency, formatDate, formatDateTime, formatWeight };
