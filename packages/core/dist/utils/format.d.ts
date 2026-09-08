export declare function formatCurrency(value: number, currency?: string): string;
export declare function formatNumber(value: number): string;
export declare function formatDate(date: string | Date | null | undefined): string;
export declare function formatDateTime(date: string | Date | null | undefined): string;
export declare function monthLabel(date: Date): string;
/**
 * Format a weight value with its display unit.
 * e.g. (24.5, "gm") → "24.5 gm", (24500, "mg") → "24500 mg".
 * Shared by all three apps so labels and reports read identically.
 */
export declare function formatWeight(weight: number | null | undefined, unit?: string | null): string;
export declare function todayISO(): string;
//# sourceMappingURL=format.d.ts.map