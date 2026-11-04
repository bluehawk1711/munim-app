export declare function formatCurrency(value: number, currency?: string): string;
export declare function formatNumber(value: number): string;
export declare function formatDate(date: string | Date | null | undefined): string;
export declare function formatDateTime(date: string | Date | null | undefined): string;
/**
 * Local calendar day as `YYYY-MM-DD` — the exact shape `<input type="date">`
 * and the analytics date-range pickers use (never UTC, so a late-evening
 * click doesn't land on tomorrow).
 */
export declare function isoDay(date?: Date): string;
/** `YYYY-MM-DD` for today plus `days` (negative = the past). */
export declare function isoDayOffset(days: number, from?: Date): string;
export declare function monthLabel(date: Date): string;
/**
 * Format a weight value with its display unit.
 * e.g. (24.5, "gm") → "24.5 gm", (24500, "mg") → "24500 mg".
 * Shared by all three apps so labels and reports read identically.
 */
export declare function formatWeight(weight: number | null | undefined, unit?: string | null): string;
export declare function todayISO(): string;
/** Local midnight of the given date — inclusive lower bound for ranges. */
export declare function startOfDay(date: Date): Date;
/** Local midnight of the 1st of the given date's month. */
export declare function startOfMonth(date: Date): Date;
//# sourceMappingURL=format.d.ts.map