/**
 * @munim/core — the shared brain of the munim monorepo.
 *
 * Every app (web, desktop, mobile) imports from here. All database schema,
 * connection logic, and business rules live in this one package — there is
 * NO separate API server.
 */
export { createDb, getDb, pingDatabase, parseConnectionString, type DbClient } from "./db/client";
export * as schema from "./db/schema";
export type * from "./db/schema";
export * from "./billing";
export { numberToWords, amountInWords } from "./utils/numberToWords";
export { generateSku, generateInvoiceNumber } from "./utils/codes";
export { formatCurrency, formatNumber, formatDate, formatDateTime, monthLabel } from "./utils/format";
export { newId } from "./utils/id";
export * from "./services/products";
export * from "./services/invoices";
export * from "./services/parties";
export * from "./services/advances";
export * from "./services/jobLetters";
export * from "./services/settings";
export * from "./services/dashboard";
export { logActivity } from "./services/activity";
//# sourceMappingURL=index.d.ts.map