/** Format: PRD-XXXXXX */
export declare function generateSku(exists: (sku: string) => Promise<boolean>): Promise<string>;
/** Format: INV-YYYYMMDD-XXXX */
export declare function generateInvoiceNumber(exists: (invoiceNumber: string) => Promise<boolean>): Promise<string>;
//# sourceMappingURL=codes.d.ts.map