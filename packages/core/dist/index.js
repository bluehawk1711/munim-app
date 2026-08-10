/**
 * @munim/core — the shared brain of the munim monorepo.
 *
 * Every app (web, desktop, mobile) imports from here. All database schema,
 * connection logic, and business rules live in this one package — there is
 * NO separate API server.
 */
/* DB */
export { createDb, getDb, pingDatabase, parseConnectionString } from "./db/client";
export * as schema from "./db/schema";
/* Billing — shared bill/invoice generation (all 3 apps) */
export * from "./billing";
/* Utils */
export { numberToWords, amountInWords } from "./utils/numberToWords";
export { generateSku, generateInvoiceNumber } from "./utils/codes";
export { formatCurrency, formatNumber, formatDate, formatDateTime, monthLabel } from "./utils/format";
export { newId } from "./utils/id";
/* Services */
export * from "./services/products";
export * from "./services/invoices";
export * from "./services/parties";
export * from "./services/advances";
export * from "./services/jobLetters";
export * from "./services/settings";
export * from "./services/dashboard";
export { logActivity } from "./services/activity";
//# sourceMappingURL=index.js.map