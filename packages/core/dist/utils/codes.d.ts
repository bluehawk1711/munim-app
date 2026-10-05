/**
 * Format: 5 unambiguous characters (no `PRD-` prefix since 2026-09) — short
 * enough to type at the counter, scan-safe, and unique via the caller's
 * exists-predicate + the DB's unique constraint (32^5 ≈ 33.5M combinations).
 * Existing 6-char and `PRD-XXXXXX` SKUs stay valid forever (lookups accept
 * any format).
 */
export declare function generateSku(exists: (sku: string) => Promise<boolean>): Promise<string>;
/**
 * Format: `INV-4CHAR` (e.g. `INV-7K2M`) — the 4-char code is the searchable
 * part; use {@link stripCodePrefix} so typing the bare code finds the bill.
 * Legacy `INV-YYYYMMDD-XXXX` numbers remain valid forever.
 */
export declare function generateInvoiceNumber(exists: (invoiceNumber: string) => Promise<boolean>): Promise<string>;
/**
 * Format: `ORD-4CHAR` (e.g. `ORD-7K2M`) — same 4-char code style as bills so
 * the counter can read either out loud without thinking.
 */
export declare function generateOrderNumber(exists: (orderNumber: string) => Promise<boolean>): Promise<string>;
/**
 * Drops the fixed `INV-` / `ORD-` prefixes so searches match the bare code:
 * searching "7K2M" finds both ORD-7K2M and INV-7K2M, and searching the full
 * "INV-7K2M" also works. A prefix WITHOUT its trailing dash ("INV") is left
 * alone so it doesn't match every number in the table.
 */
export declare function stripCodePrefix(value: string): string;
/**
 * Prefix-insensitive, case-insensitive search match for bill/order numbers.
 * Empty/whitespace query matches everything (caller usually guards first).
 */
export declare function codeMatches(haystack: string | null | undefined, query: string): boolean;
//# sourceMappingURL=codes.d.ts.map