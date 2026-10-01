/**
 * Format: 6 unambiguous characters (no `PRD-` prefix since 2026-09) — short
 * enough to type at the counter, scan-safe, and unique via the caller's
 * exists-predicate + the DB's unique constraint (32^6 ≈ 1.07B combinations).
 * Existing `PRD-XXXXXX` SKUs stay valid forever (lookups accept any format).
 */
export declare function generateSku(exists: (sku: string) => Promise<boolean>): Promise<string>;
/** Format: INV-YYYYMMDD-XXXX */
export declare function generateInvoiceNumber(exists: (invoiceNumber: string) => Promise<boolean>): Promise<string>;
//# sourceMappingURL=codes.d.ts.map