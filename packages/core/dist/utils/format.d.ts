export declare function formatCurrency(value: number, currency?: string): string;
export declare function formatNumber(value: number): string;
export declare function formatDate(date: string | Date | null | undefined): string;
export declare function formatDateTime(date: string | Date | null | undefined): string;
export declare function monthLabel(date: Date): string;
/**
 * Formats a weight stored in milligrams for display: mg → g → kg.
 * e.g. 24500 → "24.5 g", 1500000 → "1.5 kg", 350 → "350 mg".
 * Shared by all three apps so labels and reports read identically.
 */
export declare function formatWeight(milligrams: number | null | undefined): string;
export declare function todayISO(): string;
//# sourceMappingURL=format.d.ts.map